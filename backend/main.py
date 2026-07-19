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

import asyncio
import os
import shutil
import time
from pathlib import Path
from typing import Optional, List, Tuple

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Internal Modules
from detect import Detector
from track import Tracker
from counter import VehicleCounter, LineConfig
from traffic_analysis import TrafficAnalyser, AnalysisConfig
from congestion import CongestionPredictor, TFTConfig
from route import RoutePlanner, RouteConfig
from agent import TrafficWorkflow, WorkflowContext
from config import LOCATIONS, CAMERAS


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
# Initialization
# ──────────────────────────────────────────────────────────────────────────────

def initialize_backend():
    """Instantiate all backend classes once at startup (fast path).
    
    The OSM graph is large (554 MB PBF) and takes 60–120 seconds to parse.
    We load everything else here synchronously so the server starts immediately,
    then schedule graph loading as a background thread.
    """
    print("[System] Initialising backend modules...")
    
    # Base modules
    app_state.detector = Detector(weights="yolo11n.pt", conf=0.25)
    app_state.tracker = Tracker(weights="yolo11n.pt", conf=0.25, tracker_config="bytetrack.yaml")
    
    # Configure virtual lines for counting
    lines = [
        LineConfig(name="L1", p1=(0.1, 0.5), p2=(0.9, 0.5), direction="both")
    ]
    app_state.counter = VehicleCounter(lines=lines)
    
    # Analysis & Prediction
    app_state.analyser = TrafficAnalyser(AnalysisConfig(fps=30.0))
    
    app_state.predictor = CongestionPredictor(TFTConfig())
    # Try to load a pre-trained model if it exists, otherwise build untrained
    try:
        app_state.predictor = CongestionPredictor.load("models/tft.keras")
        print("[System] Loaded pre-trained TFT model.")
    except FileNotFoundError:
        print("[System] No trained TFT model found — attempting to build untrained model.")
        try:
            app_state.predictor.build()
            print("[System] TFT model built successfully (untrained — heuristic fallback active).")
        except (ImportError, ModuleNotFoundError) as tf_err:
            # TensorFlow is broken/missing — run in pure heuristic mode.
            # The CongestionPredictor.predict_live() gracefully falls back to heuristics
            # when self._model is None, so the app is fully functional without TF.
            print(f"[System] WARNING: TensorFlow not available ({tf_err})")
            print("[System] Running in HEURISTIC FALLBACK mode. All other features work normally.")
    except Exception as e:
        print(f"[System] TFT model setup error: {e} — using heuristic fallback.")

    # Route Planner instance (graph not loaded yet — loaded in background)
    app_state.route_planner = RoutePlanner(RouteConfig())
        
    # Agentic Workflow Orchestrator
    context = WorkflowContext(
        detector=app_state.detector,
        tracker=app_state.tracker,
        counter=app_state.counter,
        analyser=app_state.analyser,
        predictor=app_state.predictor,
        route_planner=app_state.route_planner
    )
    # Using pure python logic instead of LLM to avoid mandatory API keys
    app_state.workflow = TrafficWorkflow(context, llm=None)
    
    print("[System] Fast initialisation complete — server is ready.")
    print("[System] OSM graph loading started in background (this may take 60–120 seconds)...")


def _load_route_graph_thread():
    """
    Load the OSM road graph in a background thread so the server stays responsive.
    This runs after initialize_backend() completes, in a ThreadPoolExecutor.
    Once loaded, app_state.route_planner._is_loaded becomes True and
    /api/get-route-by-name will start returning routes.
    """
    try:
        print("[System] [BG] Loading OSM graph from PBF...")
        app_state.route_planner.load()
        print("[System] [BG] OSM graph loaded successfully — routing is now available!")
    except Exception as e:
        print(f"[System] [BG] Warning: Failed to load OSM graph: {e}")
        import traceback
        traceback.print_exc()


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
            
            det_result = app_state.detector.detect(frame)
            detections = det_result.detections
            trajectories = []
            
            if app_state.enable_tracking:
                track_result = app_state.tracker.update(frame, detections, frame_idx, timestamp_ms)
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
                    hist = app_state.analyser.get_history(last_n=60, as_dicts=True)
                    app_state.latest_forecast = app_state.predictor.predict_live(hist)
                    
        # Sleep to simulate real-time processing and yield to event loop
        await asyncio.sleep(1.0 / fps)
        
    cap.release()
    app_state.is_processing = False
    print("[Worker] Processing finished or stopped.")


