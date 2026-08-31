"""
agent.py — LangGraph Multi-Agent Orchestration
===============================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation

This module uses LangGraph to orchestrate traffic processing
as a directed acyclic graph (DAG) of specialized agents.

Workflow:
  Detect -> Track -> Analyze -> Predict -> Decide -> Route -> Report

Agents:
  1. Detection Agent  : Uses detect.py (YOLO11) to find vehicles.
  2. Tracking Agent   : Uses track.py (ByteTrack) for persistent IDs.
  3. Analysis Agent   : Uses counter.py & traffic_analysis.py.
  4. Prediction Agent : Uses congestion.py (TFT) to forecast.
  5. Decision Agent   : Decides if route recommendation is needed.
  6. Route Agent      : Uses route.py (A*) to find optimal detours.
  7. Reporting Agent  : Compiles the final JSON/text report.
"""

from __future__ import annotations

import logging
import os
import sys
import time
from typing import Any, TypedDict

import numpy as np

logger = logging.getLogger("TrafficAgent")

# Ensure backend directory is in sys.path
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

# LangGraph & LangChain Orchestration
try:
    from langchain_core.language_models import BaseChatModel
    from langchain_core.prompts import PromptTemplate
    from langgraph.graph import END, StateGraph
except (ImportError, ModuleNotFoundError):
    class BaseChatModel:  # type: ignore[no-redef]
        """Placeholder for langchain BaseChatModel when uninstalled."""

    StateGraph = None
    END = "__end__"
    PromptTemplate = None

# Internal Backend Modules
try:
    from detect import Detection
    from route import CongestionMap
    from track import TrackState
except (ImportError, ModuleNotFoundError):
    try:
        from backend.detect import Detection
        from backend.route import CongestionMap
        from backend.track import TrackState
    except (ImportError, ModuleNotFoundError):
        class Detection:  # type: ignore[no-redef]
            pass

        class TrackState:  # type: ignore[no-redef]
            pass

        class CongestionMap:  # type: ignore[no-redef]
            pass

_PIPELINE_EXCEPTIONS = (
    AttributeError,
    RuntimeError,
    TypeError,
    ValueError,
    KeyError,
    OSError,
    Exception,
)


# ─────────────────────────────────────────────────────────────────────────────
# State Schema
# ─────────────────────────────────────────────────────────────────────────────

class TrafficState(TypedDict):
    """
    The shared state dictionary passed between all agents in the graph.
    """
    # ── Inputs ───────────────────────────────────────────────────────────────
    frame: np.ndarray                   # The BGR image array
    frame_index: int                    # Frame number
    timestamp_ms: float                 # Video stream timestamp
    camera_lat: float                   # Camera location for routing
    camera_lon: float
    origin: tuple[float, float]         # Routing start (lat, lon)
    destination: tuple[float, float]    # Routing end (lat, lon)

    # ── Populated by Agents ──────────────────────────────────────────────────
    detections: list[Any]               # From DetectionAgent
    trajectories: Any                   # From TrackingAgent
    metrics: dict                       # From AnalysisAgent
    forecast: dict                      # From PredictionAgent
    decision: str                       # From DecisionAgent
    decision_reason: str                # From DecisionAgent
    route_result: dict                  # From RouteAgent
    report: str                         # From ReportingAgent
    execution_times: dict[str, float]   # For profiling


# ─────────────────────────────────────────────────────────────────────────────
# Context (Stateful Dependencies)
# ─────────────────────────────────────────────────────────────────────────────

class WorkflowContext:
    """
    Holds stateful backend instances so they are not re-instantiated.
    """
    def __init__(
        self,
        detector: Any = None,
        tracker: Any = None,
        counter: Any = None,
        analyser: Any = None,
        predictor: Any = None,
        route_planner: Any = None,
    ):
        self.detector = detector
        self.tracker = tracker
        self.counter = counter
        self.analyser = analyser
        self.predictor = predictor
        self.route_planner = route_planner


# ─────────────────────────────────────────────────────────────────────────────
# LangGraph Orchestrator
# ─────────────────────────────────────────────────────────────────────────────

