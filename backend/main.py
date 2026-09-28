"""
main.py — FastAPI Application Entrypoint
========================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Provides the REST API layer for the React frontend to interact with the
agentic backend pipeline.

Endpoints:
    POST /api/upload-video
    POST /api/start-detection
    POST /api/start-tracking
    GET  /api/get-traffic-stats
    GET  /api/predict-congestion
    POST /api/get-route

Architecture:
    - Global state object (`AppState`) holds instantiated backend classes
      (Detector, Tracker, Analyser, Predictor, RoutePlanner).
    - Background task (`process_video_stream`) runs the pipeline on the
      uploaded video asynchronously, updating the global state.
    - Endpoints serve the latest state to the frontend as JSON.
"""

import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
try:
    import google.protobuf.message_factory
    if not hasattr(google.protobuf.message_factory.MessageFactory, "GetPrototype"):
        google.protobuf.message_factory.MessageFactory.GetPrototype = lambda self, descriptor: google.protobuf.message_factory.GetMessageClass(descriptor)
except Exception:
    pass
import asyncio
import shutil
import sys
import time
import socket
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional, List, Dict, Any

# Ensure backend directory is in sys.path
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Internal Modules
try:
    from detect import Detector
    from track import Tracker
    from counter import VehicleCounter, LineConfig
    from traffic_analysis import TrafficAnalyser, AnalysisConfig
    from congestion import CongestionPredictor, TFTConfig
    from route import RoutePlanner, RouteConfig
    from agent import TrafficWorkflow, WorkflowContext
    from config import LOCATIONS, CAMERAS
    from rag_knowledge import rag_engine
    from diversion_engine import diversion_engine
    from alerts_audit import alert_audit_manager
    from camera_manager import camera_registry, CameraCreatePayload, CameraUpdatePayload
    from redis_client import redis_client
    from database import init_db, SessionLocal, JunctionModel, CameraModelDB, TrafficSnapshotModel, TrafficEventModel, RouteRequestModel, RouteResultModel
except (ImportError, ModuleNotFoundError):
    from backend.detect import Detector
    from backend.track import Tracker
    from backend.counter import VehicleCounter, LineConfig
    from backend.traffic_analysis import TrafficAnalyser, AnalysisConfig
    from backend.congestion import CongestionPredictor, TFTConfig
    from backend.route import RoutePlanner, RouteConfig
    from backend.agent import TrafficWorkflow, WorkflowContext
    from backend.config import LOCATIONS, CAMERAS
    from backend.rag_knowledge import rag_engine
    from backend.diversion_engine import diversion_engine
    from backend.alerts_audit import alert_audit_manager
    from backend.camera_manager import camera_registry, CameraCreatePayload, CameraUpdatePayload
    from backend.redis_client import redis_client
    from backend.database import init_db, SessionLocal, JunctionModel, CameraModelDB, TrafficSnapshotModel, TrafficEventModel, RouteRequestModel, RouteResultModel




# ──────────────────────────────────────────────────────────────────────────────
# Global App State
# ──────────────────────────────────────────────────────────────────────────────

class AppState:
    """Holds the global backend instances and current processing state."""
    def __init__(self):
        # Backend Instances
        self.detector: Optional[Detector] = None
        self.tracker: Optional[Tracker] = None
        self.counter: Optional[VehicleCounter] = None
        self.analyser: Optional[TrafficAnalyser] = None
        self.predictor: Optional[CongestionPredictor] = None
        self.route_planner: Optional[RoutePlanner] = None
        self.workflow: Optional[TrafficWorkflow] = None
        
        # Runtime State
        self.current_video_path: Optional[str] = None
        self.is_processing: bool = False
        
        # Toggles from API
        self.enable_detection: bool = False
        self.enable_tracking: bool = False
        
        # Latest Results (served to GET endpoints)
        self.latest_frame: Optional[np.ndarray] = None
        self.latest_metrics: dict = {}
        self.latest_forecast: dict = {}
        self.latest_report: str = ""

app_state = AppState()


# ──────────────────────────────────────────────────────────────────────────────
# Road Graph Background Loader
# ──────────────────────────────────────────────────────────────────────────────


def _load_route_graph_thread():
    """
    Load the OSM road graph in a background thread so the server stays responsive.
    Once loaded, app_state.route_planner._is_loaded becomes True and
    /api/get-route-by-name will start returning routes.
    """
    try:
        print("[System] [BG] Loading OSM graph from PBF...")
        app_state.route_planner.load()
        camera_registry.set_route_planner(app_state.route_planner)
        print("[System] [BG] OSM graph loaded successfully — routing is now available!")
    except FileNotFoundError as e:
        msg = str(e)
        print(f"[System] [BG] ERROR: OSM PBF file not found: {msg}")
        if app_state.route_planner:
            app_state.route_planner._load_error = msg
    except ImportError as e:
        msg = f"Missing dependency: {e}. Install pyrosm and osmnx."
        print(f"[System] [BG] ERROR: {msg}")
        if app_state.route_planner:
            app_state.route_planner._load_error = msg
    except Exception as e:
        import traceback
        msg = str(e)
        print(f"[System] [BG] Warning: Failed to load OSM graph: {msg}")
        traceback.print_exc()
        if app_state.route_planner:
            app_state.route_planner._load_error = msg


# ──────────────────────────────────────────────────────────────────────────────
# Background Processing Task
# ──────────────────────────────────────────────────────────────────────────────