# ──────────────────────────────────────────────────────────────────────────────
# FastAPI App & Endpoints
# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Smart Traffic Congestion System API",
    description="Agentic AI backend for traffic analysis and routing.",
    version="1.0.0"
)

# CORS config for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Fast sync init (detector, tracker, analyser, predictor — all quick)
    initialize_backend()
    # Kick off slow graph loading in a background thread (non-blocking)
    import concurrent.futures
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="graph_loader")
    asyncio.get_event_loop().run_in_executor(executor, _load_route_graph_thread)


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

@app.get("/api/predict-congestion")
async def predict_congestion():
    """Return the latest Temporal Fusion Transformer (TFT) forecast."""
    return {
        "forecast": app_state.latest_forecast
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
        raise HTTPException(status_code=503, detail="Route map is not loaded.")
        
    # Get comparison of Distance vs Congestion vs Forecast strategies
    comparison = app_state.route_planner.compare_routes(
        origin=(req.origin_lat, req.origin_lon),
        destination=(req.dest_lat, req.dest_lon)
    )
    
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


# ── 8. /cameras ──

@app.get("/api/cameras")
async def get_cameras():
    """Return camera configuration list (without internal video paths)."""
    return {
        "cameras": [
            {
                "id":       cam["id"],
                "name":     cam["name"],
                "location": cam["location"],
                "address":  cam["address"],
                "lat":      cam["lat"],
                "lon":      cam["lon"],
                "status":   "online",
            }
            for cam in CAMERAS
        ]
    }


# ── Per-camera state store ──
# Holds separate AppState-like dicts for each camera ID.
_camera_states: dict = {}

def _get_camera_state(cam_id: int) -> dict:
    if cam_id not in _camera_states:
        _camera_states[cam_id] = {
            "is_processing": False,
            "metrics": {},
            "forecast": {},
        }
    return _camera_states[cam_id]


async def _process_camera_stream(cam_id: int, video_path: str):
    """Background worker for a specific camera feed."""
    state = _get_camera_state(cam_id)
    state["is_processing"] = True

    # Re-use the global detector/tracker/counter/analyser/predictor instances
    if not app_state.detector:
        state["is_processing"] = False
        return

    # Independent tracker & counter per camera
    from track import Tracker
    from counter import VehicleCounter, LineConfig
    from traffic_analysis import TrafficAnalyser, AnalysisConfig

    cam_tracker = Tracker(weights="yolo11n.pt", conf=0.25, tracker_config="bytetrack.yaml")
    cam_counter = VehicleCounter(lines=[
        LineConfig(name="L1", p1=(0.1, 0.5), p2=(0.9, 0.5), direction="both")
    ])
    cam_analyser = TrafficAnalyser(AnalysisConfig(fps=30.0))

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_idx = 0

    while state["is_processing"] and cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            # Loop video to simulate live feed
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = cap.read()
            if not ret:
                break

        timestamp_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
        frame_idx += 1

        det_result = app_state.detector.detect(frame)
        track_result = cam_tracker.update(frame, det_result.detections, frame_idx, timestamp_ms)
        events = cam_counter.update(track_result.detections, frame_idx)
        metrics = cam_analyser.update(
            track_result.detections, track_result.trajectories,
            events, frame_idx, timestamp_ms
        )
        state["metrics"] = metrics.to_dict()

        if frame_idx % int(fps) == 0:
            hist = cam_analyser.get_history(last_n=60, as_dicts=True)
            state["forecast"] = app_state.predictor.predict_live(hist)

        await asyncio.sleep(1.0 / fps)

    cap.release()
    state["is_processing"] = False


# ── 9. /camera/{id}/start ──

@app.post("/api/camera/{cam_id}/start")
async def start_camera(cam_id: int, background_tasks: BackgroundTasks):
    """Start processing a specific camera's video feed."""
    cam = next((c for c in CAMERAS if c["id"] == cam_id), None)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera {cam_id} not found.")

    import os
    if not os.path.exists(cam["video"]):
        raise HTTPException(status_code=404, detail=f"Video file not found: {cam['video']}")

    state = _get_camera_state(cam_id)
    if not state["is_processing"]:
        background_tasks.add_task(_process_camera_stream, cam_id, cam["video"])
        return {"message": f"Camera {cam_id} ({cam['name']}) started."}
    return {"message": f"Camera {cam_id} is already processing."}


# ── 10. /camera/{id}/stop ──

@app.post("/api/camera/{cam_id}/stop")
async def stop_camera(cam_id: int):
    """Stop processing a specific camera feed."""
    state = _get_camera_state(cam_id)
    state["is_processing"] = False
    return {"message": f"Camera {cam_id} stopped."}


# ── 11. /camera/{id}/stats ──

@app.get("/api/camera/{cam_id}/stats")
async def get_camera_stats(cam_id: int):
    """Return latest metrics and forecast for a specific camera."""
    cam = next((c for c in CAMERAS if c["id"] == cam_id), None)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera {cam_id} not found.")

    state = _get_camera_state(cam_id)
    return {
        "camera_id":    cam_id,
        "camera_name":  cam["name"],
        "is_processing": state["is_processing"],
        "metrics":      state["metrics"],
        "forecast":     state["forecast"],
    }


# ── 12. /get-route-by-name ──

class NamedRouteRequest(BaseModel):
    from_name: str
    to_name: str

@app.post("/api/get-route-by-name")
async def get_route_by_name(req: NamedRouteRequest):
    """
    Resolve human-readable Tamil Nadu location names to coordinates
    and run the A* route planner. Frontend never needs lat/lon.
    """
    print(f"[API] POST /api/get-route-by-name: {req.from_name} -> {req.to_name}")
    if req.from_name not in LOCATIONS:
        print(f"[API] FAILED: Origin '{req.from_name}' does not exist.")
        raise HTTPException(status_code=400, detail=f"Unknown location: '{req.from_name}'")
    else:
        print(f"[API] Verify 4: {req.from_name} exists. (SUCCESS)")

    if req.to_name not in LOCATIONS:
        print(f"[API] FAILED: Destination '{req.to_name}' does not exist.")
        raise HTTPException(status_code=400, detail=f"Unknown location: '{req.to_name}'")
    else:
        print(f"[API] Verify 5: {req.to_name} exists. (SUCCESS)")

    if not app_state.route_planner or not app_state.route_planner._is_loaded:
        print("[API] FAILED: Route map is not loaded yet.")
        raise HTTPException(
            status_code=503,
            detail="Route map is still loading from OSM data (this takes ~2 minutes on first run). Please wait and try again."
        )

    origin = LOCATIONS[req.from_name]
    destination = LOCATIONS[req.to_name]

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
        cid = cam["id"]
        state = _get_camera_state(cid)
        if state["metrics"]:
            metrics = state["metrics"]
            level = metrics.get("congestion_level", "FREE_FLOW")
            score = metrics.get("congestion_score", 0.0)
            active_cameras.append({
                "id": cid,
                "name": cam["name"],
                "level": level,
                "score": round(score, 3),
                "vehicle_count": metrics.get("vehicle_count", 0),
                "average_speed_kmh": round(metrics.get("average_speed_kmh", 0), 1),
            })

            # Generate recommendation per camera
            if level in ("HEAVY", "CONGESTED"):
                recommendations.append({
                    "camera": cam["name"],
                    "severity": "HIGH",
                    "message": (
                        f"Heavy congestion detected at {cam['name']}. "
                        f"Suggest diverting heavy vehicles through NH544 bypass. "
                        f"Estimated clearance: 20 minutes."
                    ),
                    "confidence": min(95, int(score * 100 + 10)),
                    "action": "DIVERT",
                })
            elif level == "MODERATE":
                recommendations.append({
                    "camera": cam["name"],
                    "severity": "MEDIUM",
                    "message": (
                        f"Moderate traffic at {cam['name']}. "
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


if __name__ == "__main__":
    import uvicorn
    # Allow running directly via `python backend/main.py`
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
