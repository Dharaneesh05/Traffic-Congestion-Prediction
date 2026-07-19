"""
agent.py — LangGraph Multi-Agent Orchestration
===============================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

This module uses LangGraph to orchestrate the entire traffic processing pipeline
as a directed acyclic graph (DAG) of specialized agents.

Workflow:
  Detection -> Tracking -> Analysis -> Prediction -> Decision -> Route -> Report

Agents:
  1. Detection Agent  : Uses detect.py (YOLO11) to find vehicles.
  2. Tracking Agent   : Uses track.py (ByteTrack) to assign persistent IDs.
  3. Analysis Agent   : Uses counter.py & traffic_analysis.py to compute metrics.
  4. Prediction Agent : Uses congestion.py (TFT) to forecast future congestion.
  5. Decision Agent   : Uses LangChain LLM (or heuristic fallback) to decide
                        if a route recommendation is necessary.
  6. Route Agent      : Uses route.py (A*) to find optimal detours.
  7. Reporting Agent  : Compiles the final JSON/text report.

Usage:
  from agent import TrafficWorkflow, WorkflowContext
  
  context = WorkflowContext(...) # holds instantiated backend classes
  workflow = TrafficWorkflow(context, llm=ChatOpenAI())
  
  # Process a single frame through the entire agentic pipeline
  state = workflow.invoke(
      frame=frame_img, 
      frame_index=1, 
      timestamp_ms=33.3,
      origin=(12.9716, 77.5946),
      destination=(12.9352, 77.6245)
  )
  print(state["report"])
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple, TypedDict

import numpy as np

# Try importing LangGraph (fail gracefully if not installed yet)
try:
    from langgraph.graph import StateGraph, END
    from langchain_core.prompts import PromptTemplate
    from langchain_core.language_models.chat_models import BaseChatModel
except ImportError:
    StateGraph = None
    BaseChatModel = None
    PromptTemplate = None

# Internal Backend Modules
from detect import Detection
from track import TrackState
from route import CongestionMap


# ──────────────────────────────────────────────────────────────────────────────
# State Schema
# ──────────────────────────────────────────────────────────────────────────────

class TrafficState(TypedDict):
    """
    The shared state dictionary passed between all agents in the graph.
    """
    # ── Inputs ─────────────────────────────────────────────────────────────────
    frame: np.ndarray                   # The BGR image array
    frame_index: int                    # Frame number
    timestamp_ms: float                 # Video stream timestamp
    camera_lat: float                   # Camera location for routing
    camera_lon: float
    origin: Tuple[float, float]         # Routing start (lat, lon)
    destination: Tuple[float, float]    # Routing end (lat, lon)
    
    # ── Populated by Agents ────────────────────────────────────────────────────
    detections: List[Detection]         # From DetectionAgent
    trajectories: List[TrackState]      # From TrackingAgent
    metrics: dict                       # From AnalysisAgent (FrameMetrics dict)
    forecast: dict                      # From PredictionAgent (TFT output dict)
    decision: str                       # From DecisionAgent ("ROUTE", "NO_ROUTE")
    decision_reason: str                # From DecisionAgent
    route_result: dict                  # From RouteAgent (comparison dict)
    report: str                         # From ReportingAgent
    execution_times: Dict[str, float]   # For performance profiling


# ──────────────────────────────────────────────────────────────────────────────
# Context (Stateful Dependencies)
# ──────────────────────────────────────────────────────────────────────────────

class WorkflowContext:
    """
    Holds the stateful backend instances (Detector, Tracker, Analyser, etc.)
    so they don't need to be re-initialized at every step of the graph.
    """
    def __init__(
        self,
        detector,
        tracker,
        counter,
        analyser,
        predictor,
        route_planner,
    ):
        self.detector = detector
        self.tracker = tracker
        self.counter = counter
        self.analyser = analyser
        self.predictor = predictor
        self.route_planner = route_planner


# ──────────────────────────────────────────────────────────────────────────────
# LangGraph Orchestrator
# ──────────────────────────────────────────────────────────────────────────────

class TrafficWorkflow:
    """
    Constructs and executes the LangGraph multi-agent workflow.
    """
    
    def __init__(self, context: WorkflowContext, llm: Optional[BaseChatModel] = None):
        if StateGraph is None:
            raise ImportError(
                "LangGraph is required. "
                "Install with: pip install langgraph langchain-core langchain-openai"
            )
            
        self.context = context
        self.llm = llm
        
        # Build the graph
        workflow = StateGraph(TrafficState)
        
        # Add nodes (agents)
        workflow.add_node("DetectionAgent", self._detection_node)
        workflow.add_node("TrackingAgent", self._tracking_node)
        workflow.add_node("AnalysisAgent", self._analysis_node)
        workflow.add_node("PredictionAgent", self._prediction_node)
        workflow.add_node("DecisionAgent", self._decision_node)
        workflow.add_node("RouteAgent", self._route_node)
        workflow.add_node("ReportingAgent", self._reporting_node)
        
        # Define edges (linear flow with one conditional branch)
        workflow.set_entry_point("DetectionAgent")
        workflow.add_edge("DetectionAgent", "TrackingAgent")
        workflow.add_edge("TrackingAgent", "AnalysisAgent")
        workflow.add_edge("AnalysisAgent", "PredictionAgent")
        workflow.add_edge("PredictionAgent", "DecisionAgent")
        
        # Conditional edge based on DecisionAgent's output
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

    def invoke(
        self,
        frame: np.ndarray,
        frame_index: int,
        timestamp_ms: float,
        camera_lat: float = 12.9716,
        camera_lon: float = 77.5946,
        origin: Tuple[float, float] = (12.9716, 77.5946),
        destination: Tuple[float, float] = (12.9352, 77.6245),
    ) -> TrafficState:
        """Run the full workflow on a single frame."""
        initial_state = {
            "frame": frame,
            "frame_index": frame_index,
            "timestamp_ms": timestamp_ms,
            "camera_lat": camera_lat,
            "camera_lon": camera_lon,
            "origin": origin,
            "destination": destination,
            "detections": [],
            "trajectories": [],
            "metrics": {},
            "forecast": {},
            "decision": "",
            "decision_reason": "",
            "route_result": {},
            "report": "",
            "execution_times": {},
        }
        return self.app.invoke(initial_state)

    # ── Graph Edges ───────────────────────────────────────────────────────────

    def _route_condition(self, state: TrafficState) -> str:
        """Determines whether to trigger the Route Agent."""
        return state.get("decision", "NO_ROUTE")

    # ── Agent Nodes ───────────────────────────────────────────────────────────

    def _detection_node(self, state: TrafficState) -> dict:
        t0 = time.time()
        # 1. Detection
        frame = state["frame"]
        result = self.context.detector.detect(frame)
        
        t_ms = (time.time() - t0) * 1000
        times = state.get("execution_times", {})
        times["detection_ms"] = t_ms
        
        return {
            "detections": result.detections,
            "execution_times": times
        }

    def _tracking_node(self, state: TrafficState) -> dict:
        t0 = time.time()
        # 2. Tracking (ByteTrack needs the original frame + detections)
        frame = state["frame"]
        detections = state["detections"]
        frame_idx = state["frame_index"]
        
        tracked_frame = self.context.tracker.update(
            frame=frame,
            detections=detections,
            frame_index=frame_idx,
            timestamp_ms=state["timestamp_ms"],
        )
        
        t_ms = (time.time() - t0) * 1000
        times = state["execution_times"]
        times["tracking_ms"] = t_ms
        
        return {
            "trajectories": tracked_frame.trajectories,
            # Pass ByteTrack's cleaned detections down the line
            "detections": tracked_frame.detections,
            "execution_times": times
        }

    def _analysis_node(self, state: TrafficState) -> dict:
        t0 = time.time()
        # 3. Analysis (Counter + Analyser)
        detections = state["detections"]
        trajectories = state["trajectories"]
        frame_idx = state["frame_index"]
        ts_ms = state["timestamp_ms"]
        
        # Run vehicle counter (line crossing)
        crossing_events = self.context.counter.update(
            detections=detections,
            frame_index=frame_idx,
        )
        
        # Run traffic analysis (density, speed, flow, composite score)
        metrics = self.context.analyser.update(
            detections=detections,
            trajectories=trajectories,
            crossing_events=crossing_events,
            frame_index=frame_idx,
            timestamp_ms=ts_ms,
        )
        
        t_ms = (time.time() - t0) * 1000
        times = state["execution_times"]
        times["analysis_ms"] = t_ms
        
        return {
            "metrics": metrics.to_dict(),
            "execution_times": times
        }

    def _prediction_node(self, state: TrafficState) -> dict:
        t0 = time.time()
        # 4. Prediction (Temporal Fusion Transformer)
        # We need the last N frames to feed the TFT.
        recent_history = self.context.analyser.get_history(last_n=60, as_dicts=True)
        
        forecast = self.context.predictor.predict_live(recent_history)
        
        t_ms = (time.time() - t0) * 1000
        times = state["execution_times"]
        times["prediction_ms"] = t_ms
        
        return {
            "forecast": forecast,
            "execution_times": times
        }

    def _decision_node(self, state: TrafficState) -> dict:
        """
        5. Decision Agent
        Analyzes the current metrics and TFT forecast to decide if an active
        route diversion is required.
        Uses an LLM if available, otherwise falls back to heuristics.
        """
        t0 = time.time()
        metrics = state["metrics"]
        forecast = state["forecast"]
        
        # Default fallback logic
        decision = "NO_ROUTE"
        reason = "Traffic is flowing normally."
        
        # Extract predictions
        f_15m = forecast.get("15min", {})
        q50_15m = f_15m.get("q50", 0.0)
        level_15m = f_15m.get("level_q50", "FREE_FLOW")
        
        curr_score = metrics.get("congestion_score", 0.0)
        curr_level = metrics.get("congestion_level", "FREE_FLOW")

        # ── LLM Decision (Agentic) ──
        if self.llm:
            prompt = PromptTemplate.from_template(
                "You are an intelligent Traffic Management Agent.\n"
                "Current Traffic State:\n"
                "- Score: {curr_score} ({curr_level})\n"
                "- Flow: {flow} vehicles/min\n"
                "- Speed: {speed} km/h\n\n"
                "15-Minute Forecast:\n"
                "- Expected Score: {q50_15m} ({level_15m})\n\n"
                "Based on this data, should we trigger a ROUTE diversion to avoid congestion?\n"
                "Respond with exactly one word on the first line: 'ROUTE' or 'NO_ROUTE'.\n"
                "On the second line, provide a 1-sentence reason."
            )
            try:
                response = self.llm.invoke(prompt.format(
                    curr_score=curr_score, curr_level=curr_level,
                    flow=metrics.get("traffic_flow_vpm", 0),
                    speed=metrics.get("average_speed_kmh", 0),
                    q50_15m=q50_15m, level_15m=level_15m
                ))
                lines = response.content.strip().split("\n")
                if lines:
                    dec = lines[0].strip().upper()
                    if dec in ("ROUTE", "NO_ROUTE"):
                        decision = dec
                    if len(lines) > 1:
                        reason = lines[1].strip()
            except Exception as e:
                print(f"[DecisionAgent] LLM failed, using fallback: {e}")

        # ── Fallback Heuristic ──
        if not self.llm or decision not in ("ROUTE", "NO_ROUTE"):
            if curr_level in ("HEAVY", "CONGESTED") or level_15m in ("HEAVY", "CONGESTED"):
                decision = "ROUTE"
                reason = f"Congestion is {level_15m} (Forecast) or {curr_level} (Current). Routing required."
            elif q50_15m - curr_score > 0.3:
                decision = "ROUTE"
                reason = "Congestion is rapidly increasing. Pre-emptive routing required."
            else:
                decision = "NO_ROUTE"
                reason = "Traffic levels are manageable. No diversion needed."

        t_ms = (time.time() - t0) * 1000
        times = state["execution_times"]
        times["decision_ms"] = t_ms
        
        return {
            "decision": decision,
            "decision_reason": reason,
            "execution_times": times
        }

    def _route_node(self, state: TrafficState) -> dict:
        t0 = time.time()
        # 6. Route Recommendation Agent
        # Uses RoutePlanner A* to compute alternatives
        
        # Inject the latest TFT forecast into the route planner graph
        cmap = CongestionMap.from_forecast(
            forecast=state["forecast"],
            graph=self.context.route_planner._graph,
            camera_lat=state["camera_lat"],
            camera_lon=state["camera_lon"],
            radius_m=500.0,
            horizon="15min"   # use 15min ahead for routing
        )
        self.context.route_planner.update_congestion(cmap)
        
        # Find best routes (Distance vs Congestion vs Forecast)
        comp = self.context.route_planner.compare_routes(
            origin=state["origin"],
            destination=state["destination"]
        )
        
        t_ms = (time.time() - t0) * 1000
        times = state["execution_times"]
        times["route_ms"] = t_ms
        
        return {
            "route_result": comp,
            "execution_times": times
        }

    def _reporting_node(self, state: TrafficState) -> dict:
        t0 = time.time()
        # 7. Reporting Agent
        # Compiles everything into a clean summary payload
        metrics = state["metrics"]
        
        report_lines = [
            f"=== Traffic Agent Report [Frame {state['frame_index']}] ===",
            f"Current Level : {metrics.get('congestion_level')} (Score: {metrics.get('congestion_score')})",
            f"Active Vehicles: {metrics.get('vehicle_count')} | Speed: {metrics.get('average_speed_kmh')} km/h",
            f"Forecast (15m): {state['forecast'].get('15min', {}).get('level_q50', 'UNKNOWN')}",
            f"Decision      : {state['decision']} - {state['decision_reason']}"
        ]
        
        if state["decision"] == "ROUTE" and state["route_result"]:
            res = state["route_result"]
            rec = res.get("recommendation", "")
            savings = res.get("savings", {})
            report_lines.append(f"Recommended   : {rec.upper()} Strategy")
            if savings.get("time_saved_min", 0) > 0:
                report_lines.append(f"Time Saved    : {savings['time_saved_min']} mins")
        
        report = "\n".join(report_lines)
        
        t_ms = (time.time() - t0) * 1000
        times = state["execution_times"]
        times["report_ms"] = t_ms
        times["total_pipeline_ms"] = sum(v for k,v in times.items() if k != "total_pipeline_ms")
        
        # (Optional) pass to LLM to generate a natural language executive summary here
        
        return {
            "report": report,
            "execution_times": times
        }