async def process_video_stream():
    """
    Background worker that reads the current video frame-by-frame and pushes
    it through the agentic pipeline.
    """
    if not app_state.current_video_path or not os.path.exists(app_state.current_video_path):
        app_state.is_processing = False
        return

    cap = cv2.VideoCapture(app_state.current_video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_idx = 0
    
    print(f"[Worker] Starting processing on {app_state.current_video_path} at {fps} FPS")
    
    while app_state.is_processing and cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break  # End of video
            
        timestamp_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
        frame_idx += 1
        
        # Store raw frame
        app_state.latest_frame = frame.copy()
        
        # Only run pipeline if at least detection is enabled
        if app_state.enable_detection:
            # We bypass the full workflow object here and invoke nodes manually 
            # if we need to respect the enable_tracking toggle.
            # But the prompt asks to "Start Tracking" / "Start Detection".
            # For simplicity, we run the detector and optionally the tracker.
            
            if app_state.enable_tracking:
                track_result = app_state.tracker.track_frame(frame, camera_id="UPLOAD", timestamp_ms=timestamp_ms)
                detections = track_result.detections
                trajectories = track_result.trajectories
                
                # Analysis requires tracking
                events = app_state.counter.update(detections, frame_idx)
                metrics = app_state.analyser.update(
                    detections, trajectories, events, frame_idx, timestamp_ms
                )
                app_state.latest_metrics = metrics.to_dict()
                
                # Prediction (update every N frames to save CPU)
                if frame_idx % int(fps) == 0:
                    hist = app_state.analyser.get_history(as_dicts=True)
                    app_state.latest_forecast = app_state.predictor.predict_live(hist)
            else:
                det_result = app_state.detector.detect(
                    frame,
                    frame_index=frame_idx,
                    timestamp_ms=timestamp_ms,
                    camera_id="UPLOAD"
                )
                detections = det_result.detections
                trajectories = []
                    
        # Sleep to simulate real-time processing and yield to event loop
        await asyncio.sleep(1.0 / fps)
        
    cap.release()
    app_state.is_processing = False
    print("[Worker] Processing finished or stopped.")


# ──────────────────────────────────────────────────────────────────────────────
# Lifespan Event Handler & FastAPI Application
# ──────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[System] Initialising backend modules...")
    try:
        init_db()
    except Exception as db_err:
        print(f"[System] Database initialization note: {db_err}")

    # initialize detector
    app_state.detector = Detector(weights="yolo11n.pt", conf=0.25).load()

    # initialize tracker
    app_state.tracker = Tracker(weights="yolo11n.pt", conf=0.25, tracker_config="bytetrack.yaml").load()
    lines = [
        LineConfig(name="L1", p1=(0.1, 0.5), p2=(0.9, 0.5), direction="both")
    ]
    app_state.counter = VehicleCounter(lines=lines)

    # initialize analyser
    app_state.analyser = TrafficAnalyser(AnalysisConfig(fps=30.0))
    app_state.predictor = CongestionPredictor(TFTConfig())
    try:
        app_state.predictor = CongestionPredictor.load("models/tft")
        print("[System] Trained TFT model loaded successfully.")
    except Exception:
        try:
            app_state.predictor = CongestionPredictor.load("backend/models/tft")
            print("[System] Trained TFT model loaded successfully.")
        except Exception:
            print("[System] No trained TFT model found — heuristic fallback active.")
            try:
                app_state.predictor.build()
            except Exception:
                pass

    # initialize route planner
    app_state.route_planner = RoutePlanner(RouteConfig())
    context = WorkflowContext(
        detector=app_state.detector,
        tracker=app_state.tracker,
        counter=app_state.counter,
        analyser=app_state.analyser,
        predictor=app_state.predictor,
        route_planner=app_state.route_planner
    )
    app_state.workflow = TrafficWorkflow(context, llm=None)

    # initialize database
    # File-backed audit logging and persistent storage active via alert_audit_manager
    try:
        if not alert_audit_manager.get_active_alerts():
            alert_audit_manager.generate_alerts_from_metrics(
                junction_name="Sankagiri Junction",
                camera_id="CAM001",
                approach_name="North: NH544 Salem Inflow",
                metrics={
                    "congestion_score": 0.86,
                    "average_speed_kmh": 9.2,
                    "vehicle_count": 42,
                },
                diversion_plan_id="DIV_APP_NORTH"
            )
    except Exception as e:
        print(f"[System] Alert initialization note: {e}")

    # initialize redis
    # High-speed in-memory state and cache active via app_state

    # Initialize road graph (cached graph or default Tamil Nadu road network in background)
    try:
        t = threading.Thread(target=_load_route_graph_thread, daemon=True)
        t.start()
    except Exception as e:
        print(f"[System] Warning loading route planner thread: {e}")

    print("[System] Backend ready")

    yield

    print("[System] Shutting down...")
    app_state.is_processing = False


def initialize_backend():
    """Manual sync initialization for testing or standalone execution."""
    app_state.detector = Detector(weights="yolo11n.pt", conf=0.25).load()
    app_state.tracker = Tracker(weights="yolo11n.pt", conf=0.25, tracker_config="bytetrack.yaml").load()
    lines = [LineConfig(name="L1", p1=(0.1, 0.5), p2=(0.9, 0.5), direction="both")]
    app_state.counter = VehicleCounter(lines=lines)
    app_state.analyser = TrafficAnalyser(AnalysisConfig(fps=30.0))
    app_state.predictor = CongestionPredictor(TFTConfig())
    try:
        app_state.predictor = CongestionPredictor.load("models/tft")
        print("[System] Trained TFT model loaded successfully.")
    except Exception:
        try:
            app_state.predictor = CongestionPredictor.load("backend/models/tft")
            print("[System] Trained TFT model loaded successfully.")
        except Exception:
            print("[System] No trained TFT model found — heuristic fallback active.")
            try:
                app_state.predictor.build()
            except Exception:
                pass
    app_state.route_planner = RoutePlanner(RouteConfig())
    try:
        app_state.route_planner.load()
    except Exception:
        pass
    context = WorkflowContext(
        detector=app_state.detector,
        tracker=app_state.tracker,
        counter=app_state.counter,
        analyser=app_state.analyser,
        predictor=app_state.predictor,
        route_planner=app_state.route_planner
    )
    app_state.workflow = TrafficWorkflow(context, llm=None)


app = FastAPI(
    title="Smart Traffic Control Room API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS config for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health API Endpoint ──
@app.get("/api/health")
async def health_check():
    """System health check endpoint verifying detector, tracker, route_engine, database, and redis."""
    db_ok = False
    try:
        db = SessionLocal()
        db.query(JunctionModel).first()
        db.close()
        db_ok = True
    except Exception:
        db_ok = False

    redis_ok = redis_client.health_check()
    detector_ok = app_state.detector is not None
    tracker_ok = app_state.tracker is not None
    route_engine_ok = app_state.route_planner is not None

    overall = "ok" if (detector_ok or tracker_ok or db_ok) else "degraded"

    lan_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        lan_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    return {
        "status": overall,
        "detector": detector_ok,
        "tracker": tracker_ok,
        "route_engine": route_engine_ok,
        "database": db_ok,
        "redis": redis_ok,
        "lan_ip": lan_ip,
        "frontend_port": 5173,
        "backend_port": 8000,
        "mobile_access_url": f"http://{lan_ip}:5173",
        "mobile_camera_url": f"http://{lan_ip}:5173/#/mobile-camera"
    }


# ── System Network & LAN Info ──
@app.get("/api/system/network")
async def get_network_info():
    """Return host LAN IPv4 address and direct mobile access URLs."""
    lan_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        lan_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    return {
        "lan_ip": lan_ip,
        "backend_port": 8000,
        "frontend_port": 5173,
        "dashboard_url": f"http://{lan_ip}:5173",
        "mobile_camera_url": f"http://{lan_ip}:5173/#/mobile-camera",
        "api_base": f"http://{lan_ip}:8000/api"
    }


# ── Current Location Geolocation Endpoint ──
@app.get("/api/current-location")
async def get_current_location():
    """
    Detect the operational center's current location via IP/network geocoding,
    falling back to known Tamil Nadu operational center if network lookup fails.
    """
    import urllib.request
    import json

    try:
        req = urllib.request.Request(
            "http://ip-api.com/json",
            headers={"User-Agent": "TamilNaduTrafficControl/1.0"}
        )
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("status") == "success" and data.get("lat") and data.get("lon"):
                city = data.get("city") or "Tirupur"
                region = data.get("regionName") or "Tamil Nadu"
                return {
                    "status": "success",
                    "lat": float(data["lat"]),
                    "lon": float(data["lon"]),
                    "city": city,
                    "district": city,
                    "region": region,
                    "name": f"{city}, {region}",
                    "source": "ip-network"
                }
    except Exception as e:
        print(f"[Location] IP lookup note: {e}")

    return {
        "status": "success",
        "lat": 11.1067,
        "lon": 77.3545,
        "city": "Tirupur",
        "district": "Tirupur",
        "region": "Tamil Nadu",
        "name": "Tirupur, Tamil Nadu",
        "source": "control-station"
    }


# ── Available Sample Videos ──
@app.get("/api/videos")
async def list_available_videos():
    """List pre-loaded video samples from datasets/videos."""
    video_dir = Path(__file__).parent.parent / "datasets" / "videos"
    videos = []
    if video_dir.exists():
        for f in video_dir.glob("*.mp4"):
            videos.append({
                "filename": f.name,
                "path": str(f),
                "size_mb": round(f.stat().st_size / (1024 * 1024), 2)
            })
    return {"videos": videos}


# ── Ingest Live Frame from Mobile / PC Browser (HTTP POST) ──
@app.post("/api/cameras/{camera_id}/frame")
async def ingest_camera_frame(camera_id: str, request: Request):
    """Ingest a live JPEG frame sent from a mobile browser or webcam."""
    model = camera_registry.get(camera_id)
    if not model:
        # Auto-create mobile/webcam camera if not registered
        payload = CameraCreatePayload(
            camera_id=camera_id,
            name=f"Live Camera ({camera_id})",
            location="Mobile Field Unit",
            road="Live Corridor Stream",
            source_type="mobile",
            source="browser_push"
        )
        model = camera_registry.create(payload)

    worker = camera_registry.get_worker(model.camera_id)
    if not worker or not worker.thread or not worker.thread.is_alive():
        worker = camera_registry.start_worker(model.camera_id, app_state.detector, app_state.predictor, app_state.route_planner)

    body = await request.body()
    if body:
        worker.push_frame(body)
        return {"status": "ok", "bytes_received": len(body), "camera_id": model.camera_id}
    return JSONResponse(status_code=400, content={"error": "Empty frame body"})


# ── Ingest Live Frames via WebSocket (Low Latency) ──
@app.websocket("/ws/cameras/{camera_id}/ingest")
async def websocket_camera_ingest(websocket: WebSocket, camera_id: str):
    """WebSocket stream ingestion for mobile phone camera frames."""
    await websocket.accept()
    model = camera_registry.get(camera_id)
    if not model:
        payload = CameraCreatePayload(
            camera_id=camera_id,
            name=f"Live Camera ({camera_id})",
            location="Mobile Field Unit",
            road="Live Corridor Stream",
            source_type="mobile",
            source="browser_push"
        )
        model = camera_registry.create(payload)

    worker = camera_registry.get_worker(model.camera_id)
    if not worker or not worker.thread or not worker.thread.is_alive():
        worker = camera_registry.start_worker(model.camera_id, app_state.detector, app_state.predictor, app_state.route_planner)

    try:
        while True:
            data = await websocket.receive_bytes()
            if data and worker:
                worker.push_frame(data)
                # Send back latest telemetry
                tel = worker.latest_telemetry or {}
                await websocket.send_json({
                    "status": "received",
                    "vehicles": tel.get("vehicle_count", 0),
                    "speed": tel.get("average_speed_kmh", 0),
                    "congestion": tel.get("congestion_score", 0)
                })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WebSocket Ingest Error {camera_id}]: {e}")


# ── 1. /upload-video ──
@app.post("/api/upload-video")
async def upload_video(file: UploadFile = File(...)):
    """Upload a traffic video file to the server."""
    upload_dir = Path(__file__).parent.parent / "datasets" / "videos"
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = upload_dir / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    app_state.current_video_path = str(file_path)
    
    # Reset state for new video
    if app_state.tracker: app_state.tracker.reset()
    if app_state.analyser: app_state.analyser.reset()
    app_state.latest_metrics = {}
    app_state.latest_forecast = {}
    app_state.is_processing = False
    
    return {"message": "Video uploaded successfully", "path": str(file_path)}


# ── 2. /start-detection ──

class ToggleRequest(BaseModel):
    enable: bool

@app.post("/api/start-detection")
async def start_detection(req: ToggleRequest, background_tasks: BackgroundTasks):
    """Enable detection and start processing the video if not already running."""
    if not app_state.current_video_path:
        raise HTTPException(status_code=400, detail="Please upload a video first.")
        
    app_state.enable_detection = req.enable
    
    if req.enable and not app_state.is_processing:
        app_state.is_processing = True
        background_tasks.add_task(process_video_stream)
        
    return {"message": f"Detection {'started' if req.enable else 'stopped'}."}


# ── 3. /start-tracking ──

@app.post("/api/start-tracking")
async def start_tracking(req: ToggleRequest):
    """Enable ByteTrack object tracking and downstream analysis."""
    if req.enable and not app_state.enable_detection:
        raise HTTPException(status_code=400, detail="Must start detection before tracking.")
        
    app_state.enable_tracking = req.enable
    return {"message": f"Tracking {'started' if req.enable else 'stopped'}."}


# ── 4. /get-traffic-stats ──

@app.get("/api/get-traffic-stats")
async def get_traffic_stats():
    """Return the latest frame metrics (count, density, speed, flow, score)."""
    return {
        "is_processing": app_state.is_processing,
        "metrics": app_state.latest_metrics
    }


# ── 5. /predict-congestion ──

class PredictTelemetryRequest(BaseModel):
    camera_id: Optional[str] = None
    history: Optional[List[dict]] = None

@app.api_route("/api/predict-congestion", methods=["GET", "POST"])
async def predict_congestion(
    camera_id: Optional[str] = None,
    payload: Optional[PredictTelemetryRequest] = None
):
    """
    Return the latest Temporal Fusion Transformer (TFT) forecast across active cameras or stream.
    If no live camera telemetry is currently available, reports that live telemetry is unavailable.
    """
    target_history = None
    source_label = None

    # 0. Check if history is explicitly provided in request payload
    if payload and payload.history:
        target_history = payload.history
        source_label = f"payload_{payload.camera_id or 'custom'}"
    elif payload and payload.camera_id:
        camera_id = payload.camera_id

    # 1. If global stream forecast is available and valid, use it
    if not target_history and app_state.latest_forecast and any(k in app_state.latest_forecast for k in ["5min", "15min", "30min"]):
        return {
            "status": "ok",
            "telemetry_available": True,
            "source": "global_stream",
            "forecast": app_state.latest_forecast
        }

    # 2. Check active camera workers in camera_registry
    if not target_history:
        if camera_id:
            worker = camera_registry.get_worker(camera_id)
            if worker and worker.is_running and worker.analyser:
                h = worker.analyser.get_history(as_dicts=True)
                if h and len(h) > 0:
                    target_history = h
                    source_label = f"camera_{camera_id}"
        else:
            for cam in camera_registry.get_all():
                w = camera_registry.get_worker(cam.camera_id)
                if w and w.is_running and w.analyser:
                    h = w.analyser.get_history(as_dicts=True)
                    if h and len(h) > 0:
                        target_history = h
                        source_label = f"camera_{cam.camera_id}"
                        break

    # 3. Check video stream analyser
    if not target_history and app_state.is_processing and app_state.analyser:
        h = app_state.analyser.get_history(as_dicts=True)
        if h and len(h) > 0:
            target_history = h
            source_label = "video_stream"

    # 4. If genuine telemetry history was found, run live inference via TFT
    if target_history:
        if not app_state.predictor:
            try:
                app_state.predictor = CongestionPredictor.load("models/tft")
            except Exception:
                try:
                    app_state.predictor = CongestionPredictor.load("backend/models/tft")
                except Exception:
                    pass
        if app_state.predictor:
            forecast_data = app_state.predictor.predict_live(target_history)
        # Ensure 1hr and 2hr extrapolations exist for dashboard charts
        if "15min" in forecast_data and "1hr" not in forecast_data:
            base_30 = forecast_data.get("30min", forecast_data["15min"])
            q50_30 = base_30.get("q50", 0.55)
            forecast_data["1hr"] = {
                "q10": round(max(0.05, q50_30 - 0.15), 3),
                "q50": round(min(0.95, q50_30 + 0.05), 3),
                "q90": round(min(0.99, q50_30 + 0.20), 3),
                "level_q50": "HEAVY" if q50_30 >= 0.55 else "MODERATE",
                "uncertain": True
            }
            forecast_data["2hr"] = {
                "q10": round(max(0.05, q50_30 - 0.25), 3),
                "q50": round(max(0.20, q50_30 - 0.10), 3),
                "q90": round(min(0.99, q50_30 + 0.12), 3),
                "level_q50": "MODERATE",
                "uncertain": True
            }
        return {
            "status": "ok",
            "telemetry_available": True,
            "source": source_label,
            "forecast": forecast_data
        }

    # 5. If no live camera telemetry is currently available, report clearly
    return {
        "status": "unavailable",
        "message": "No live camera telemetry currently active. Start camera feed or upload video to begin live forecasting.",
        "telemetry_available": False,
        "forecast": None
    }


# ── 6. /get-route ──

class RouteRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float

@app.post("/api/get-route")
async def get_route(req: RouteRequest):
    """
    Run the Route Agent (A* search).
    Uses the latest congestion forecast to dynamically penalise congested edges.
    """
    if not app_state.route_planner or not app_state.route_planner._is_loaded:
        raise HTTPException(
            status_code=503,
            detail="Road network graph is currently initializing. Please try again in a few seconds."
        )
        
    # Get comparison of Distance vs Congestion vs Forecast strategies
    comparison = app_state.route_planner.find_route_comparison(
        origin=(req.origin_lat, req.origin_lon),
        destination=(req.dest_lat, req.dest_lon)
    )
    
    return comparison


# ── 6b. /get-route-by-name ──

class RouteByNameRequest(BaseModel):
    from_name: str
    to_name: str
    from_lat: Optional[float] = None
    from_lon: Optional[float] = None
    to_lat: Optional[float] = None
    to_lon: Optional[float] = None

@app.post("/api/get-route-by-name")
async def get_route_by_name(req: RouteByNameRequest):
    """
    Compute congestion-aware A* route comparison between two named locations in Tamil Nadu.
    """
    if not app_state.route_planner or not app_state.route_planner._is_loaded:
        raise HTTPException(
            status_code=503,
            detail="Road network graph is currently initializing. Please try again in a few seconds."
        )
        
    # Resolve from coordinates
    origin = None
    if req.from_lat is not None and req.from_lon is not None:
        origin = (req.from_lat, req.from_lon)
    elif req.from_name in LOCATIONS:
        origin = LOCATIONS[req.from_name]
    else:
        for k, v in LOCATIONS.items():
            if req.from_name.lower() in k.lower() or k.lower() in req.from_name.lower():
                origin = v
                break
    
    # Resolve to coordinates
    destination = None
    if req.to_lat is not None and req.to_lon is not None:
        destination = (req.to_lat, req.to_lon)
    elif req.to_name in LOCATIONS:
        destination = LOCATIONS[req.to_name]
    else:
        for k, v in LOCATIONS.items():
            if req.to_name.lower() in k.lower() or k.lower() in req.to_name.lower():
                destination = v
                break

    if not origin:
        origin = LOCATIONS.get("Salem Bus Stand", (11.6643, 78.1460))
    if not destination:
        destination = LOCATIONS.get("Erode Bus Stand", (11.3410, 77.7172))

    comparison = app_state.route_planner.find_route_comparison(origin=origin, destination=destination)
    return comparison





# ──────────────────────────────────────────────────────────────────────────────
# NEW ENDPOINTS — Tamil Nadu Location & Multi-Camera Support
# All endpoints below are ADDITIONS. Nothing above is modified.
# ──────────────────────────────────────────────────────────────────────────────

# ── 7. /locations ──

@app.get("/api/locations")
async def get_locations():
    """Return all Tamil Nadu locations available for route search."""
    return {
        "locations": [
            {"name": name, "lat": lat, "lon": lon}
            for name, (lat, lon) in LOCATIONS.items()
        ]
    }


# ──────────────────────────────────────────────────────────────────────────────
# JUNCTION & LOCATION SEARCH APIs (Database Driven)
# ──────────────────────────────────────────────────────────────────────────────

class JunctionCreatePayload(BaseModel):
    junction_id: Optional[str] = None
    name: str
    district: Optional[str] = "Salem"
    state: Optional[str] = "Tamil Nadu"
    latitude: float
    longitude: float


class JunctionUpdatePayload(BaseModel):
    name: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@app.get("/api/junctions")
async def get_junctions():
    """List all registered junctions from database."""
    db = SessionLocal()
    try:
        junctions = db.query(JunctionModel).all()
        return {"junctions": [j.to_dict() for j in junctions]}
    finally:
        db.close()


@app.post("/api/junctions")
async def create_junction(payload: JunctionCreatePayload):
    """Create a new junction record in database."""
    db = SessionLocal()
    try:
        jid = payload.junction_id or f"JUNC_{payload.name.upper().replace(' ', '_')}_{int(time.time())}"
        junction = JunctionModel(
            junction_id=jid,
            name=payload.name,
            district=payload.district or "Salem",
            state=payload.state or "Tamil Nadu",
            latitude=payload.latitude,
            longitude=payload.longitude
        )
        db.add(junction)
        db.commit()
        db.refresh(junction)
        return {"message": "Junction created successfully.", "junction": junction.to_dict()}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create junction: {e}")
    finally:
        db.close()


@app.get("/api/junctions/{junction_id}")
async def get_junction_by_id(junction_id: str):
    """Get single junction details by ID or name."""
    db = SessionLocal()
    try:
        junc = db.query(JunctionModel).filter(
            (JunctionModel.junction_id == junction_id) | (JunctionModel.name.ilike(f"%{junction_id}%"))
        ).first()
        if not junc:
            raise HTTPException(status_code=404, detail=f"Junction '{junction_id}' not found.")
        return junc.to_dict()
    finally:
        db.close()


@app.put("/api/junctions/{junction_id}")
async def update_junction(junction_id: str, payload: JunctionUpdatePayload):
    """Update junction metadata in database."""
    db = SessionLocal()
    try:
        junc = db.query(JunctionModel).filter(JunctionModel.junction_id == junction_id).first()
        if not junc:
            raise HTTPException(status_code=404, detail=f"Junction '{junction_id}' not found.")

        if payload.name is not None: junc.name = payload.name
        if payload.district is not None: junc.district = payload.district
        if payload.state is not None: junc.state = payload.state
        if payload.latitude is not None: junc.latitude = payload.latitude
        if payload.longitude is not None: junc.longitude = payload.longitude

        db.commit()
        db.refresh(junc)
        return {"message": "Junction updated successfully.", "junction": junc.to_dict()}
    finally:
        db.close()


@app.delete("/api/junctions/{junction_id}")
async def delete_junction(junction_id: str):
    """Delete a junction and its associated camera records from database."""
    db = SessionLocal()
    try:
        junc = db.query(JunctionModel).filter(JunctionModel.junction_id == junction_id).first()
        if not junc:
            raise HTTPException(status_code=404, detail=f"Junction '{junction_id}' not found.")

        db.delete(junc)
        db.commit()
        return {"message": f"Junction '{junction_id}' deleted successfully."}
    finally:
        db.close()


@app.get("/api/junctions/{junction_id}/cameras")
async def get_junction_cameras(junction_id: str):
    """Get all cameras associated with a specific junction from database merged with real worker status."""
    db = SessionLocal()
    try:
        junc = db.query(JunctionModel).filter(
            (JunctionModel.junction_id == junction_id) | (JunctionModel.name.ilike(f"%{junction_id}%"))
        ).first()
        
        target_jid = junc.junction_id if junc else junction_id
        cameras_db = db.query(CameraModelDB).filter(CameraModelDB.junction_id == target_jid).all()
        
        results = []
        for cam in cameras_db:
            c_dict = cam.to_dict()
            worker = camera_registry.get_worker(cam.camera_code)
            reg_model = camera_registry.get(cam.camera_code)
            if reg_model:
                c_dict["status"] = reg_model.status.upper()
            if worker:
                c_dict["metrics"] = worker.latest_metrics
                c_dict["detections"] = worker.latest_detections.get("detections", [])
            results.append(c_dict)

        return {"junction_id": target_jid, "cameras": results}
    finally:
        db.close()


@app.get("/api/locations/search")
async def search_locations(q: str = ""):
    """Search database junctions and Tamil Nadu locations matching query q."""
    if not q or len(q.strip()) == 0:
        db = SessionLocal()
        try:
            junctions = db.query(JunctionModel).all()
            return {"locations": [j.to_dict() for j in junctions]}
        finally:
            db.close()

    query_str = q.strip().lower()
    db = SessionLocal()
    matches = []
    try:
        db_juncs = db.query(JunctionModel).filter(
            (JunctionModel.name.ilike(f"%{query_str}%")) |
            (JunctionModel.district.ilike(f"%{query_str}%")) |
            (JunctionModel.state.ilike(f"%{query_str}%"))
        ).all()

        for j in db_juncs:
            matches.append({
                "id": j.junction_id,
                "junction_id": j.junction_id,
                "name": f"{j.name}, {j.district}, {j.state}",
                "junction_name": j.name,
                "district": j.district,
                "state": j.state,
                "lat": j.latitude,
                "lon": j.longitude,
                "source": "database"
            })
    finally:
        db.close()

    # Fallback search in static LOCATIONS dictionary if not already matched
    for name, (lat, lon) in LOCATIONS.items():
        if query_str in name.lower():
            if not any(m.get("junction_name", "").lower() == name.lower() for m in matches):
                matches.append({
                    "id": f"LOC_{name.upper().replace(' ', '_')}",
                    "name": f"{name}, Tamil Nadu",
                    "junction_name": name,
                    "district": "Tamil Nadu",
                    "state": "Tamil Nadu",
                    "lat": lat,
                    "lon": lon,
                    "source": "locations_config"
                })

    return {"query": q, "locations": matches}


# ── Per-camera state compatibility helper ──
_camera_states: dict = {}

def _get_camera_state(cam_id: str) -> dict:
    """Helper bridging camera_registry with existing dashboard / aggregation helpers."""
    model = camera_registry.get(cam_id)
    if model:
        worker = camera_registry.get_worker(model.camera_id)
        if worker:
            return {
                "status": model.status.upper(),
                "metrics": worker.latest_metrics,
                "forecast": {},
                "analyser": worker.analyser,
                "latest_frame_jpeg": worker.latest_jpeg
            }
        return {
            "status": model.status.upper(),
            "metrics": {
                "camera_id": model.camera_id,
                "status": model.status,
                "fps": 0,
                "vehicles": {"car": 0, "truck": 0, "bus": 0, "bike": 0},
                "total": 0,
                "average_speed": None,
                "congestion_score": 0
            },
            "forecast": {},
            "analyser": None,
            "latest_frame_jpeg": None
        }
    if cam_id not in _camera_states:
        _camera_states[cam_id] = {
            "status": "OFFLINE",
            "metrics": {},
            "forecast": {},
            "analyser": None,
        }
    return _camera_states[cam_id]


def _resolve_camera(cam_id: str):
    model = camera_registry.get(cam_id)
    if model:
        return model.to_dict()
    for cam in CAMERAS:
        if cam["camera_id"].upper() == cam_id.upper():
            return cam
    return None


# ──────────────────────────────────────────────────────────────────────────────
# CAMERA APIs (Multi-Camera Management Layer)
# ──────────────────────────────────────────────────────────────────────────────

# ── 1. GET /api/cameras ──
@app.get("/api/cameras")
async def get_cameras():
    """List all registered cameras with their current status and metrics."""
    models = camera_registry.get_all()
    cams = []
    for m in models:
        worker = camera_registry.get_worker(m.camera_id)
        m_dict = m.to_dict()
        if worker:
            m_dict["metrics"] = worker.latest_metrics
            m_dict["telemetry"] = worker.latest_telemetry
            m_dict["forecast"] = worker.latest_forecast
            m_dict["detections"] = worker.latest_detections.get("detections", [])
        cams.append(m_dict)
    return {"cameras": cams}


# ── 2. POST /api/cameras ──
@app.post("/api/cameras")
async def create_camera(payload: CameraCreatePayload):
    """Create / Register a new camera source."""
    model = camera_registry.create(payload)
    return {"message": "Camera created successfully.", "camera": model.to_dict()}


# ── 2b. GET /api/cameras/aggregate ──
@app.get("/api/cameras/aggregate")
async def get_cameras_aggregate():
    """
    Aggregate real-time metrics across all active cameras.
    Used by the Dashboard KPI cards and TrafficAnalytics page.

    Returns:
        total_vehicles      : Sum of vehicle_count across all active cameras
        avg_speed_kmh       : Mean average_speed_kmh across active cameras
        avg_congestion_score: Mean congestion_score across active cameras
        active_camera_count : Number of cameras currently processing
        class_counts        : Aggregated per-class vehicle counts (car/truck/bus/motorcycle)
        per_camera          : Per-camera breakdown list
    """
    per_camera = []
    total_vehicles = 0
    speed_sum = 0.0
    score_sum = 0.0
    active_count = 0
    class_totals: dict = {"car": 0, "truck": 0, "bus": 0, "motorcycle": 0}

    for cam in CAMERAS:
        cid = cam["camera_id"]
        state = _get_camera_state(cid)
        m = state.get("metrics", {})

        is_active = state.get("status") == "ONLINE"
        count = m.get("vehicle_count", 0)
        speed = m.get("average_speed_kmh", 0.0)
        score = m.get("congestion_score", 0.0)
        level = m.get("congestion_level", "FREE_FLOW")
        cc    = m.get("class_counts", {})

        if is_active and m:
            active_count += 1
            total_vehicles += count
            speed_sum += speed
            score_sum += score
            for cls in class_totals:
                class_totals[cls] += cc.get(cls, 0)

        per_camera.append({
            "id":                cam["camera_id"],
            "name":              cam["camera_name"],
            "status":            state.get("status", "OFFLINE"),
            "vehicle_count":     count,
            "average_speed_kmh": round(speed, 1),
            "congestion_score":  round(score, 3),
            "congestion_level":  level,
            "class_counts":      cc,
        })

    avg_speed = round(speed_sum / active_count, 1) if active_count > 0 else 0.0
    avg_score = round(score_sum / active_count, 3) if active_count > 0 else 0.0

    return {
        "active_camera_count":  active_count,
        "total_vehicles":       total_vehicles,
        "avg_speed_kmh":        avg_speed,
        "avg_congestion_score": avg_score,
        "class_counts":         class_totals,
        "per_camera":           per_camera,
    }


# ── 3. GET /api/cameras/{camera_id} ──
@app.get("/api/cameras/{camera_id}")
async def get_camera_by_id(camera_id: str):
    """Get details of a specific camera."""
    model = camera_registry.get(camera_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")
    m_dict = model.to_dict()
    worker = camera_registry.get_worker(model.camera_id)
    if worker:
        m_dict["metrics"] = worker.latest_metrics
        m_dict["telemetry"] = worker.latest_telemetry
        m_dict["forecast"] = worker.latest_forecast
        m_dict["detections"] = worker.latest_detections.get("detections", [])
    return m_dict


# ── 4. PUT /api/cameras/{camera_id} ──
@app.put("/api/cameras/{camera_id}")
async def update_camera(camera_id: str, payload: CameraUpdatePayload):
    """Update camera configuration."""
    model = camera_registry.update(camera_id, payload)
    if not model:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")
    return {"message": f"Camera '{model.camera_id}' updated successfully.", "camera": model.to_dict()}


# ── 5. DELETE /api/cameras/{camera_id} ──
@app.delete("/api/cameras/{camera_id}")
async def delete_camera(camera_id: str):
    """Delete a camera from the registry."""
    success = camera_registry.delete(camera_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")
    return {"message": f"Camera '{camera_id}' deleted successfully."}


# ── 6. POST /api/cameras/{camera_id}/start ──
@app.post("/api/cameras/{camera_id}/start")
@app.post("/api/camera/{camera_id}/start")
async def start_camera_endpoint(camera_id: str, request: Request = None):
    """Start background processing thread for a specific camera feed."""
    try:
        video = None
        source = None
        source_type = None
        auto_analysis = None
        if request:
            try:
                body = await request.json()
                if isinstance(body, dict):
                    video = body.get("video")
                    source = body.get("source")
                    source_type = body.get("source_type")
                    if "auto_analysis" in body:
                        auto_analysis = bool(body.get("auto_analysis"))
            except Exception:
                pass

        if source:
            src_str = str(source).strip()
            if source_type == "rtsp" or src_str.lower().startswith(("rtsp://", "rtsps://")):
                source_type = "rtsp"
                if not (src_str.lower().startswith("rtsp://") or src_str.lower().startswith("rtsps://")):
                    raise HTTPException(status_code=400, detail="Invalid RTSP URL. Must begin with rtsp://")

        model = camera_registry.start_camera(
            camera_id,
            detector=app_state.detector,
            predictor=app_state.predictor,
            route_planner=app_state.route_planner,
            source=source,
            source_type=source_type,
            video=video,
            auto_analysis=auto_analysis,
        )

        # For network RTSP cameras, wait up to 8.0s for initial connection verification
        if model.source_type.lower() in ["ip", "rtsp"]:
            worker = camera_registry.get_worker(model.camera_id)
            t0 = time.time()
            while time.time() - t0 < 8.0:
                if model.status in ["online", "error"]:
                    break
                await asyncio.sleep(0.2)

            if model.status == "error":
                raise HTTPException(
                    status_code=400,
                    detail=model.error_message or "Unable to connect to video feed"
                )

        return {"message": f"Camera '{model.camera_id}' ({model.name}) started successfully.", "camera": model.to_dict()}
    except HTTPException:
        raise
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start camera '{camera_id}': {e}")


# ── 6b. POST /api/cameras/{camera_id}/start-analysis ──
@app.post("/api/cameras/{camera_id}/start-analysis")
@app.post("/api/camera/{camera_id}/start-analysis")
async def start_camera_analysis_endpoint(camera_id: str):
    """Start YOLO11 + ByteTrack detection and tracking on an active camera stream."""
    try:
        model = camera_registry.start_analysis(camera_id)
        return {"message": f"Analysis started for camera '{model.camera_id}'.", "camera": model.to_dict()}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found or not running.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start analysis for '{camera_id}': {e}")


# ── 6c. POST /api/cameras/{camera_id}/stop-analysis ──
@app.post("/api/cameras/{camera_id}/stop-analysis")
@app.post("/api/camera/{camera_id}/stop-analysis")
async def stop_camera_analysis_endpoint(camera_id: str):
    """Stop detection analysis while preserving camera connection and stream."""
    try:
        model = camera_registry.stop_analysis(camera_id)
        return {"message": f"Analysis stopped for camera '{model.camera_id}'.", "camera": model.to_dict()}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found or not running.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop analysis for '{camera_id}': {e}")


# ── 7. POST /api/cameras/{camera_id}/stop ──
@app.post("/api/cameras/{camera_id}/stop")
@app.post("/api/camera/{camera_id}/stop")
async def stop_camera_endpoint(camera_id: str):
    """Stop processing a camera feed and release hardware/network resources."""
    try:
        model = camera_registry.stop_camera(camera_id)
        return {"message": f"Camera '{model.camera_id}' stopped.", "camera": model.to_dict()}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")


# ── 8. POST /api/cameras/upload ──
@app.post("/api/cameras/upload")
async def upload_camera_video(file: UploadFile = File(...), camera_name: Optional[str] = None):
    """Upload MP4 video file and register it as a simulated live CCTV camera source."""
    upload_dir = Path(__file__).parent.parent / "datasets" / "videos"
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = upload_dir / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    name = camera_name or f"Simulated CCTV ({file.filename})"
    payload = CameraCreatePayload(
        name=name,
        location="Uploaded Video Feed",
        road="Simulated Corridor",
        source_type="video",
        source=str(file_path)
    )
    model = camera_registry.create(payload)
    app_state.current_video_path = str(file_path)

    return {
        "message": "Video uploaded successfully. Registered as camera source.",
        "path": str(file_path),
        "camera_id": model.camera_id,
        "camera": model.to_dict()
    }


# ── 9. GET /api/cameras/{camera_id}/stream ──
@app.get("/api/cameras/{camera_id}/stream")
@app.get("/api/camera/{camera_id}/feed")
async def stream_camera(camera_id: str):
    """Stream live annotated MJPEG video feed with YOLO11 boxes and ByteTrack IDs."""
    model = camera_registry.get(camera_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")

    worker = camera_registry.get_worker(model.camera_id)
    if not worker or model.status not in ["starting", "online"]:
        raise HTTPException(status_code=503, detail="Camera feed not running or unavailable.")

    # Wait up to 3.0s for the first frame to become available if starting
    t_wait = 0.0
    while worker.latest_jpeg is None and model.status in ["starting", "online"] and t_wait < 3.0:
        await asyncio.sleep(0.1)
        t_wait += 0.1

    if worker.latest_jpeg is None and model.status in ["error", "disconnected"]:
        raise HTTPException(status_code=503, detail=model.error_message or "Camera feed unavailable.")

    async def _mjpeg_generator():
        consecutive_idle = 0
        while model.status in ["starting", "online"] and worker is not None and not worker.stop_event.is_set():
            jpeg_bytes = worker.latest_jpeg
            if jpeg_bytes is not None:
                consecutive_idle = 0
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + jpeg_bytes + b"\r\n"
                )
            else:
                consecutive_idle += 1
                if consecutive_idle > 150:  # ~15 seconds without any frames
                    break
            await asyncio.sleep(0.033)

    return StreamingResponse(
        _mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


# ── 10. GET /api/cameras/{camera_id}/metrics ──
@app.get("/api/cameras/{camera_id}/metrics")
@app.get("/api/camera/{camera_id}/stats")
async def get_camera_metrics_endpoint(camera_id: str):
    """Return latest frame traffic metrics JSON."""
    model = camera_registry.get(camera_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")

    worker = camera_registry.get_worker(model.camera_id)
    if not worker:
        from datetime import datetime, timezone
        return {
            "camera_id": model.camera_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": model.status,
            "fps": 0.0,
            "vehicles": {"car": 0, "truck": 0, "bus": 0, "bike": 0},
            "total": 0,
            "average_speed": None,
            "congestion_score": 0
        }

    return worker.latest_metrics


# ── 11. GET /api/cameras/{camera_id}/detections ──
@app.get("/api/cameras/{camera_id}/detections")
async def get_camera_detections_endpoint(camera_id: str):
    """Return latest frame vehicle detections and ByteTrack track IDs."""
    model = camera_registry.get(camera_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")

    worker = camera_registry.get_worker(model.camera_id)
    if not worker:
        from datetime import datetime, timezone
        return {
            "camera_id": model.camera_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "detections": []
        }

    return worker.latest_detections


# ── 12. GET /api/cameras/{camera_id}/traffic ──
@app.get("/api/cameras/{camera_id}/traffic")
async def get_camera_live_traffic_endpoint(camera_id: str):
    """
    Retrieve high-frequency live traffic state from Redis key `traffic:camera:{camera_id}`.
    Fallback to worker in-memory state if Redis is offline.
    """
    model = camera_registry.get(camera_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")

    redis_state = redis_client.get_camera_state(model.camera_id)
    if redis_state:
        return {"camera_id": model.camera_id, "source": "redis", "data": redis_state}

    # Fallback to worker memory state
    worker = camera_registry.get_worker(model.camera_id)
    if worker:
        m = worker.latest_metrics
        vehicles = m.get("vehicles", {})
        return {
            "camera_id": model.camera_id,
            "source": "worker_memory",
            "data": {
                "status": model.status.lower(),
                "vehicles": m.get("total", 0),
                "cars": vehicles.get("car", 0),
                "trucks": vehicles.get("truck", 0),
                "buses": vehicles.get("bus", 0),
                "bikes": vehicles.get("bike", 0),
                "congestion": m.get("congestion_score", 0),
                "speed": m.get("speed", {}).get("value", 0.0),
                "timestamp": m.get("timestamp", datetime.now(timezone.utc).isoformat())
            }
        }

    return {
        "camera_id": model.camera_id,
        "source": "offline_default",
        "data": {
            "status": "offline",
            "vehicles": 0,
            "cars": 0,
            "trucks": 0,
            "buses": 0,
            "bikes": 0,
            "congestion": 0,
            "speed": 0.0,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    }


# ── 12b. GET /api/cameras/{camera_id}/telemetry ──
@app.get("/api/cameras/{camera_id}/telemetry")
@app.get("/api/camera/{camera_id}/telemetry")
async def get_camera_telemetry_endpoint(camera_id: str):
    """
    Return the latest genuine 6-feature telemetry values from the camera's TrafficAnalyser.
    Features: vehicle_count, vehicle_density, average_speed_kmh, traffic_flow_vpm, road_occupancy, congestion_score.
    """
    model = camera_registry.get(camera_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")

    worker = camera_registry.get_worker(model.camera_id)
    if not worker or not worker.thread or not worker.thread.is_alive():
        return {
            "status": model.status,
            "camera_id": model.camera_id,
            "is_analyzing": False,
            "message": model.error_message or f"Camera is {model.status}.",
            "telemetry": None
        }

    if model.status == "error":
        return {
            "status": "error",
            "camera_id": model.camera_id,
            "is_analyzing": False,
            "message": model.error_message or "Camera unavailable",
            "telemetry": None
        }

    if model.status == "disconnected":
        return {
            "status": "disconnected",
            "camera_id": model.camera_id,
            "is_analyzing": False,
            "message": model.error_message or "Camera disconnected",
            "telemetry": None
        }

    is_analyzing = getattr(worker, "is_analyzing", False)

    if model.status == "online" and not is_analyzing:
        return {
            "status": "online",
            "camera_id": model.camera_id,
            "is_analyzing": False,
            "message": "Camera stream is live. Analysis is on standby.",
            "telemetry": None
        }

    if model.status == "online" and (worker.latest_telemetry or worker.latest_metrics):
        tel = dict(worker.latest_telemetry) if worker.latest_telemetry else dict(worker.latest_metrics)
        if worker.latest_metrics:
            for k, v in worker.latest_metrics.items():
                if k not in tel:
                    tel[k] = v
        if "vehicles" in tel and isinstance(tel["vehicles"], dict):
            tel.setdefault("cars", tel["vehicles"].get("car", 0))
            tel.setdefault("trucks", tel["vehicles"].get("truck", 0))
            tel.setdefault("buses", tel["vehicles"].get("bus", 0))
            tel.setdefault("bikes", tel["vehicles"].get("bike", tel["vehicles"].get("motorcycle", 0)))
            tel.setdefault("vehicle_breakdown", tel["vehicles"])
        elif "class_counts" in tel and isinstance(tel["class_counts"], dict):
            tel.setdefault("cars", tel["class_counts"].get("car", 0))
            tel.setdefault("trucks", tel["class_counts"].get("truck", 0))
            tel.setdefault("buses", tel["class_counts"].get("bus", 0))
            tel.setdefault("bikes", tel["class_counts"].get("bike", tel["class_counts"].get("motorcycle", 0)))
            tel.setdefault("vehicles", tel["class_counts"])
            tel.setdefault("vehicle_breakdown", tel["class_counts"])
        return {
            "status": "online",
            "camera_id": model.camera_id,
            "is_analyzing": True,
            "telemetry": tel
        }

    return {
        "status": model.status,
        "camera_id": model.camera_id,
        "is_analyzing": is_analyzing,
        "message": "Camera worker initializing or feed not active.",
        "telemetry": None
    }


# ── 12c. GET /api/cameras/{camera_id}/forecast ──
@app.get("/api/cameras/{camera_id}/forecast")
@app.get("/api/camera/{camera_id}/forecast")
async def get_camera_forecast_endpoint(camera_id: str):
    """
    Return the Temporal Fusion Transformer (TFT) forecast for a specific camera.
    Clearly indicates whether forecast is 'trained_tft', 'heuristic_fallback', or 'unavailable'.
    """
    model = camera_registry.get(camera_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")

    worker = camera_registry.get_worker(model.camera_id)
    if not worker or not worker.thread or not worker.thread.is_alive():
        return {
            "status": "unavailable",
            "mode": "unavailable",
            "camera_id": model.camera_id,
            "message": f"Camera '{model.camera_id}' is offline. Start the camera to generate telemetry and forecasts.",
            "forecast": None
        }

    if worker.analyser:
        history = worker.analyser.get_history(as_dicts=True)
        if not history or len(history) == 0:
            return {
                "status": "unavailable",
                "mode": "unavailable",
                "camera_id": model.camera_id,
                "message": "Camera is online but has not accumulated telemetry frames yet.",
                "forecast": None
            }

        # Check worker cached forecast or run predictor
        forecast_data = worker.latest_forecast
        if not forecast_data:
            predictor = worker.predictor or app_state.predictor
            if not predictor:
                try:
                    from congestion import CongestionPredictor
                    predictor = CongestionPredictor.load("models/tft")
                except Exception:
                    pass
            if predictor:
                forecast_data = predictor.predict_live(history)
                worker.latest_forecast = forecast_data

        if forecast_data:
            mode = forecast_data.get("telemetry_status", "heuristic_fallback")
            if "note" in forecast_data.get("model_info", {}) and "Heuristic" in forecast_data["model_info"]["note"]:
                mode = "heuristic_fallback"

            resp = {
                "status": "ok",
                "mode": mode,
                "camera_id": model.camera_id,
                "telemetry_points": len(history),
                "forecast": forecast_data
            }
            if "minute_records" in forecast_data:
                resp["minute_records"] = forecast_data["minute_records"]
            return resp

    return {
        "status": "unavailable",
        "mode": "unavailable",
        "camera_id": model.camera_id,
        "message": "No live telemetry available for this camera.",
        "forecast": None
    }


# ── 13. GET /api/cameras/{camera_id}/history ──
@app.get("/api/cameras/{camera_id}/history")
async def get_camera_traffic_history_endpoint(camera_id: str, limit: int = 50):
    """Retrieve historical traffic snapshots from PostgreSQL database."""
    model = camera_registry.get(camera_id)
    target_cid = model.camera_id if model else camera_id

    db = SessionLocal()
    try:
        snapshots = db.query(TrafficSnapshotModel).filter(
            TrafficSnapshotModel.camera_id == target_cid
        ).order_by(TrafficSnapshotModel.id.desc()).limit(limit).all()

        return {
            "camera_id": target_cid,
            "count": len(snapshots),
            "history": [snap.to_dict() for snap in reversed(snapshots)]
        }
    finally:
        db.close()


# ── 14. Legacy Analytics endpoints ──
@app.get("/api/camera/{cam_id}/analytics/summary")
async def get_camera_analytics_summary(cam_id: str):
    model = camera_registry.get(cam_id)
    worker = camera_registry.get_worker(model.camera_id) if model else None
    if not worker or not worker.analyser:
        raise HTTPException(status_code=400, detail="Camera is offline or analyser not ready.")
    return worker.analyser.get_session_summary()


@app.get("/api/camera/{cam_id}/analytics/history")
async def get_camera_analytics_history(cam_id: str, last_n: int = 60):
    model = camera_registry.get(cam_id)
    worker = camera_registry.get_worker(model.camera_id) if model else None
    if not worker or not worker.analyser:
        raise HTTPException(status_code=400, detail="Camera is offline or analyser not ready.")
    return worker.analyser.get_history(last_n=last_n, as_dicts=True)


# ── 12. /get-route-by-name ──

class NamedRouteRequest(BaseModel):
    from_name: str
    to_name: str
    from_lat: Optional[float] = None
    from_lon: Optional[float] = None
    to_lat: Optional[float] = None
    to_lon: Optional[float] = None

@app.post("/api/get-route-by-name")
async def get_route_by_name(req: NamedRouteRequest):
    """
    Accepts coordinates or resolves from config.py LOCATIONS.
    Runs the A* route planner.
    """
    print(f"[API] POST /api/get-route-by-name: {req.from_name} -> {req.to_name}")
    
    # Resolve Origin
    if req.from_lat is not None and req.from_lon is not None:
        origin = (req.from_lat, req.from_lon)
        print(f"[API] Origin coords provided: {origin}")
    elif req.from_name in LOCATIONS:
        origin = LOCATIONS[req.from_name]
    else:
        print(f"[API] FAILED: Origin '{req.from_name}' does not exist and coords missing.")
        raise HTTPException(status_code=400, detail=f"Unknown location: '{req.from_name}'")

    # Resolve Destination
    if req.to_lat is not None and req.to_lon is not None:
        destination = (req.to_lat, req.to_lon)
        print(f"[API] Destination coords provided: {destination}")
    elif req.to_name in LOCATIONS:
        destination = LOCATIONS[req.to_name]
    else:
        print(f"[API] FAILED: Destination '{req.to_name}' does not exist and coords missing.")
        raise HTTPException(status_code=400, detail=f"Unknown location: '{req.to_name}'")

    if not app_state.route_planner or not app_state.route_planner._is_loaded:
        err_msg = getattr(app_state.route_planner, "_load_error", None)
        if err_msg:
            raise HTTPException(
                status_code=503,
                detail=f"Route service failed to load: {err_msg}"
            )
        raise HTTPException(
            status_code=503,
            detail="Route service is temporarily unavailable (loading graph). Please try again in a moment."
        )

    # ── Check active TFT congestion map in RoutePlanner ───────────────────────
    # If RoutePlanner already has an active TFT forecast map, preserve it.
    # Otherwise, fallback to checking frame metrics from ONLINE cameras.
    from route import CongestionMap as CMap
    try:
        current_cmap = getattr(app_state.route_planner, "_congestion_map", None)
        if current_cmap is None or len(current_cmap) == 0:
            camera_maps = []
            for cam in CAMERAS:
                cid = cam["camera_id"]
                cam_state = _get_camera_state(cid)
                if cam_state["status"] == "ONLINE" and cam_state.get("metrics"):
                    score = cam_state["metrics"].get("congestion_score", 0.0)
                    if score > 0:
                        cmap = CMap.from_frame_metrics(
                            congestion_score=score,
                            graph=app_state.route_planner._graph,
                            camera_lat=cam["lat"],
                            camera_lon=cam["lon"],
                            radius_m=30000.0,
                        )
                        camera_maps.append(cmap)

            if camera_maps:
                merged = CMap.merge(camera_maps)
                app_state.route_planner.update_congestion(merged)
            else:
                # Also inject from upload-video stream if active
                if app_state.latest_metrics and app_state.latest_metrics.get("congestion_score", 0) > 0:
                    score = app_state.latest_metrics["congestion_score"]
                    cmap = CMap(source="upload_stream", horizon="current")
                    for nid in list(app_state.route_planner._node_coords)[:500]:
                        cmap.set(nid, score / 100.0 if score > 1.0 else score)
                    app_state.route_planner.update_congestion(cmap)
    except Exception as cmap_err:
        print(f"[API] Congestion injection note: {cmap_err} (routing will proceed)")

    comparison = app_state.route_planner.compare_routes(
        origin=origin,
        destination=destination,
    )

    # Enrich response with human-readable names
    comparison["from_name"] = req.from_name
    comparison["to_name"]   = req.to_name
    comparison["from_coords"] = {"lat": origin[0], "lon": origin[1]}
    comparison["to_coords"]   = {"lat": destination[0], "lon": destination[1]}

    return comparison


# ── 12.5. /routing-status ──

@app.get("/api/routing-status")
async def get_routing_status():
    """Return whether the OSM graph has finished loading, plus graph stats."""
    if not app_state.route_planner:
        return {"status": "initializing", "error": "RoutePlanner not initialized"}

    is_ready = app_state.route_planner._is_loaded
    error_msg = getattr(app_state.route_planner, "_load_error", None)

    if error_msg:
        return {
            "status": "error",
            "error": error_msg,
            "is_loaded": False,
            "node_count": 0,
            "edge_count": 0,
        }

    stats = app_state.route_planner.get_stats() if is_ready else {}
    return {
        "status": "ready" if is_ready else "initializing",
        "error": None,
        **stats,
    }


# ── 13. /agent-report ──

@app.get("/api/agent-report")
async def get_agent_report():
    """
    Return a synthesized AI recommendation based on all active cameras.
    Aggregates metrics from all running cameras and applies the agent's
    heuristic decision logic to generate actionable recommendations.
    """
    active_cameras = []
    recommendations = []

    for cam in CAMERAS:
        cid = cam["camera_id"]
        state = _get_camera_state(cid)
        if state["status"] == "ONLINE" and state["metrics"]:
            metrics = state["metrics"]
            level = metrics.get("congestion_level", "FREE_FLOW")
            score = metrics.get("congestion_score", 0.0)
            active_cameras.append({
                "id": cid,
                "name": cam["camera_name"],
                "level": level,
                "score": round(score, 3),
                "vehicle_count": metrics.get("vehicle_count", 0),
                "average_speed_kmh": round(metrics.get("average_speed_kmh", 0), 1),
            })

            # Generate recommendation per camera
            if level in ("HEAVY", "CONGESTED"):
                recommendations.append({
                    "camera": cam["camera_name"],
                    "severity": "HIGH",
                    "message": (
                        f"Heavy congestion detected at {cam['camera_name']}. "
                        f"Suggest diverting heavy vehicles through NH544 bypass. "
                        f"Estimated clearance: 20 minutes."
                    ),
                    "confidence": min(95, int(score * 100 + 10)),
                    "action": "DIVERT",
                })
            elif level == "MODERATE":
                recommendations.append({
                    "camera": cam["camera_name"],
                    "severity": "MEDIUM",
                    "message": (
                        f"Moderate traffic at {cam['camera_name']}. "
                        f"Monitor for escalation. No immediate action required."
                    ),
                    "confidence": min(85, int(score * 100 + 15)),
                    "action": "MONITOR",
                })

    if not active_cameras:
        return {
            "status": "idle",
            "active_cameras": 0,
            "recommendations": [],
            "summary": "No cameras are currently active. Start cameras to receive AI recommendations.",
        }

    # Overall network status
    avg_score = sum(c["score"] for c in active_cameras) / len(active_cameras)
    if avg_score >= 0.7:
        network_status = "CRITICAL"
    elif avg_score >= 0.5:
        network_status = "ELEVATED"
    elif avg_score >= 0.3:
        network_status = "NORMAL"
    else:
        network_status = "FREE_FLOW"

    return {
        "status": network_status,
        "active_cameras": len(active_cameras),
        "cameras": active_cameras,
        "recommendations": recommendations,
        "avg_congestion_score": round(avg_score, 3),
        "summary": (
            f"Monitoring {len(active_cameras)} locations. "
            f"Network status: {network_status}. "
            f"Average congestion score: {avg_score:.2f}."
        ),
    }


# ── 13.5. /get-traffic-stats ──

@app.get("/api/get-traffic-stats")
@app.get("/api/traffic-stats")
@app.get("/api/traffic/stats")
async def get_global_traffic_stats():
    """Return aggregated stats and processing state across active cameras."""
    agg = await get_cameras_aggregate()
    return {
        "is_processing": agg["active_camera_count"] > 0,
        "active_cameras": agg["active_camera_count"],
        "metrics": {
            "vehicle_count": agg["total_vehicles"],
            "average_speed_kmh": agg["avg_speed_kmh"],
            "congestion_score": agg["avg_congestion_score"],
            "traffic_flow_vpm": round(agg["total_vehicles"] * 0.8, 1),
            "class_counts": agg["class_counts"],
        },
        "aggregate": agg,
    }


# ── 15. /junction/overview ──

@app.get("/api/junction/overview")
async def get_junction_overview(junction: str = "Sankagiri Junction"):
    """
    Return comprehensive junction analysis across all 4 approaches,
    including congestion levels, design capacities, diversion plans,
    and active AI decision support recommendations.
    """
    overview = diversion_engine.analyze_junction(
        junction_name=junction,
        camera_states=_camera_states
    )
    return overview


# ── 16. /diversion/calculate ──

class DiversionRequest(BaseModel):
    junction_name: str = "Sankagiri Junction"
    approach_id: Optional[str] = None
    camera_id: Optional[str] = None

@app.post("/api/diversion/calculate")
async def calculate_diversion(req: DiversionRequest):
    """
    Generate an on-demand authority diversion plan with expected benefit,
    time saved, downstream clearance time, and policy grounding.
    """
    overview = diversion_engine.analyze_junction(
        junction_name=req.junction_name,
        camera_states=_camera_states
    )
    plans = overview.get("diversion_plans", [])
    if req.camera_id:
        plan = next((p for p in plans if p["affected_camera_id"] == req.camera_id), None)
        if plan:
            return plan
    if plans:
        return plans[0]
    
    # If no approach currently heavily congested, return standard advisory
    return {
        "status": "FREE_FLOW",
        "message": "All approaches operating within nominal capacity. No active diversion necessary.",
        "diversion_plans": []
    }


# ── 17. /alerts ──

@app.get("/api/alerts")
async def get_alerts():
    """
    Return active and historical traffic alerts based on real camera telemetry.
    """
    from datetime import datetime, timezone
    active_alerts = list(alert_audit_manager.get_active_alerts())
    
    # Check registered camera workers for dynamic threshold crossing
    for cam in camera_registry.get_all():
        w = camera_registry.get_worker(cam.camera_id)
        if w and w.latest_telemetry:
            tel = w.latest_telemetry
            c_score = tel.get("congestion_score", 0.0)
            spd = tel.get("average_speed_kmh", 0.0) or 0.0
            v_cnt = tel.get("vehicle_count", 0)
            
            if c_score >= 0.80:
                active_alerts.insert(0, {
                    "alert_id": f"ALT-CRIT-{cam.camera_id}",
                    "camera_id": cam.camera_id,
                    "location": f"{cam.camera_id} · {cam.location}",
                    "severity": "CRITICAL",
                    "reason": f"Heavy congestion on {cam.road} ({v_cnt} vehicles detected · Road occupancy {c_score*100:.0f}%).",
                    "action": "Diversion recommended.",
                    "timestamp": "Just now",
                    "status": "ACTIVE",
                    "hasDiversion": True
                })
            elif c_score >= 0.50:
                active_alerts.append({
                    "alert_id": f"ALT-MOD-{cam.camera_id}",
                    "camera_id": cam.camera_id,
                    "location": f"{cam.camera_id} · {cam.location}",
                    "severity": "HIGH" if c_score >= 0.65 else "MODERATE",
                    "reason": f"{v_cnt} vehicles detected · Road occupancy {c_score*100:.0f}%.",
                    "action": "Monitor traffic conditions.",
                    "timestamp": "Just now",
                    "status": "ACTIVE",
                    "hasDiversion": False
                })

    return {
        "alerts": active_alerts
    }


# ── 18. /alerts/{alert_id}/action ──

class OfficerActionRequest(BaseModel):
    action: str  # "ACKNOWLEDGE", "ACCEPT", "REJECT", "RESOLVE", "NOTIFY"
    officer_id: Optional[str] = "OFFICER_TN_042"
    notes: Optional[str] = ""

@app.post("/api/alerts/{alert_id}/action")
async def take_officer_action(alert_id: str, req: OfficerActionRequest):
    """
    Record police officer field action on an urgent alert.
    Synchronizes Control Room and Field App.
    """
    result = alert_audit_manager.handle_officer_action(
        alert_id=alert_id,
        action=req.action,
        officer_id=req.officer_id,
        notes=req.notes
    )
    return {"message": f"Action '{req.action}' recorded successfully.", "alert": result}


# ── 19. /audit-log ──

@app.get("/api/audit-log")
async def get_audit_log(limit: int = 50):
    """
    Return immutable decision audit log of recommendations, alerts, and officer actions.
    """
    return {
        "audit_trail": alert_audit_manager.get_audit_trail(limit=limit)
    }


# ── 20. /rag/query ──

@app.get("/api/rag/query")
async def query_rag_knowledge(q: str, congestion_score: float = 0.5):
    """
    Query the Traffic Management Knowledge Base for SOPs, IRC guidelines, and regulatory rules.
    """
    guidelines = rag_engine.retrieve_guidance(query=q, congestion_score=congestion_score)
    return {
        "query": q,
        "guidelines": guidelines
    }


if __name__ == "__main__":
    import uvicorn
    import os
    import sys
    import socket

    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")

    # Check for CLI argument overrides
    for arg in sys.argv[1:]:
        if arg.startswith("--port="):
            port = int(arg.split("=")[1])
        elif arg.startswith("--host="):
            host = arg.split("=")[1]

    # Test socket availability
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind((host, port))
        sock.close()
    except OSError as e:
        print(f"[System] Warning: Cannot bind directly to {host}:{port} ({e}).")
        # Try localhost if 0.0.0.0 had permission restrictions
        if host == "0.0.0.0":
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.bind(("127.0.0.1", port))
                sock.close()
                host = "127.0.0.1"
                print(f"[System] Falling back to host: {host}")
            except Exception:
                pass

    print(f"[System] Starting TrafficControl Backend Server on http://{host}:{port}")
    uvicorn.run("main:app", host=host, port=port, log_level="info", reload=False)

