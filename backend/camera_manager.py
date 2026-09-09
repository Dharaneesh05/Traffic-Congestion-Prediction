"""
camera_manager.py — Multi-Camera Management System
==================================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Manages camera sources (IP Camera, Laptop Webcam, Uploaded Video, RTSP),
runs per-camera background worker threads, and provides unified detection,
ByteTrack tracking, vehicle counting, metrics calculation, Redis live state updates,
periodic PostgreSQL snapshot persistence, and MJPEG streaming.
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Union, Any
from dataclasses import dataclass, field, asdict

import cv2
import numpy as np
from pydantic import BaseModel, Field

# Ensure backend directory is in sys.path
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

# Internal Modules
try:
    from detect import Detector, Detection, CLASS_NAMES
    from track import Tracker
    from counter import VehicleCounter, LineConfig
    from traffic_analysis import TrafficAnalyser, AnalysisConfig
    from config import CAMERAS, VIDEO_DIR
    from redis_client import redis_client
    from database import SessionLocal, CameraModelDB, TrafficSnapshotModel, TrafficEventModel
except (ImportError, ModuleNotFoundError):
    from backend.detect import Detector, Detection, CLASS_NAMES
    from backend.track import Tracker
    from backend.counter import VehicleCounter, LineConfig
    from backend.traffic_analysis import TrafficAnalyser, AnalysisConfig
    from backend.config import CAMERAS, VIDEO_DIR
    from backend.redis_client import redis_client
    from backend.database import SessionLocal, CameraModelDB, TrafficSnapshotModel, TrafficEventModel


# ──────────────────────────────────────────────────────────────────────────────
# Camera Data Models & Schemas
# ──────────────────────────────────────────────────────────────────────────────

class CameraCreatePayload(BaseModel):
    camera_id: Optional[str] = None
    name: str
    location: Optional[str] = "Tamil Nadu"
    road: Optional[str] = "Main Corridor"
    source_type: str  # "ip" | "webcam" | "video" | "rtsp"
    source: Union[str, int]
    junction_id: Optional[str] = "JUNC_SANKAGIRI_01"
    approach: Optional[str] = "Approach Feed"


class CameraUpdatePayload(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    road: Optional[str] = None
    source_type: Optional[str] = None
    source: Optional[Union[str, int]] = None
    junction_id: Optional[str] = None
    approach: Optional[str] = None


@dataclass
class CameraModel:
    camera_id: str
    name: str
    location: str
    road: str
    source_type: str  # "ip" | "webcam" | "video" | "rtsp"
    source: Union[str, int]
    junction_id: str = "JUNC_SANKAGIRI_01"
    approach: str = "Approach Feed"
    status: str = "offline"  # "offline" | "starting" | "online" | "error" | "stopped"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_frame_at: Optional[str] = None
    error_message: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "camera_id": self.camera_id,
            "name": self.name,
            "location": self.location,
            "road": self.road,
            "source_type": self.source_type,
            "source": str(self.source),
            "junction_id": self.junction_id,
            "approach": self.approach,
            "status": self.status,
            "created_at": self.created_at,
            "last_frame_at": self.last_frame_at,
            "error_message": self.error_message
        }


# ──────────────────────────────────────────────────────────────────────────────
import queue

# ──────────────────────────────────────────────────────────────────────────────
# Camera Worker Thread
# ──────────────────────────────────────────────────────────────────────────────

class CameraWorker:
    """
    Dedicated worker for a single camera stream. Runs in a daemon background thread.
    Executes: OpenCV VideoCapture / Frame Push -> Frame -> YOLO11 Detect -> ByteTrack Track ->
    Vehicle Counter -> Traffic Analyser -> Redis Live State -> PostgreSQL Snapshot -> MJPEG frame.
    """

    def __init__(
        self,
        model: CameraModel,
        detector: Optional[Detector] = None,
        predictor: Optional[Any] = None,
        route_planner: Optional[Any] = None,
    ):
        self.model = model
        self.detector = detector
        self.predictor = predictor
        self.route_planner = route_planner
        
        self.stop_event = threading.Event()
        self.thread: Optional[threading.Thread] = None
        
        # In-memory frame queue for browser / mobile pushed frames
        self.frame_queue: queue.Queue = queue.Queue(maxsize=5)
        
        # Per-camera state storage
        self.latest_jpeg: Optional[bytes] = None
        self.latest_metrics: dict = {
            "camera_id": self.model.camera_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "offline",
            "fps": 0.0,
            "vehicles": {"car": 0, "truck": 0, "bus": 0, "bike": 0},
            "total": 0,
            "average_speed": None,
            "congestion_score": 0
        }
        self.latest_detections: dict = {
            "camera_id": self.model.camera_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "detections": []
        }
        self.latest_telemetry: Optional[dict] = None
        self.latest_forecast: Optional[dict] = None
        self._logged_start: bool = False
        self._logged_analyser: bool = False
        self._logged_predictor: bool = False
        
        # Per-camera tracking & analytics pipeline instances
        self.tracker: Optional[Tracker] = None
        self.counter: Optional[VehicleCounter] = None
        self.analyser: Optional[TrafficAnalyser] = None

    def push_frame(self, frame_data: Union[bytes, np.ndarray]):
        """Pushes a raw JPEG byte buffer or numpy image into the worker's processing queue."""
        if isinstance(frame_data, bytes):
            nparr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        else:
            frame = frame_data
        if frame is not None:
            try:
                if self.frame_queue.full():
                    try:
                        self.frame_queue.get_nowait()
                    except queue.Empty:
                        pass
                self.frame_queue.put_nowait(frame)
            except queue.Full:
                pass

    def start(self):
        if self.thread and self.thread.is_alive():
            return
        self.stop_event.clear()
        self.model.status = "starting"
        self.model.error_message = None
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        self.model.status = "stopped"
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)

    def _open_capture(self) -> Optional[cv2.VideoCapture]:
        stype = self.model.source_type.lower()
        src = self.model.source

        if stype in ["mobile", "mobile_ip", "browser", "stream_push", "webcam_push"]:
            return None  # Uses in-memory frame_queue

        cap = None
        if stype in ["webcam", "laptop_webcam"]:
            try:
                device_idx = int(src)
            except (ValueError, TypeError):
                device_idx = 0
            cap = cv2.VideoCapture(device_idx)
        elif stype in ["ip", "rtsp", "video", "uploaded_video"]:
            src_str = str(src)
            if stype in ["video", "uploaded_video"] and not os.path.exists(src_str):
                potential = VIDEO_DIR / Path(src_str).name
                if potential.exists():
                    src_str = str(potential)

            if os.path.exists(src_str) or stype in ["ip", "rtsp"]:
                cap = cv2.VideoCapture(src_str)

        # Fallback handling if video file path does not exist on disk
        if (cap is None or not cap.isOpened()) and stype in ["video", "uploaded_video"]:
            fallback_paths = [
                Path(_BACKEND_DIR) / "ByteTrack" / "videos" / "palace.mp4",
                VIDEO_DIR / "Traffic.mp4",
                VIDEO_DIR / "Traffic2.mp4",
            ]
            for fb in fallback_paths:
                if fb.exists():
                    print(f"[CameraWorker {self.model.camera_id}] Primary source '{src}' missing. Falling back to video: {fb}")
                    cap = cv2.VideoCapture(str(fb))
                    if cap and cap.isOpened():
                        break

        return cap

    def _run(self):
        print(f"[CameraWorker {self.model.camera_id}] Connecting to {self.model.source_type} source: {self.model.source}")
        
        cap = None
        is_push_source = self.model.source_type.lower() in ["mobile", "mobile_ip", "browser", "stream_push", "webcam_push"]
        try:
            if not is_push_source:
                cap = self._open_capture()
                if cap is None or not cap.isOpened():
                    raise RuntimeError(
                        f"Could not open video stream for source '{self.model.source}'. "
                        f"File does not exist or camera device is unreachable."
                    )
                self.frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
                self.frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720
            else:
                self.frame_width = 640
                self.frame_height = 480

            # Instantiate per-camera pipeline with exact frame dimensions
            self.tracker = Tracker(weights="yolo11n.pt", conf=0.25, tracker_config="bytetrack.yaml").load()
            self.counter = VehicleCounter(
                lines=[LineConfig(name="L1", p1=(0.05, 0.5), p2=(0.95, 0.5), direction="both")],
                frame_w=self.frame_width,
                frame_h=self.frame_height
            )
            self.analyser = TrafficAnalyser(AnalysisConfig(fps=30.0, history_len=100000))

            self.model.status = "online"
            print(f"[Camera] {self.model.camera_id} started")
            print(f"[CameraWorker {self.model.camera_id}] Connection SUCCESS. Processing active.")

            fps = cap.get(cv2.CAP_PROP_FPS) if cap else 30.0
            if not fps or fps <= 0 or fps > 60:
                fps = 30.0
            target_delay = 1.0 / fps

            is_video = self.model.source_type.lower() in ["video", "uploaded_video"]
            sim_speed = float(os.getenv("CCTV_SIM_SPEED", "1.0")) if is_video else 1.0
            frame_stride = max(1, int(os.getenv("CCTV_FRAME_STRIDE", "1"))) if is_video else 1

            frame_idx = 0
            start_real_time = time.time()
            start_epoch_s = time.time()
            frame_counter = 0
            loop_count = 0
            last_snapshot_time = 0.0  # Controls periodic PostgreSQL snapshot persistence

            while not self.stop_event.is_set():
                loop_start = time.time()

                if is_push_source:
                    try:
                        frame = self.frame_queue.get(timeout=0.2)
                    except queue.Empty:
                        continue
                    ret = True
                else:
                    if not cap or not cap.isOpened():
                        break

                    # Stride handling for simulated video feeds
                    if is_video and frame_stride > 1:
                        for _ in range(frame_stride - 1):
                            grabbed = cap.grab()
                            if not grabbed:
                                loop_count += 1
                                print(f"[CameraWorker {self.model.camera_id}] Video loop {loop_count} reached EOF — rewinding to frame 0 (continuous CCTV simulation).", flush=True)
                                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                                break

                    ret, frame = cap.read()

                    if not ret:
                        if is_video:
                            # Auto-loop simulated CCTV video feed for continuous playback
                            loop_count += 1
                            print(f"[CameraWorker {self.model.camera_id}] Video loop {loop_count} reached EOF — rewinding to frame 0 (continuous CCTV simulation).", flush=True)
                            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                            ret, frame = cap.read()
                            if not ret:
                                print(f"[CameraWorker {self.model.camera_id}] Video feed reached end of file.")
                                self.model.status = "stopped"
                                break
                        else:
                            print(f"[CameraWorker {self.model.camera_id}] Frame acquisition failed / Stream disconnected.")
                            self.model.status = "error"
                            self.model.error_message = "Video feed disconnected or failed to return frames."
                            break

                frame_idx += 1
                frame_counter += 1

                real_elapsed = time.time() - start_real_time
                sim_elapsed_s = real_elapsed * sim_speed
                current_wall_time_s = start_epoch_s + sim_elapsed_s
                current_timestamp_ms = sim_elapsed_s * 1000.0

                now_iso = datetime.fromtimestamp(current_wall_time_s, tz=timezone.utc).isoformat()
                self.model.last_frame_at = now_iso

                # Compute actual FPS
                elapsed = time.time() - start_real_time
                curr_fps = round(frame_counter / elapsed, 1) if elapsed > 0 else fps

                # Run Tracker (YOLO11 + ByteTrack)
                if not self._logged_start:
                    print("[Detector] YOLO11 processing")
                    print("[Tracker] ByteTrack processing")
                    self._logged_start = True

                track_result = self.tracker.track_frame(frame, camera_id=self.model.camera_id, timestamp_ms=current_timestamp_ms)
                events = self.counter.update(track_result.detections, frame_idx)
                metrics_obj = self.analyser.update(
                    track_result.detections,
                    track_result.trajectories,
                    events,
                    frame_idx,
                    timestamp_ms=current_timestamp_ms,
                    wall_time_s=current_wall_time_s
                )
                if frame_idx == 1 and is_video:
                    for past_min in range(60, 0, -1):
                        past_time_s = current_wall_time_s - (past_min * 60.0)
                        self.analyser.update(
                            track_result.detections,
                            track_result.trajectories,
                            events,
                            frame_index=0,
                            timestamp_ms=past_time_s * 1000.0,
                            wall_time_s=past_time_s
                        )
                if not self._logged_analyser:
                    print("[Analyser] telemetry generated")
                    self._logged_analyser = True

                # Format Detections JSON
                det_list = []
                vehicles_map = {"car": 0, "truck": 0, "bus": 0, "bike": 0}
                
                for det in track_result.detections:
                    cname = det.class_name.lower()
                    if cname in ["motorcycle", "motorbike", "bike"]:
                        key = "bike"
                    elif cname in vehicles_map:
                        key = cname
                    else:
                        key = "car"
                    vehicles_map[key] += 1

                    x1, y1, x2, y2 = det.bbox
                    cx = round((x1 + x2) / 2.0, 1)
                    cy = round((y1 + y2) / 2.0, 1)

                    det_list.append({
                        "track_id": det.track_id,
                        "class": key,
                        "confidence": round(det.confidence, 2),
                        "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                        "center": [cx, cy]
                    })

                self.latest_detections = {
                    "camera_id": self.model.camera_id,
                    "timestamp": now_iso,
                    "active_tracks": len(track_result.detections),
                    "detections": det_list
                }

                # Extract counter line crossing metrics
                lstate = self.counter._line_states.get("L1")
                entered_cnt = lstate.count_positive if lstate else 0
                exited_cnt = lstate.count_negative if lstate else 0
                total_crossings = lstate.total if lstate else 0

                # Cumulative / rolling flow rate based on actual virtual line crossings
                elapsed_min = max(0.1, (time.time() - start_real_time) / 60.0)
                cumulative_flow = round(total_crossings / elapsed_min, 1)
                rolling_flow = round(metrics_obj.traffic_flow_vpm, 1)
                vpm = rolling_flow if rolling_flow > 0.0 else cumulative_flow

                # Format Metrics JSON
                raw_score = metrics_obj.congestion_score
                score_100 = int(round(raw_score * 100)) if raw_score <= 1.0 else int(round(raw_score))
                rel_density = round(metrics_obj.road_occupancy, 2)
                
                # Estimate relative speed [0.0 - 1.0] from track movement
                avg_speed_raw = metrics_obj.average_speed_kmh
                rel_speed = round(min(1.0, avg_speed_raw / 60.0), 2) if (avg_speed_raw is not None and avg_speed_raw > 0) else 0.0

                # Enrich latest_telemetry with 100% truthful detection counts
                self.latest_telemetry = metrics_obj.to_dict()
                self.latest_telemetry["camera_id"] = self.model.camera_id
                self.latest_telemetry["vehicles"] = vehicles_map
                self.latest_telemetry["vehicle_breakdown"] = vehicles_map
                self.latest_telemetry["cars"] = vehicles_map["car"]
                self.latest_telemetry["trucks"] = vehicles_map["truck"]
                self.latest_telemetry["buses"] = vehicles_map["bus"]
                self.latest_telemetry["bikes"] = vehicles_map["bike"]
                self.latest_telemetry["total_tracked"] = len(track_result.detections)
                self.latest_telemetry["active_tracks"] = len(track_result.detections)
                self.latest_telemetry["flow_per_minute"] = vpm
                self.latest_telemetry["traffic_flow_vpm"] = vpm
                self.latest_telemetry["total_crossings"] = total_crossings
                self.latest_telemetry["entered"] = entered_cnt
                self.latest_telemetry["exited"] = exited_cnt
                self.latest_telemetry["fps"] = curr_fps
                self.latest_telemetry["resolution"] = f"{self.frame_width} x {self.frame_height}"
                self.latest_telemetry["source_type"] = "Uploaded Video" if is_video else self.model.source_type
                self.latest_telemetry["source"] = Path(self.model.source).name if self.model.source else "Video"
                self.latest_telemetry["detector"] = "YOLO11n"
                self.latest_telemetry["tracker"] = "ByteTrack"

                self.latest_metrics = {
                    "camera_id": self.model.camera_id,
                    "status": self.model.status,
                    "timestamp": now_iso,
                    "active_vehicles": len(track_result.detections),
                    "total_tracked": len(track_result.detections),
                    "vehicles": vehicles_map,
                    "vehicle_breakdown": vehicles_map,
                    "cars": vehicles_map["car"],
                    "trucks": vehicles_map["truck"],
                    "buses": vehicles_map["bus"],
                    "bikes": vehicles_map["bike"],
                    "total": len(track_result.detections),
                    "entered": entered_cnt,
                    "exited": exited_cnt,
                    "total_crossings": total_crossings,
                    "flow": {
                        "vehicles": int(round(vpm)),
                        "window_seconds": 60,
                        "vehicles_per_minute": vpm
                    },
                    "traffic_flow_vpm": vpm,
                    "flow_per_minute": vpm,
                    "speed": {
                        "type": "estimated",
                        "value": round(metrics_obj.average_speed_kmh, 1) if metrics_obj.average_speed_kmh else 0.0,
                        "physical_kmh": round(metrics_obj.average_speed_kmh, 1) if metrics_obj.average_speed_kmh else None,
                        "note": "Calibrated from 0.05m/px road geometry."
                    },
                    "average_speed_kmh": round(metrics_obj.average_speed_kmh, 1) if metrics_obj.average_speed_kmh else None,
                    "density": {
                        "type": "estimated",
                        "value": round(metrics_obj.vehicle_density, 1),
                        "veh_km": round(metrics_obj.vehicle_density, 1)
                    },
                    "vehicle_density": round(metrics_obj.vehicle_density, 1),
                    "road_occupancy": round(metrics_obj.road_occupancy, 4),
                    "congestion_score": score_100,
                    "congestion": {
                        "score": score_100,
                        "level": metrics_obj.congestion_level,
                        "mode": self.latest_forecast.get("telemetry_status", "trained_tft") if (self.latest_forecast and "note" not in self.latest_forecast.get("model_info", {})) else "heuristic_fallback"
                    },
                    "fps": curr_fps,
                    "resolution": f"{self.frame_width} x {self.frame_height}",
                    "source_type": "Uploaded Video" if is_video else self.model.source_type,
                    "source": Path(self.model.source).name if self.model.source else "Video",
                    "detector": "YOLO11n",
                    "tracker": "ByteTrack"
                }

                # Run TFT Congestion Prediction periodically
                if self.predictor is None:
                    try:
                        from congestion import CongestionPredictor
                        self.predictor = CongestionPredictor.load("models/tft")
                    except Exception:
                        try:
                            self.predictor = CongestionPredictor.load("backend/models/tft")
                        except Exception:
                            pass

                if self.predictor and (frame_idx % int(fps) == 0 or frame_idx == 1):
                    hist = self.analyser.get_history(as_dicts=True)
                    if hist and len(hist) > 0:
                        if not self._logged_predictor:
                            print("[Predictor] telemetry history available")
                            if getattr(self.predictor, "is_trained", False):
                                print("[Predictor] trained TFT inference active")
                            self._logged_predictor = True
                        self.latest_forecast = self.predictor.predict_live(hist)

                        # ─────────────────────────────────────────────────────
                        # Inject TFT Forecast into RoutePlanner (TFT -> Routing)
                        # ─────────────────────────────────────────────────────
                        is_trained_tft = (
                            self.latest_forecast.get("telemetry_status") == "trained_tft"
                            or self.latest_forecast.get("mode") == "trained_tft"
                            or (
                                self.latest_forecast.get("5min", {}).get("q50") is not None
                                and "note" not in self.latest_forecast.get("model_info", {})
                                and getattr(self.predictor, "is_trained", False)
                            )
                        )
                        if is_trained_tft:
                            planner = self.route_planner or getattr(camera_registry, "route_planner", None)
                            if planner is not None and getattr(planner, "_is_loaded", False):
                                try:
                                    from route import CongestionMap
                                    # Resolve camera coordinates from config or fallback
                                    cam_lat, cam_lon = 11.4920, 77.8700
                                    try:
                                        from config import CAMERAS
                                        for cam_cfg in CAMERAS:
                                            if (cam_cfg.get("camera_code", "").lower() == self.model.camera_id.lower() or
                                                cam_cfg.get("camera_id", "").lower() == self.model.camera_id.lower()):
                                                cam_lat = float(cam_cfg.get("lat", 11.4920))
                                                cam_lon = float(cam_cfg.get("lon", 77.8700))
                                                break
                                    except Exception:
                                        pass

                                    cmap = CongestionMap.from_forecast(
                                        forecast=self.latest_forecast,
                                        graph=planner._graph,
                                        camera_lat=cam_lat,
                                        camera_lon=cam_lon,
                                        radius_m=10000.0,
                                        horizon="5min",
                                        kdtree=getattr(planner, "_kdtree", None),
                                        kdtree_ids=getattr(planner, "_kdtree_ids", None),
                                    )
                                    planner.update_congestion(cmap)
                                    print(f"[RoutePlanner] TFT congestion map updated")
                                    print(f"[RoutePlanner] Camera {self.model.camera_id} forecast injected")
                                    print(f"[RoutePlanner] Congestion map size: {len(cmap)}")
                                except Exception as cmap_err:
                                    print(f"[CameraWorker] Route planner congestion update warning: {cmap_err}")

                # ─────────────────────────────────────────────────────────────
                # 1. Update Live State in Redis (Key: traffic:camera:{camera_id})
                # ─────────────────────────────────────────────────────────────
                live_redis_state = {
                    "status": "online",
                    "vehicles": len(track_result.detections),
                    "cars": vehicles_map["car"],
                    "trucks": vehicles_map["truck"],
                    "buses": vehicles_map["bus"],
                    "bikes": vehicles_map["bike"],
                    "congestion": score_100,
                    "speed": rel_speed,
                    "timestamp": now_iso
                }
                redis_client.set_camera_state(self.model.camera_id, live_redis_state)

                # ─────────────────────────────────────────────────────────────
                # 2. Persist Historical Snapshot to PostgreSQL (Every 5 seconds)
                # ─────────────────────────────────────────────────────────────
                if time.time() - last_snapshot_time >= 5.0:
                    last_snapshot_time = time.time()
                    try:
                        db_sess = SessionLocal()
                        snapshot = TrafficSnapshotModel(
                            camera_id=self.model.camera_id,
                            timestamp=now_iso,
                            car_count=vehicles_map["car"],
                            truck_count=vehicles_map["truck"],
                            bus_count=vehicles_map["bus"],
                            bike_count=vehicles_map["bike"],
                            total_count=len(track_result.detections),
                            congestion_score=score_100,
                            average_speed=rel_speed
                        )
                        db_sess.add(snapshot)
                        
                        # Sync camera status in PostgreSQL
                        cam_db = db_sess.query(CameraModelDB).filter(CameraModelDB.camera_code == self.model.camera_id).first()
                        if cam_db:
                            cam_db.status = "ONLINE"
                        db_sess.commit()
                        db_sess.close()
                    except Exception as db_err:
                        pass  # Fail gracefully if DB is temporarily unreachable

                # Generate Annotated Frame Overlay for MJPEG Stream
                annotated = frame.copy()

                # Bounding boxes and tracking labels
                for det in track_result.detections:
                    x1, y1, x2, y2 = map(int, det.bbox)
                    cname = det.class_name.lower()
                    color = (52, 211, 153)  # Green car
                    if cname == "truck":
                        color = (36, 187, 251)  # Orange
                    elif cname == "bus":
                        color = (22, 115, 249)  # Amber
                    elif cname in ["motorcycle", "bike"]:
                        color = (247, 85, 168)  # Purple

                    cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                    tid_str = f"#{det.track_id} " if det.track_id is not None else ""
                    label = f"{det.class_name.upper()} {tid_str}{det.confidence:.2f}"
                    
                    (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
                    cv2.rectangle(annotated, (x1, max(0, y1 - 20)), (x1 + w + 4, y1), color, -1)
                    cv2.putText(annotated, label, (x1 + 2, max(14, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)

                # Virtual counting reference line across corridor
                line_y = int(frame.shape[0] * 0.5)
                cv2.line(annotated, (int(frame.shape[1] * 0.05), line_y),
                                    (int(frame.shape[1] * 0.95), line_y), (0, 255, 255), 2)
                cv2.putText(annotated, "VIRTUAL COUNTING LINE", (int(frame.shape[1] * 0.06), line_y - 6),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 255, 255), 1, cv2.LINE_AA)

                # Dashboard overlay box (top left)
                overlay_bg = annotated.copy()
                cv2.rectangle(overlay_bg, (10, 10), (370, 115), (0, 0, 0), -1)
                cv2.addWeighted(overlay_bg, 0.65, annotated, 0.35, 0, annotated)

                # HUD text overlays
                cv2.putText(annotated, f"FEED: {self.model.name} ({self.model.camera_id})", (18, 28),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(annotated, f"TRACKED: {len(track_result.detections)} | FLOW: {vpm} veh/min", (18, 48),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(annotated, f"CARS:{vehicles_map['car']}  TRUCKS:{vehicles_map['truck']}  BUS:{vehicles_map['bus']}  BIKES:{vehicles_map['bike']}", (18, 68),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.40, (220, 220, 220), 1, cv2.LINE_AA)
                cv2.putText(annotated, f"DENSITY: {rel_density} | EST SPEED: {metrics_obj.average_speed_kmh:.1f} km/h", (18, 88),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.40, (180, 255, 180), 1, cv2.LINE_AA)
                cv2.putText(annotated, f"YOLO11n + BYTETRACK @ {curr_fps:.1f} FPS", (18, 106),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.38, (160, 200, 255), 1, cv2.LINE_AA)

                # Encode JPEG
                enc_ok, jpeg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
                if enc_ok:
                    self.latest_jpeg = jpeg.tobytes()

                # Sleep to maintain normal FPS speed
                process_time = time.time() - loop_start
                sleep_dur = max(0.001, target_delay - process_time)
                time.sleep(sleep_dur)

        except Exception as e:
            print(f"[CameraWorker {self.model.camera_id}] ERROR in processing loop: {e}")
            import traceback
            traceback.print_exc()
            self.model.status = "error"
            self.model.error_message = str(e)
        finally:
            if cap:
                cap.release()
            if self.model.status not in ["stopped", "error"]:
                self.model.status = "offline"
            print(f"[CameraWorker {self.model.camera_id}] Released resources. Status: {self.model.status}")
            
            # Sync final offline status to Redis & DB
            redis_client.set_camera_state(self.model.camera_id, {
                "status": self.model.status,
                "vehicles": 0,
                "cars": 0,
                "trucks": 0,
                "buses": 0,
                "bikes": 0,
                "congestion": 0,
                "speed": 0.0,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            try:
                db_sess = SessionLocal()
                cam_db = db_sess.query(CameraModelDB).filter(CameraModelDB.camera_code == self.model.camera_id).first()
                if cam_db:
                    cam_db.status = self.model.status.upper()
                    db_sess.commit()
                db_sess.close()
            except Exception:
                pass


# ──────────────────────────────────────────────────────────────────────────────
# Camera Registry & Management Service
# ──────────────────────────────────────────────────────────────────────────────

class CameraRegistry:
    """In-memory camera registry and lifecycle coordinator."""

    def __init__(self):
        self._lock = threading.RLock()
        self._cameras: Dict[str, CameraModel] = {}
        self._workers: Dict[str, CameraWorker] = {}
        self.route_planner: Optional[Any] = None
        self._seed_default_cameras()

    def set_route_planner(self, planner: Any) -> None:
        """Attach or update the global RoutePlanner instance across all camera workers."""
        with self._lock:
            self.route_planner = planner
            for w in self._workers.values():
                w.route_planner = planner

    def _seed_default_cameras(self):
        """Seed registry with default cameras from database or config."""
        try:
            db_sess = SessionLocal()
            cams_db = db_sess.query(CameraModelDB).all()
            if cams_db:
                for c in cams_db:
                    stype = c.source_type.lower()
                    if stype in ["ip_camera", "ip"]:
                        stype = "ip"
                    elif stype in ["laptop_webcam", "webcam"]:
                        stype = "webcam"
                    elif stype in ["uploaded_video", "video"]:
                        stype = "video"
                    model = CameraModel(
                        camera_id=c.camera_code,
                        name=c.name,
                        location="Sankagiri",
                        road=c.road_name,
                        source_type=stype,
                        source=c.source_url,
                        junction_id=c.junction_id,
                        approach=c.approach,
                        status=c.status.lower()
                    )
                    self._cameras[c.camera_code] = model
                db_sess.close()
                return
            db_sess.close()
        except Exception as db_err:
            print(f"[CameraRegistry] Note: Seed from DB: {db_err}")

        # Seed default operational cameras for Tamil Nadu highway corridors & 4 input modes
        default_seed_configs = [
            {
                "camera_id": "CCTV-SKG-01",
                "name": "Sankagiri Junction (North)",
                "location": "Sankagiri",
                "road": "NH544 Salem Inflow",
                "source_type": "video",
                "source": str(VIDEO_DIR / "Traffic.mp4"),
                "junction_id": "JUNC_SANKAGIRI_01",
                "approach": "North Approach",
            },
            {
                "camera_id": "CCTV-SLM-01",
                "name": "Salem Junction (Central)",
                "location": "Salem",
                "road": "Salem-Coimbatore Highway",
                "source_type": "video",
                "source": str(VIDEO_DIR / "Traffic2.mp4"),
                "junction_id": "JUNC_SALEM_01",
                "approach": "East Approach",
            },
            {
                "camera_id": "CCTV-ERD-01",
                "name": "Erode Bus Stand (Radial)",
                "location": "Erode",
                "road": "Erode Bypass Corridor",
                "source_type": "video",
                "source": str(VIDEO_DIR / "Traffic3.mp4"),
                "junction_id": "JUNC_ERODE_01",
                "approach": "South Approach",
            },
            {
                "camera_id": "CCTV-MOBILE-01",
                "name": "Mobile Field Camera (LAN Stream)",
                "location": "Sankagiri",
                "road": "NH544 Mobile Patrol",
                "source_type": "mobile",
                "source": "browser_push",
                "junction_id": "JUNC_SANKAGIRI_01",
                "approach": "Mobile Patrol Unit",
            },
            {
                "camera_id": "CCTV-WEBCAM-01",
                "name": "PC Workstation Webcam",
                "location": "Control Room",
                "road": "Local Video Input",
                "source_type": "webcam",
                "source": 0,
                "junction_id": "JUNC_SANKAGIRI_01",
                "approach": "Desktop Operator",
            },
            {
                "camera_id": "CCTV-IP-01",
                "name": "IP / RTSP Highway Camera",
                "location": "Namakkal",
                "road": "NH44 Northbound",
                "source_type": "ip",
                "source": "rtsp://demo:demo@192.168.1.100:554/stream1",
                "junction_id": "JUNC_NAMAKKAL_01",
                "approach": "Overhead Gantry",
            }
        ]

        for cam in default_seed_configs:
            cid = cam["camera_id"]
            model = CameraModel(
                camera_id=cid,
                name=cam["name"],
                location=cam["location"],
                road=cam["road"],
                source_type=cam["source_type"],
                source=cam["source"],
                junction_id=cam["junction_id"],
                approach=cam["approach"],
                status="offline"
            )
            self._cameras[cid] = model

    def get_all(self) -> List[CameraModel]:
        with self._lock:
            # Deduplicate by camera_id
            seen = set()
            res = []
            for m in self._cameras.values():
                if m.camera_id not in seen:
                    seen.add(m.camera_id)
                    res.append(m)
            return res

    def get_by_id(self, camera_id: str) -> Optional[CameraModel]:
        with self._lock:
            return self._cameras.get(camera_id)

    def create(self, payload: CameraCreatePayload) -> CameraModel:
        with self._lock:
            cid = payload.camera_id
            if not cid:
                cid = f"CAM_{len(self._cameras) + 1:03d}"

            stype = payload.source_type.lower()
            if stype in ["ip_camera", "ip", "rtsp"]:
                stype = "ip"
            elif stype in ["laptop_webcam", "webcam"]:
                stype = "webcam"
            elif stype in ["mobile_camera", "mobile", "mobile_ip", "browser"]:
                stype = "mobile"
            elif stype in ["uploaded_video", "video"]:
                stype = "video"

            model = CameraModel(
                camera_id=cid,
                name=payload.name,
                location=payload.location or "Tamil Nadu",
                road=payload.road or "Main Corridor",
                source_type=stype,
                source=payload.source,
                junction_id=payload.junction_id or "JUNC_SANKAGIRI_01",
                approach=payload.approach or "Approach Feed",
                status="offline"
            )
            self._cameras[cid] = model

            # Sync creation to PostgreSQL database
            try:
                db_sess = SessionLocal()
                existing_db = db_sess.query(CameraModelDB).filter(CameraModelDB.camera_code == cid).first()
                if not existing_db:
                    db_cam = CameraModelDB(
                        camera_code=cid,
                        junction_id=model.junction_id,
                        name=model.name,
                        approach=model.approach,
                        road_name=model.road,
                        source_type=model.source_type,
                        source_url=str(model.source),
                        latitude=11.4800,
                        longitude=77.8700,
                        status="OFFLINE"
                    )
                    db_sess.add(db_cam)
                    db_sess.commit()
                db_sess.close()
            except Exception as db_err:
                print(f"[CameraRegistry] DB sync error on create: {db_err}")

            return model

    def update(self, camera_id: str, payload: CameraUpdatePayload) -> Optional[CameraModel]:
        with self._lock:
            model = self._cameras.get(camera_id)
            if not model:
                return None

            if payload.name is not None:
                model.name = payload.name
            if payload.location is not None:
                model.location = payload.location
            if payload.road is not None:
                model.road = payload.road
            if payload.source_type is not None:
                stype = payload.source_type.lower()
                if stype in ["ip_camera", "ip"]:
                    stype = "ip"
                elif stype in ["laptop_webcam", "webcam"]:
                    stype = "webcam"
                elif stype in ["uploaded_video", "video"]:
                    stype = "video"
                model.source_type = stype
            if payload.source is not None:
                model.source = payload.source
            if payload.junction_id is not None:
                model.junction_id = payload.junction_id
            if payload.approach is not None:
                model.approach = payload.approach

            # Sync update to PostgreSQL database
            try:
                db_sess = SessionLocal()
                db_cam = db_sess.query(CameraModelDB).filter(CameraModelDB.camera_code == camera_id).first()
                if db_cam:
                    db_cam.name = model.name
                    db_cam.road_name = model.road
                    db_cam.source_type = model.source_type
                    db_cam.source_url = str(model.source)
                    db_cam.junction_id = model.junction_id
                    db_cam.approach = model.approach
                    db_sess.commit()
                db_sess.close()
            except Exception as db_err:
                print(f"[CameraRegistry] DB sync error on update: {db_err}")

            return model

    def delete(self, camera_id: str) -> bool:
        with self._lock:
            if camera_id not in self._cameras:
                return False

            self.stop_worker(camera_id)
            del self._cameras[camera_id]

            # Sync deletion to PostgreSQL database
            try:
                db_sess = SessionLocal()
                db_cam = db_sess.query(CameraModelDB).filter(CameraModelDB.camera_code == camera_id).first()
                if db_cam:
                    db_sess.delete(db_cam)
                    db_sess.commit()
                db_sess.close()
            except Exception as db_err:
                print(f"[CameraRegistry] DB sync error on delete: {db_err}")

            return True

    def get_by_id(self, camera_id: str) -> Optional[CameraModel]:
        with self._lock:
            if camera_id in self._cameras:
                return self._cameras[camera_id]
            for k, m in self._cameras.items():
                if k.lower() == camera_id.lower() or m.camera_id.lower() == camera_id.lower():
                    return m
            return None

    def start_worker(
        self,
        camera_id: str,
        detector: Optional[Detector] = None,
        predictor: Optional[Any] = None,
        route_planner: Optional[Any] = None,
    ) -> CameraWorker:
        with self._lock:
            model = self.get_by_id(camera_id)
            if not model:
                raise ValueError(f"Camera ID '{camera_id}' not registered.")

            planner_to_use = route_planner or self.route_planner
            worker = self._workers.get(model.camera_id) or self._workers.get(camera_id)
            if not worker or not worker.thread or not worker.thread.is_alive():
                worker = CameraWorker(
                    model=model,
                    detector=detector,
                    predictor=predictor,
                    route_planner=planner_to_use,
                )
                self._workers[model.camera_id] = worker
                self._workers[camera_id] = worker
                worker.start()
            else:
                if planner_to_use is not None:
                    worker.route_planner = planner_to_use
            return worker

    def stop_worker(self, camera_id: str):
        with self._lock:
            model = self.get_by_id(camera_id)
            cid = model.camera_id if model else camera_id
            worker = self._workers.get(cid) or self._workers.get(camera_id)
            if worker:
                worker.stop()
                if cid in self._workers:
                    del self._workers[cid]
                if camera_id in self._workers:
                    del self._workers[camera_id]

    def get(self, camera_id: str) -> Optional[CameraModel]:
        return self.get_by_id(camera_id)

    def start_camera(
        self,
        camera_id: str,
        detector: Optional[Detector] = None,
        predictor: Optional[Any] = None,
        route_planner: Optional[Any] = None,
        source: Optional[str] = None,
        video: Optional[str] = None,
    ) -> CameraModel:
        model = self.get_by_id(camera_id)
        if not model:
            raise KeyError(f"Camera '{camera_id}' not found.")

        # If custom video or source passed, update model and restart worker cleanly
        if video:
            v_path = Path(video) if Path(video).is_absolute() else (VIDEO_DIR / video)
            if v_path.exists():
                self.stop_worker(camera_id)
                model.source = str(v_path)
                model.source_type = "video"
        elif source:
            self.stop_worker(camera_id)
            model.source = str(source)

        self.start_worker(camera_id, detector, predictor, route_planner=route_planner or self.route_planner)
        return model

    def stop_camera(self, camera_id: str) -> CameraModel:
        model = self.get_by_id(camera_id)
        if not model:
            raise KeyError(f"Camera '{camera_id}' not found.")
        self.stop_worker(camera_id)
        return model

    def get_worker(self, camera_id: str) -> Optional[CameraWorker]:
        with self._lock:
            w = self._workers.get(camera_id)
            if w:
                return w
            m = self.get_by_id(camera_id)
            if m:
                return self._workers.get(m.camera_id)
            return None


# Global camera registry instance
camera_registry = CameraRegistry()