class TrafficWorkflow:
    """
    Constructs and executes the multi-agent workflow.
    Falls back to a deterministic Python runner if LangGraph is absent.
    """

    def __init__(
        self,
        context: WorkflowContext,
        llm: BaseChatModel | None = None
    ):
        self.context = context
        self.llm = llm
        self.app = None

        if StateGraph is not None:
            try:
                workflow = StateGraph(TrafficState)

                workflow.add_node("DetectionAgent", self._detection_node)
                workflow.add_node("TrackingAgent", self._tracking_node)
                workflow.add_node("AnalysisAgent", self._analysis_node)
                workflow.add_node("PredictionAgent", self._prediction_node)
                workflow.add_node("DecisionAgent", self._decision_node)
                workflow.add_node("RouteAgent", self._route_node)
                workflow.add_node("ReportingAgent", self._reporting_node)

                workflow.set_entry_point("DetectionAgent")
                workflow.add_edge("DetectionAgent", "TrackingAgent")
                workflow.add_edge("TrackingAgent", "AnalysisAgent")
                workflow.add_edge("AnalysisAgent", "PredictionAgent")
                workflow.add_edge("PredictionAgent", "DecisionAgent")

                workflow.add_conditional_edges(
                    "DecisionAgent",
                    self._route_condition,
                    {
                        "ROUTE": "RouteAgent",
                        "NO_ROUTE": "ReportingAgent"
                    }
                )

                workflow.add_edge("RouteAgent", "ReportingAgent")
                workflow.add_edge("ReportingAgent", END)

                self.app = workflow.compile()
            except _PIPELINE_EXCEPTIONS as e:
                logger.warning(
                    "[TrafficWorkflow] LangGraph compile warning: %s", e
                )
                self.app = None
        else:
            logger.info(
                "[TrafficWorkflow] LangGraph not installed; using fallback."
            )

    def invoke(
        self,
        frame: np.ndarray,
        frame_index: int,
        timestamp_ms: float,
        camera_lat: float = 12.9716,
        camera_lon: float = 77.5946,
        origin: tuple[float, float] = (12.9716, 77.5946),
        destination: tuple[float, float] = (12.9352, 77.6245),
    ) -> TrafficState:
        """Run the full workflow on a single frame."""
        initial_state: TrafficState = {
            "frame": frame,
            "frame_index": frame_index,
            "timestamp_ms": timestamp_ms,
            "camera_lat": camera_lat,
            "camera_lon": camera_lon,
            "origin": origin,
            "destination": destination,
            "detections": [],
            "trajectories": {},
            "metrics": {},
            "forecast": {},
            "decision": "",
            "decision_reason": "",
            "route_result": {},
            "report": "",
            "execution_times": {},
        }

        if self.app is not None:
            return self.app.invoke(initial_state)

        # Pure Python DAG Execution Fallback
        state = dict(initial_state)

        det_out = self._detection_node(state)
        state.update(det_out)

        track_out = self._tracking_node(state)
        state.update(track_out)

        analysis_out = self._analysis_node(state)
        state.update(analysis_out)

        pred_out = self._prediction_node(state)
        state.update(pred_out)

        dec_out = self._decision_node(state)
        state.update(dec_out)

        if self._route_condition(state) == "ROUTE":
            route_out = self._route_node(state)
            state.update(route_out)

        rep_out = self._reporting_node(state)
        state.update(rep_out)

        return state

    # ── Graph Edges ──────────────────────────────────────────────────────────

    def _route_condition(self, state: TrafficState) -> str:
        """Determines whether to trigger the Route Agent."""
        return state.get("decision", "NO_ROUTE")

    # ── Agent Nodes ──────────────────────────────────────────────────────────

    def _detection_node(self, state: TrafficState) -> dict:
        t0 = time.time()
        frame = state["frame"]
        detections: list[Any] = []

        if self.context.detector is not None:
            try:
                if (
                    getattr(self.context.detector, "_model", None) is None
                    and hasattr(self.context.detector, "load")
                ):
                    try:
                        self.context.detector.load()
                    except _PIPELINE_EXCEPTIONS as load_err:
                        logger.debug(
                            "[DetectionAgent] Auto-load notice: %s", load_err
                        )

                if hasattr(self.context.detector, "detect"):
                    result = self.context.detector.detect(
                        frame=frame,
                        frame_index=state.get("frame_index", 0),
                        timestamp_ms=state.get("timestamp_ms", 0.0),
                    )
                    if hasattr(result, "detections"):
                        detections = result.detections
                    elif isinstance(result, list):
                        detections = result
                elif hasattr(self.context.detector, "detect_frame"):
                    result = self.context.detector.detect_frame(frame)
                    if hasattr(result, "detections"):
                        detections = result.detections
                    elif isinstance(result, list):
                        detections = result
            except _PIPELINE_EXCEPTIONS as e:
                logger.error("[DetectionAgent] Detection failed: %s", e)

        t_ms = (time.time() - t0) * 1000
        times = dict(state.get("execution_times", {}))
        times["detection_ms"] = t_ms

        return {
            "detections": detections,
            "execution_times": times
        }

    def _tracking_node(self, state: TrafficState) -> dict:
        t0 = time.time()
        frame = state["frame"]
        detections = state["detections"]
        frame_idx = state["frame_index"]
        ts_ms = state["timestamp_ms"]

        trajectories: dict[int, list[tuple[float, float]]] = {}
        tracked_detections = detections

        if self.context.tracker is not None:
            try:
                if (
                    getattr(self.context.tracker, "_model", None) is None
                    and hasattr(self.context.tracker, "load")
                ):
                    try:
                        self.context.tracker.load()
                    except _PIPELINE_EXCEPTIONS as load_err:
                        logger.debug(
                            "[TrackingAgent] Auto-load notice: %s", load_err
                        )

                if hasattr(self.context.tracker, "track_frame"):
                    tracked_frame = self.context.tracker.track_frame(
                        frame=frame,
                        timestamp_ms=ts_ms,
                    )
                    if tracked_frame is not None:
                        trajectories = getattr(
                            tracked_frame, "trajectories", {}
                        )
                        tracked_detections = getattr(
                            tracked_frame, "detections", detections
                        )
                elif hasattr(self.context.tracker, "update"):
                    tracked_frame = self.context.tracker.update(
                        frame=frame,
                        detections=detections,
                        frame_index=frame_idx,
                        timestamp_ms=ts_ms,
                    )
                    if tracked_frame is not None:
                        trajectories = getattr(
                            tracked_frame, "trajectories", {}
                        )
                        tracked_detections = getattr(
                            tracked_frame, "detections", detections
                        )
            except _PIPELINE_EXCEPTIONS as e:
                logger.error("[TrackingAgent] Tracking failed: %s", e)

        t_ms = (time.time() - t0) * 1000
        times = dict(state.get("execution_times", {}))
        times["tracking_ms"] = t_ms

        return {
            "trajectories": trajectories,
            "detections": tracked_detections,
            "execution_times": times
        }

    def _analysis_node(self, state: TrafficState) -> dict:
        t0 = time.time()
        detections = state["detections"]
        trajectories = state["trajectories"]
        frame_idx = state["frame_index"]
        ts_ms = state["timestamp_ms"]

        crossing_events = []
        if (
            self.context.counter is not None
            and hasattr(self.context.counter, "update")
        ):
            try:
                crossing_events = self.context.counter.update(
                    detections=detections,
                    frame_index=frame_idx,
                    timestamp_ms=ts_ms,
                )
            except TypeError:
                crossing_events = self.context.counter.update(
                    detections=detections,
                    frame_index=frame_idx,
                )
            except _PIPELINE_EXCEPTIONS as e:
                logger.error("[AnalysisAgent] Counter error: %s", e)

        metrics_dict = {}
        if (
            self.context.analyser is not None
            and hasattr(self.context.analyser, "update")
        ):
            try:
                metrics = self.context.analyser.update(
                    detections=detections,
                    trajectories=trajectories,
                    crossing_events=crossing_events,
                    frame_index=frame_idx,
                    timestamp_ms=ts_ms,
                )
                if hasattr(metrics, "to_dict"):
                    metrics_dict = metrics.to_dict()
                else:
                    metrics_dict = metrics
            except _PIPELINE_EXCEPTIONS as e:
                logger.error("[AnalysisAgent] Analyser error: %s", e)

        t_ms = (time.time() - t0) * 1000
        times = dict(state.get("execution_times", {}))
        times["analysis_ms"] = t_ms

        return {
            "metrics": metrics_dict,
            "execution_times": times
        }

    def _prediction_node(self, state: TrafficState) -> dict:
        t0 = time.time()
        forecast = {}
        if self.context.predictor is not None:
            try:
                recent_history = []
                if (
                    self.context.analyser is not None
                    and hasattr(self.context.analyser, "get_history")
                ):
                    recent_history = self.context.analyser.get_history(
                        last_n=60, as_dicts=True
                    )

                if hasattr(self.context.predictor, "predict_live"):
                    forecast = self.context.predictor.predict_live(
                        recent_history
                    )
            except _PIPELINE_EXCEPTIONS as e:
                logger.error("[PredictionAgent] Prediction error: %s", e)

        t_ms = (time.time() - t0) * 1000
        times = dict(state.get("execution_times", {}))
        times["prediction_ms"] = t_ms

        return {
            "forecast": forecast,
            "execution_times": times
        }

    def _decision_node(self, state: TrafficState) -> dict:
        t0 = time.time()
        metrics = state.get("metrics", {})
        forecast = state.get("forecast", {})

        decision = "NO_ROUTE"
        reason = "Traffic is flowing normally."

        f_15m = {}
        if isinstance(forecast, dict):
            f_15m = forecast.get("15min", {})

        q50_15m = 0.0
        level_15m = "FREE_FLOW"
        if isinstance(f_15m, dict):
            q50_15m = f_15m.get("q50", 0.0)
            level_15m = f_15m.get("level_q50", "FREE_FLOW")

        curr_score = 0.0
        curr_level = "FREE_FLOW"
        if isinstance(metrics, dict):
            curr_score = metrics.get("congestion_score", 0.0)
            curr_level = metrics.get("congestion_level", "FREE_FLOW")

        # ── LLM Decision (Agentic) ──
        if self.llm and PromptTemplate is not None:
            template = (
                "You are an intelligent Traffic Management Agent.\n"
                "Current State: Score={curr_score} ({curr_level}), "
                "Flow={flow} vpm, Speed={speed} km/h\n"
                "15m Forecast: Score={q50_15m} ({level_15m})\n\n"
                "Should we trigger a ROUTE diversion?\n"
                "Line 1: 'ROUTE' or 'NO_ROUTE'\n"
                "Line 2: 1-sentence reason."
            )
            prompt = PromptTemplate.from_template(template)
            try:
                flow_val = 0
                speed_val = 0
                if isinstance(metrics, dict):
                    flow_val = metrics.get("traffic_flow_vpm", 0)
                    speed_val = metrics.get("average_speed_kmh", 0)

                formatted = prompt.format(
                    curr_score=curr_score,
                    curr_level=curr_level,
                    flow=flow_val,
                    speed=speed_val,
                    q50_15m=q50_15m,
                    level_15m=level_15m,
                )
                response = self.llm.invoke(formatted)
                content = getattr(response, "content", str(response))
                lines = content.strip().split("\n")
                if lines:
                    dec = lines[0].strip().upper()
                    if dec in ("ROUTE", "NO_ROUTE"):
                        decision = dec
                    if len(lines) > 1:
                        reason = lines[1].strip()
            except _PIPELINE_EXCEPTIONS as e:
                logger.warning(
                    "[DecisionAgent] LLM failed, using fallback: %s", e
                )

        # ── Fallback Heuristic ──
        if not self.llm or decision not in ("ROUTE", "NO_ROUTE"):
            if (
                curr_level in ("HEAVY", "CONGESTED")
                or level_15m in ("HEAVY", "CONGESTED")
            ):
                decision = "ROUTE"
                reason = (
                    f"Congestion is {level_15m} (Forecast) or "
                    f"{curr_level} (Current). Routing required."
                )
            elif (
                isinstance(q50_15m, (int, float))
                and isinstance(curr_score, (int, float))
                and (q50_15m - curr_score > 0.3)
            ):
                decision = "ROUTE"
                reason = "Congestion rapidly increasing. Routing required."
            else:
                decision = "NO_ROUTE"
                reason = "Traffic levels are manageable. No diversion needed."

        t_ms = (time.time() - t0) * 1000
        times = dict(state.get("execution_times", {}))
        times["decision_ms"] = t_ms

        return {
            "decision": decision,
            "decision_reason": reason,
            "execution_times": times
        }

    def _route_node(self, state: TrafficState) -> dict:
        t0 = time.time()
        comp = {}

        if self.context.route_planner is not None:
            try:
                planner_graph = getattr(
                    self.context.route_planner, "_graph", None
                )
                if (
                    planner_graph is not None
                    and CongestionMap is not None
                    and hasattr(CongestionMap, "from_forecast")
                ):
                    try:
                        cmap = CongestionMap.from_forecast(
                            forecast=state.get("forecast", {}),
                            graph=planner_graph,
                            camera_lat=state.get("camera_lat", 12.9716),
                            camera_lon=state.get("camera_lon", 77.5946),
                            radius_m=500.0,
                            horizon="15min",
                        )
                        if hasattr(
                            self.context.route_planner, "update_congestion"
                        ):
                            self.context.route_planner.update_congestion(cmap)
                    except _PIPELINE_EXCEPTIONS as cmap_err:
                        logger.debug(
                            "[RouteAgent] Congestion map skip: %s", cmap_err
                        )

                if hasattr(
                    self.context.route_planner, "find_route_comparison"
                ):
                    comp = self.context.route_planner.find_route_comparison(
                        origin=state["origin"],
                        destination=state["destination"],
                    )
                elif hasattr(self.context.route_planner, "compare_routes"):
                    comp = self.context.route_planner.compare_routes(
                        origin=state["origin"],
                        destination=state["destination"],
                    )
            except _PIPELINE_EXCEPTIONS as e:
                logger.error("[RouteAgent] Route calculation error: %s", e)
                comp = {
                    "error": str(e),
                    "recommendation": "distance",
                    "savings": {"time_saved_min": 0, "extra_distance_m": 0},
                }

        t_ms = (time.time() - t0) * 1000
        times = dict(state.get("execution_times", {}))
        times["route_ms"] = t_ms

        return {
            "route_result": comp,
            "execution_times": times
        }

    def _reporting_node(self, state: TrafficState) -> dict:
        t0 = time.time()
        metrics = state.get("metrics", {})
        forecast = state.get("forecast", {})
        decision = state.get("decision", "NO_ROUTE")
        reason = state.get("decision_reason", "")

        forecast_level = "UNKNOWN"
        if isinstance(forecast, dict):
            forecast_level = forecast.get("15min", {}).get(
                "level_q50", "UNKNOWN"
            )

        curr_lvl = "UNKNOWN"
        curr_sc = 0.0
        v_count = 0
        v_speed = 0.0
        if isinstance(metrics, dict):
            curr_lvl = metrics.get("congestion_level", "UNKNOWN")
            curr_sc = metrics.get("congestion_score", 0.0)
            v_count = metrics.get("vehicle_count", 0)
            v_speed = metrics.get("average_speed_kmh", 0.0)

        f_idx = state.get("frame_index", 0)
        report_lines = [
            f"=== Traffic Agent Report [Frame {f_idx}] ===",
            f"Current Level : {curr_lvl} (Score: {curr_sc:.2f})",
            f"Active Vehicles: {v_count} | Speed: {v_speed:.1f} km/h",
            f"Forecast (15m): {forecast_level}",
            f"Decision      : {decision} - {reason}"
        ]

        route_result = state.get("route_result", {})
        if decision == "ROUTE" and isinstance(route_result, dict):
            rec = route_result.get("recommendation", "")
            savings = route_result.get("savings", {})
            if rec:
                report_lines.append(f"Recommended   : {rec.upper()} Strategy")
            if isinstance(savings, dict):
                t_saved = savings.get("time_saved_min", 0)
                if t_saved > 0:
                    report_lines.append(f"Time Saved    : {t_saved} mins")

        report = "\n".join(report_lines)

        t_ms = (time.time() - t0) * 1000
        times = dict(state.get("execution_times", {}))
        times["report_ms"] = t_ms
        times["total_pipeline_ms"] = sum(
            v for k, v in times.items() if k != "total_pipeline_ms"
        )

        return {
            "report": report,
            "execution_times": times
        }
