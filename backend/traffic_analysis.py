"""
traffic_analysis.py — Real-Time Traffic Metrics and Analytics Engine
=====================================================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Computes six core traffic metrics per frame, maintains a rolling frame history,
and provides JSON export for the FastAPI layer, LangGraph agent, and TFT model.

Metrics calculated per frame:
    1. vehicle_count     — Number of vehicles visible in the frame
    2. vehicle_density   — Vehicles per 100m² of road area (HCM standard)
    3. average_speed_kmh — Mean speed of all tracked vehicles (Kalman estimate)
    4. traffic_flow      — Vehicles per minute (from VehicleCounter crossings)
    5. road_occupancy    — Fraction of road area covered by vehicle bounding boxes
    6. congestion_score  — Weighted composite score [0.0–1.0], maps to a level

Compatible with:
    - detect.py  → Detection, FrameResult  (vehicle_count, occupancy)
    - track.py   → TrackedFrame            (speed from trajectory deltas)
    - counter.py → VehicleCounter          (flow from crossing events)

No other file is imported from or modified.

Usage:
    from traffic_analysis import TrafficAnalyser, AnalysisConfig

    config = AnalysisConfig(frame_w=1280, frame_h=720, fps=30.0)
    analyser = TrafficAnalyser(config)

    # ── Frame loop ───────────────────────────────────────────────────────────
    for tracked_frame in tracker.track_video(\"Traffic.mp4\"):
        crossing_events = counter.update(tracked_frame.detections,
                                         frame_index=tracked_frame.frame_index)

        metrics = analyser.update(
            detections       = tracked_frame.detections,
            trajectories     = tracked_frame.trajectories,
            crossing_events  = crossing_events,
            frame_index      = tracked_frame.frame_index,
            timestamp_ms     = tracked_frame.timestamp_ms,
        )

        print(metrics.congestion_level)     # \"CONGESTED\", \"SLOW\", \"FREE_FLOW\" …
        print(metrics.to_dict())            # full JSON-ready dict

    # ── Bulk export ──────────────────────────────────────────────────────────
    analyser.export_json(\"run_analytics.json\")
    summary = analyser.get_session_summary()
    dashboard = analyser.get_dashboard_snapshot()
"""

from __future__ import annotations

import json
import math
import time
from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

# ── Shared types ───────────────────────────────────────────────────────────────
# traffic_analysis.py imports from detect.py only.
# It accepts List[Detection] (from detect.py OR track.py — they return the same type).
# counter.py CrossingEvent is imported for flow calculation.
from detect import CLASS_NAMES, Detection
from counter import CrossingEvent


# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

# HCM (Highway Capacity Manual) Level of Service thresholds.
# Congestion score → density level string.
# These match the notebook's DensityEstimator but are now configurable.
_SCORE_THRESHOLDS: List[Tuple[float, str]] = [
    (0.20, "FREE_FLOW"),
    (0.40, "LIGHT"),
    (0.60, "MODERATE"),
    (0.80, "HEAVY"),
    (1.01, "CONGESTED"),
]

# Congestion score weights — must sum to 1.0.
# Adjusted from notebook: speed weight increased, occupancy added.
_W_COUNT:      float = 0.25   # vehicle count contribution
_W_DENSITY:    float = 0.20   # density contribution
_W_SPEED:      float = 0.25   # speed contribution (inverted: slow → high score)
_W_OCCUPANCY:  float = 0.20   # road occupancy contribution
_W_FLOW:       float = 0.10   # traffic flow contribution

# Vehicle size estimates (metres) for real-world density calculation.
# These are used when pixels-per-metre calibration is not available.
_VEHICLE_AREA_M2: Dict[str, float] = {
    "car":        6.0,    # ~4.5m × 1.8m bumper-to-bumper
    "truck":     20.0,    # ~8m × 2.5m
    "bus":       30.0,    # ~12m × 2.5m
    "motorcycle": 2.0,    # ~2m × 1.0m
}

# Default assumed road area when not calibrated (metres²)
_DEFAULT_ROAD_AREA_M2: float = 500.0   # 25m × 20m approximate intersection zone

# Speed calibration: how many metres one pixel represents.
# Must be measured from the actual camera setup.
# Default: typical highway camera at 10m height viewing a 50m stretch.
_DEFAULT_M_PER_PX: float = 0.05        # 5 cm per pixel


# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class AnalysisConfig:
    """
    Configuration for the TrafficAnalyser.

    All tunable parameters are here. Nothing is hardcoded in the analyser.

    Attributes:
        frame_w             : Frame width in pixels.
        frame_h             : Frame height in pixels.
        fps                 : Video FPS (used to convert pixel-speed to km/h).
        metres_per_pixel    : Camera calibration. Multiply pixel distance by this
                              to get metres. Measure from a known ground marker.
        road_area_m2        : Estimated road area in the frame (m²).
                              Used as the denominator for density.
        congested_threshold : Vehicle count at which congestion_score → 1.0.
                              Tune based on intersection capacity.
        free_flow_speed_kmh : Expected vehicle speed under free-flow conditions.
                              Used to normalise speed into a 0–1 contribution.
        history_len         : Number of frames to keep in the rolling window.
                              3600 frames ≈ 2 minutes at 30 FPS.
        flow_window_s       : Time window (seconds) for flow rate calculation.
                              Default 60 = vehicles per minute.
        speed_smooth_n      : Number of frames used for per-track speed smoothing.
        export_path         : Default path for JSON export. None disables auto-export.
    """
    frame_w:             int   = 1280
    frame_h:             int   = 720
    fps:                 float = 30.0
    metres_per_pixel:    float = _DEFAULT_M_PER_PX
    road_area_m2:        float = _DEFAULT_ROAD_AREA_M2
    congested_threshold: int   = 50      # vehicles
    free_flow_speed_kmh: float = 60.0   # km/h
    history_len:         int   = 3600   # frames
    flow_window_s:       float = 60.0   # seconds for flow rate window
    speed_smooth_n:      int   = 5      # frames for per-track speed smoothing
    export_path:         Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# Output Dataclasses
# ──────────────────────────────────────────────────────────────────────────────

class CongestionLevel(str, Enum):
    """
    Five-level traffic density classification (HCM Level of Service inspired).

    Using str-Enum so values serialise to plain strings in JSON responses —
    no special FastAPI handling needed.
    """
    FREE_FLOW  = "FREE_FLOW"    # score ≤ 0.20  — traffic flows freely
    LIGHT      = "LIGHT"        # score ≤ 0.40  — minor interaction between vehicles
    MODERATE   = "MODERATE"     # score ≤ 0.60  — speed slightly affected
    HEAVY      = "HEAVY"        # score ≤ 0.80  — noticeably reduced speed
    CONGESTED  = "CONGESTED"    # score > 0.80  — stop-and-go or standstill


@dataclass
class FrameMetrics:
    """
    All computed traffic metrics for a single frame.

    Produced by TrafficAnalyser.update() and stored in the rolling history.
    Every field is JSON-serialisable.

    Metric definitions:
        vehicle_count     : Raw count of vehicles visible in this frame.
        vehicle_density   : count / road_area_m2 * 100 (vehicles per 100 m²).
        average_speed_kmh : Mean estimated speed of all tracked vehicles in km/h.
                            0.0 when no speed data is available.
        traffic_flow_vpm  : Vehicles per minute crossing counting lines,
                            computed over a rolling flow_window_s window.
        road_occupancy    : Sum of all bbox areas / frame area. Range [0.0, 1.0].
                            1.0 = every pixel is covered by a vehicle.
        congestion_score  : Weighted composite of all metrics. Range [0.0, 1.0].
        congestion_level  : Human-readable classification string.
        class_counts      : Per-class vehicle count for this frame.
        speed_by_class    : Mean speed per vehicle class (km/h).
        frame_index       : Source frame index.
        timestamp_ms      : Source frame timestamp (stream ms).
        wall_time_s       : Wall-clock time when this frame was processed.
    """
    frame_index:        int
    timestamp_ms:       float
    wall_time_s:        float

    # Core metrics
    vehicle_count:      int
    vehicle_density:    float        # vehicles / 100 m²
    average_speed_kmh:  float        # km/h
    traffic_flow_vpm:   float        # vehicles per minute
    road_occupancy:     float        # [0.0, 1.0]
    congestion_score:   float        # [0.0, 1.0]
    congestion_level:   str          # CongestionLevel value
    movement_direction: str = "Unknown" # e.g. Northbound, Southbound

    # Breakdowns
    class_counts:       Dict[str, int]    = field(default_factory=dict)
    speed_by_class:     Dict[str, float]  = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Return a fully JSON-serialisable dict."""
        return {
            "frame_index":       self.frame_index,
            "timestamp_ms":      round(self.timestamp_ms, 2),
            "wall_time_s":       round(self.wall_time_s, 4),
            "vehicle_count":     self.vehicle_count,
            "vehicle_density":   round(self.vehicle_density, 4),
            "average_speed_kmh": round(self.average_speed_kmh, 2),
            "traffic_flow_vpm":  round(self.traffic_flow_vpm, 2),
            "road_occupancy":    round(self.road_occupancy, 4),
            "congestion_score":  round(self.congestion_score, 4),
            "congestion_level":  self.congestion_level,
            "movement_direction":self.movement_direction,
            "class_counts":      self.class_counts,
            "speed_by_class":    {
                cls: round(spd, 2) for cls, spd in self.speed_by_class.items()
            },
        }


# ──────────────────────────────────────────────────────────────────────────────
# Internal per-track speed state
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class _SpeedState:
    """
    Rolling speed estimate for a single tracked vehicle.

    Speed is estimated from the displacement between consecutive trajectory
    points. We keep a small deque of recent displacement values and average
    them to suppress Kalman jitter.
    """
    track_id:  int
    class_name: str
    prev_pos:  Optional[Tuple[float, float]] = None     # (cx, cy) last frame
    speeds_px_per_frame: deque = field(
        default_factory=lambda: deque(maxlen=10)
    )

    def push(self, curr_pos: Tuple[float, float]) -> None:
        """Update with the new position and record displacement."""
        if self.prev_pos is not None:
            dx = curr_pos[0] - self.prev_pos[0]
            dy = curr_pos[1] - self.prev_pos[1]
            px_per_frame = math.sqrt(dx * dx + dy * dy)
            self.speeds_px_per_frame.append(px_per_frame)
        self.prev_pos = curr_pos

    @property
    def avg_px_per_frame(self) -> float:
        """Rolling average displacement in pixels per frame."""
        data = list(self.speeds_px_per_frame)
        return sum(data) / len(data) if data else 0.0


# ──────────────────────────────────────────────────────────────────────────────
# Traffic Analyser
# ──────────────────────────────────────────────────────────────────────────────

class TrafficAnalyser:
    """
    Real-time traffic metrics engine.

    Design decisions:
    ──────────────────
    1. SINGLE-PASS — update() accepts all pipeline outputs in one call
       (detections from detect.py/track.py, trajectories from track.py,
       crossing events from counter.py). No inter-module polling.

    2. RING BUFFER — frame history is stored in a bounded deque. At 30 FPS for
       2 hours that's 216,000 frames. With history_len=3600 we keep only the
       last 2 minutes — enough for the TFT model's look-back window.

    3. SPEED FROM TRAJECTORIES — we compute speed from the trajectory delta
       (curr_pos - prev_pos per frame). This uses the actual pixel movement
       recorded by ByteTrack's Kalman filter, which is smoother than raw bbox
       centre differences.

    4. FLOW FROM COUNTER — vehicles per minute is computed from CrossingEvent
       timestamps inside a rolling window (flow_window_s seconds). This is more
       accurate than counting visible vehicles per frame, which double-counts
       vehicles that span multiple frames.

    5. OCCUPANCY FROM BBOXES — road occupancy = sum(w*h for all detections) /
       (frame_w * frame_h). This is a proxy for the fraction of road space
       occupied, directly computable from Detection.bbox without calibration.

    6. CONGESTION SCORE — weighted sum of five normalised sub-scores.
       Weights are in the module-level constants (_W_*) and can be tuned.
       Formula: score = w_count*n_count + w_density*n_density +
                        w_speed*(1-n_speed) + w_occupancy*n_occ + w_flow*n_flow
       The speed term is inverted (1 - normalised_speed) because lower speed
       → higher congestion.

    7. SMOOTHING — congestion_score is smoothed over a 15-frame window to
       prevent the dashboard from flickering on brief detection gaps.
    """

    def __init__(self, config: Optional[AnalysisConfig] = None) -> None:
        """
        Args:
            config: AnalysisConfig instance. Uses defaults if None.
        """
        self.config = config or AnalysisConfig()

        # ── Frame history (ring buffer) ──────────────────────────────────────
        # Stores FrameMetrics objects up to config.history_len frames.
        # Used by: TFT model input, session summary, export, dashboard.
        self._history: deque = deque(maxlen=self.config.history_len)

        # ── Per-track speed state ────────────────────────────────────────────
        # Key: track_id (int from ByteTrack)
        # Value: _SpeedState
        # Persists across frames so displacement history accumulates.
        self._speed_states: Dict[int, _SpeedState] = {}

        # ── Crossing event buffer for flow calculation ────────────────────────
        # Stores (wall_time_s, event) tuples.
        # Events older than flow_window_s are pruned each frame.
        self._crossing_buffer: deque = deque(maxlen=10_000)

        # ── Congestion score smoothing window ────────────────────────────────
        self._score_window: deque = deque(maxlen=15)

        # ── Session counters ─────────────────────────────────────────────────
        self._session_start: float = time.monotonic()
        self._frames_processed: int = 0
        self._total_crossings: int = 0

        # ── Last computed metrics (for quick access) ─────────────────────────
        self._last_metrics: Optional[FrameMetrics] = None

        print(
            f"[Analyser] Initialised\n"
            f"  Frame   : {self.config.frame_w}×{self.config.frame_h}  "
            f"FPS={self.config.fps}\n"
            f"  Road    : {self.config.road_area_m2} m²  "
            f"m/px={self.config.metres_per_pixel}\n"
            f"  History : {self.config.history_len} frames  "
            f"Flow window: {self.config.flow_window_s}s"
        )

    # ── Core update ───────────────────────────────────────────────────────────

    def update(
        self,
        detections:       List[Detection],
        trajectories:     Optional[Dict[int, List[Tuple[float, float]]]] = None,
        crossing_events:  Optional[List[CrossingEvent]] = None,
        frame_index:      int   = 0,
        timestamp_ms:     float = 0.0,
    ) -> FrameMetrics:
        """
        Compute all traffic metrics for one frame and store the result.

        Call once per frame inside the main processing loop:

            metrics = analyser.update(
                detections      = tracked_frame.detections,
                trajectories    = tracked_frame.trajectories,
                crossing_events = counter.update(tracked_frame.detections, ...),
                frame_index     = tracked_frame.frame_index,
                timestamp_ms    = tracked_frame.timestamp_ms,
            )

        Args:
            detections      : List[Detection] from detect.py or track.py.
                              Used for: vehicle_count, road_occupancy, class_counts.
            trajectories    : {track_id: [(cx,cy),...]} from TrackedFrame.trajectories.
                              Used for: average_speed_kmh, speed_by_class.
                              Pass None when using detect.py (no tracking).
            crossing_events : List[CrossingEvent] from counter.update().
                              Used for: traffic_flow_vpm.
                              Pass None or [] if counter is not active.
            frame_index     : Sequential frame number from the video stream.
            timestamp_ms    : Stream position in milliseconds.

        Returns:
            FrameMetrics with all six metrics computed and ready for JSON export.
        """
        now = time.monotonic()
        self._frames_processed += 1

        # ── 1. Vehicle count ──────────────────────────────────────────────────
        vehicle_count = len(detections)
        class_counts = self._compute_class_counts(detections)

        # ── 2. Road occupancy ─────────────────────────────────────────────────
        road_occupancy = self._compute_occupancy(detections)

        # ── 3. Vehicle density ────────────────────────────────────────────────
        vehicle_density = self._compute_density(vehicle_count)

        # ── 4. Average speed ──────────────────────────────────────────────────
        average_speed_kmh, speed_by_class = self._compute_speed(
            detections=detections,
            trajectories=trajectories or {},
        )

        # ── 5. Traffic flow ───────────────────────────────────────────────────
        # Register new crossing events into the rolling buffer
        if crossing_events:
            for evt in crossing_events:
                self._crossing_buffer.append((now, evt))
            self._total_crossings += len(crossing_events)

        traffic_flow_vpm = self._compute_flow(now)

        # ── 6. Congestion score ───────────────────────────────────────────────
        raw_score = self._compute_congestion_score(
            vehicle_count    = vehicle_count,
            vehicle_density  = vehicle_density,
            average_speed_kmh= average_speed_kmh,
            road_occupancy   = road_occupancy,
            traffic_flow_vpm = traffic_flow_vpm,
        )

        # Apply temporal smoothing over the last 15 frames
        self._score_window.append(raw_score)
        congestion_score = sum(self._score_window) / len(self._score_window)

        congestion_level = self._classify(congestion_score)

        # ── 7. Movement Direction ──────────────────────────────────────────────
        movement_direction = self._compute_movement_direction(trajectories or {})

        # ── Build FrameMetrics ────────────────────────────────────────────────
        metrics = FrameMetrics(
            frame_index       = frame_index,
            timestamp_ms      = timestamp_ms,
            wall_time_s       = now,
            vehicle_count     = vehicle_count,
            vehicle_density   = vehicle_density,
            average_speed_kmh = average_speed_kmh,
            traffic_flow_vpm  = traffic_flow_vpm,
            road_occupancy    = road_occupancy,
            congestion_score  = congestion_score,
            congestion_level  = congestion_level,
            movement_direction= movement_direction,
            class_counts      = class_counts,
            speed_by_class    = speed_by_class,
        )

        # Store in ring buffer
        self._history.append(metrics)
        self._last_metrics = metrics
        return metrics

    # ── Metric calculations ───────────────────────────────────────────────────

    def _compute_class_counts(self, detections: List[Detection]) -> Dict[str, int]:
        """
        Count vehicles by class in the current frame.

        Returns:
            {'car': 5, 'truck': 2, 'bus': 0, 'motorcycle': 1}
        """
        counts: Dict[str, int] = {name: 0 for name in CLASS_NAMES}
        for det in detections:
            counts[det.class_name] = counts.get(det.class_name, 0) + 1
        return counts

    def _compute_occupancy(self, detections: List[Detection]) -> float:
        """
        Compute road occupancy as the fraction of frame area covered by bboxes.

        Formula:
            occupancy = Σ(bbox_area) / (frame_w × frame_h)

        Why frame area as denominator instead of road area?
        ─────────────────────────────────────────────────────
        Road area in m² requires camera calibration. Frame area in pixels is
        always known and gives a consistent proxy for occupancy that correlates
        directly with visual congestion. Values near 0.30+ indicate severe
        congestion in typical CCTV footage.

        Returns:
            Float in [0.0, 1.0]. Clamped to 1.0 for overlapping detections.
        """
        if not detections:
            return 0.0
        frame_area = float(self.config.frame_w * self.config.frame_h)
        total_bbox_area = sum(det.area for det in detections)
        return min(1.0, total_bbox_area / frame_area)

    def _compute_density(self, vehicle_count: int) -> float:
        """
        Compute vehicle density in vehicles per 100 m² of road area.

        Formula:
            density = (vehicle_count / road_area_m2) × 100

        Why 100 m²?
        ────────────
        Raw density (vehicles/m²) is very small and hard to interpret.
        Per-100-m² matches the HCM density notation used in traffic engineering
        literature and makes dashboard numbers intuitive (2.5 means 2.5 vehicles
        per 100 square metres of observed road).

        Returns:
            Float ≥ 0.0.
        """
        if self.config.road_area_m2 <= 0:
            return 0.0
        return (vehicle_count / self.config.road_area_m2) * 100.0

    def _compute_movement_direction(self, trajectories: Dict[int, List[Tuple[float, float]]]) -> str:
        """
        Estimate the overall dominant movement direction of traffic in this frame.
        Computes the net vector of all active trajectories.
        """
        if not trajectories:
            return "Unknown"
        
        total_dx = 0.0
        total_dy = 0.0
        
        for traj in trajectories.values():
            if len(traj) >= 2:
                # Compare oldest point in trajectory buffer to newest
                dx = traj[-1][0] - traj[0][0]
                dy = traj[-1][1] - traj[0][1]
                total_dx += dx
                total_dy += dy
                
        if total_dx == 0 and total_dy == 0:
            return "Static"
            
        # Determine dominant axis
        if abs(total_dx) > abs(total_dy):
            return "Eastbound" if total_dx > 0 else "Westbound"
        else:
            return "Southbound" if total_dy > 0 else "Northbound"

    def _compute_speed(
        self,
        detections:   List[Detection],
        trajectories: Dict[int, List[Tuple[float, float]]],
    ) -> Tuple[float, Dict[str, float]]:
        """
        Estimate average vehicle speed from trajectory point-to-point deltas.

        Algorithm:
        ──────────
        For each tracked vehicle (track_id present in Detection.track_id):
          1. Look up its trajectory from the trajectories dict (last 2 points).
          2. Compute pixel displacement: Δpx = √((Δx)² + (Δy)²)
          3. Convert to m/frame: Δm = Δpx × metres_per_pixel
          4. Convert to km/h: v = Δm × fps × 3.6
          5. Push into _SpeedState rolling buffer, read back smoothed average.

        Why use trajectory last-2 points instead of all-points average?
        ─────────────────────────────────────────────────────────────────
        The trajectory includes historical positions. We want the current
        instantaneous speed — just the most recent movement. The _SpeedState
        smoothing deque averages the last 10 frame-displacements which is the
        right balance: smooth enough to suppress jitter, fast enough to respond
        to braking within ~0.3s.

        Args:
            detections  : Current frame detections (for class lookup).
            trajectories: {track_id: [(cx,cy),...]} from TrackedFrame.

        Returns:
            (average_speed_kmh, speed_by_class_dict)
            average_speed_kmh is 0.0 when no trajectory data is available
            (e.g., when using detect.py without track.py).
        """
        if not trajectories:
            return 0.0, {}

        # Build class lookup from active detections
        track_class: Dict[int, str] = {
            det.track_id: det.class_name
            for det in detections
            if det.track_id is not None
        }

        frame_speeds: List[float] = []
        class_speed_acc: Dict[str, List[float]] = {name: [] for name in CLASS_NAMES}
        mpp = self.config.metres_per_pixel
        fps = self.config.fps

        for tid, traj in trajectories.items():
            if not traj:
                continue

            curr_pos = traj[-1]  # Most recent point
            cls_name = track_class.get(tid, "car")

            # Initialise or update speed state
            if tid not in self._speed_states:
                self._speed_states[tid] = _SpeedState(
                    track_id=tid,
                    class_name=cls_name,
                )
            sp_state = self._speed_states[tid]
            sp_state.push(curr_pos)

            px_per_frame = sp_state.avg_px_per_frame
            if px_per_frame <= 0:
                continue

            # Convert: px/frame → m/s → km/h
            speed_kmh = px_per_frame * mpp * fps * 3.6
            frame_speeds.append(speed_kmh)
            class_speed_acc[cls_name].append(speed_kmh)

        # Prune _SpeedState for tracks not seen this frame (memory management)
        active_ids = set(trajectories.keys())
        stale = [tid for tid in self._speed_states if tid not in active_ids]
        for tid in stale:
            del self._speed_states[tid]

        avg_speed = sum(frame_speeds) / len(frame_speeds) if frame_speeds else 0.0
        speed_by_class = {
            cls: round(sum(v) / len(v), 2)
            for cls, v in class_speed_acc.items()
            if v
        }

        return avg_speed, speed_by_class

    def _compute_flow(self, now: float) -> float:
        """
        Compute traffic flow as vehicles per minute crossing any counting line.

        Uses a rolling time window (config.flow_window_s seconds).
        Events older than the window are pruned from the buffer.

        Why time-based window instead of frame-count window?
        ──────────────────────────────────────────────────────
        Frame count is unreliable if skip_frames > 0 or if processing drops
        frames. Time-based window gives consistent flow rates regardless of
        processing speed.

        Returns:
            Vehicles per minute (float). 0.0 if no crossing events in window.
        """
        window_s = self.config.flow_window_s

        # Prune events outside the window
        cutoff = now - window_s
        while self._crossing_buffer and self._crossing_buffer[0][0] < cutoff:
            self._crossing_buffer.popleft()

        count_in_window = len(self._crossing_buffer)
        if count_in_window == 0 or window_s <= 0:
            return 0.0

        # Scale to per-minute
        return (count_in_window / window_s) * 60.0

    def _compute_congestion_score(
        self,
        vehicle_count:     int,
        vehicle_density:   float,
        average_speed_kmh: float,
        road_occupancy:    float,
        traffic_flow_vpm:  float,
    ) -> float:
        """
        Compute weighted composite congestion score in [0.0, 1.0].

        Formula:
            n_count    = clamp(count / congested_threshold, 0, 1)
            n_density  = clamp(density / density_at_congestion, 0, 1)
            n_speed    = clamp(speed / free_flow_speed, 0, 1)
            n_occ      = clamp(occupancy / 0.5, 0, 1)   ← 50% coverage = fully congested
            n_flow     = clamp(flow / max_expected_flow, 0, 1)

            score = w_count*n_count + w_density*n_density
                  + w_speed*(1 - n_speed)               ← speed is inverted
                  + w_occupancy*n_occ + w_flow*n_flow

        Why invert speed?
        ──────────────────
        Free-flow speed → normalised_speed → 1.0.
        High speed means LOW congestion, so (1 - n_speed) → 0.
        Stop-and-go → speed near 0 → (1 - n_speed) → 1 → high score.

        Returns:
            Float in [0.0, 1.0]. Rounded to 4 decimal places.
        """
        cfg = self.config

        # Normalise each sub-metric to [0.0, 1.0]
        n_count = min(1.0, vehicle_count / max(1, cfg.congested_threshold))

        # Density at congestion = congested_threshold / road_area * 100
        density_at_congestion = (cfg.congested_threshold / max(1.0, cfg.road_area_m2)) * 100.0
        n_density = min(1.0, vehicle_density / max(0.001, density_at_congestion))

        # Speed: 0 = stopped (congested), free_flow_speed = uncongested
        n_speed = min(1.0, average_speed_kmh / max(1.0, cfg.free_flow_speed_kmh))

        # Occupancy: 0.50 = 50% of frame covered = high congestion reference
        n_occ = min(1.0, road_occupancy / 0.50)

        # Flow: max expected flow ≈ congested_threshold / (flow_window_s/60)
        max_flow = cfg.congested_threshold / max(0.001, cfg.flow_window_s / 60.0)
        n_flow = min(1.0, traffic_flow_vpm / max(0.001, max_flow))

        score = (
            _W_COUNT     * n_count
            + _W_DENSITY * n_density
            + _W_SPEED   * (1.0 - n_speed)   # inverted
            + _W_OCCUPANCY * n_occ
            + _W_FLOW    * n_flow
        )
        return min(1.0, max(0.0, score))

    @staticmethod
    def _classify(score: float) -> str:
        """
        Map a congestion score [0.0, 1.0] to a CongestionLevel string.

        Thresholds are defined in _SCORE_THRESHOLDS at the module level.
        """
        for threshold, level in _SCORE_THRESHOLDS:
            if score < threshold:
                return level
        return CongestionLevel.CONGESTED.value

    # ── History and statistics API ────────────────────────────────────────────

    @property
    def last_metrics(self) -> Optional[FrameMetrics]:
        """Most recent FrameMetrics. None if no frames have been processed."""
        return self._last_metrics

    @property
    def frames_processed(self) -> int:
        """Total frames passed to update() in this session."""
        return self._frames_processed

    def get_history(
        self,
        last_n: Optional[int] = None,
        as_dicts: bool = False,
    ) -> Union[List[FrameMetrics], List[dict]]:
        """
        Return the frame metrics history.

        Args:
            last_n   : Return only the last N frames. None returns all history.
            as_dicts : If True, return list of dicts (JSON-ready).
                       If False, return FrameMetrics objects.

        Returns:
            List of FrameMetrics or dicts, oldest first.
        """
        data = list(self._history)
        if last_n is not None:
            data = data[-last_n:]
        if as_dicts:
            return [m.to_dict() for m in data]
        return data

    def get_session_summary(self) -> dict:
        """
        Return aggregated statistics for the entire session.

        Includes: min/max/mean for each metric, per-class totals,
        time breakdown by congestion level, session duration.

        Returns:
            JSON-serialisable dict suitable for the FastAPI /api/analytics/summary
            endpoint and for feeding into the LangGraph decision agent.
        """
        history = list(self._history)
        if not history:
            return {
                "status": "no_data",
                "frames_processed": self._frames_processed,
            }

        elapsed = time.monotonic() - self._session_start

        # Aggregate per metric
        counts       = [m.vehicle_count      for m in history]
        densities    = [m.vehicle_density     for m in history]
        speeds       = [m.average_speed_kmh   for m in history if m.average_speed_kmh > 0]
        flows        = [m.traffic_flow_vpm    for m in history]
        occupancies  = [m.road_occupancy      for m in history]
        scores       = [m.congestion_score    for m in history]

        # Time at each congestion level (fraction of frames)
        level_counts: Dict[str, int] = {lv.value: 0 for lv in CongestionLevel}
        for m in history:
            level_counts[m.congestion_level] = level_counts.get(m.congestion_level, 0) + 1
        total_frames = len(history)
        level_fractions = {
            lv: round(cnt / total_frames, 4)
            for lv, cnt in level_counts.items()
        }

        # Class-level speed averages over the session
        cls_speeds: Dict[str, List[float]] = {name: [] for name in CLASS_NAMES}
        for m in history:
            for cls, spd in m.speed_by_class.items():
                if spd > 0:
                    cls_speeds[cls].append(spd)

        def _stats(vals: List[float]) -> dict:
            if not vals:
                return {"min": 0.0, "max": 0.0, "mean": 0.0}
            return {
                "min":  round(min(vals), 2),
                "max":  round(max(vals), 2),
                "mean": round(sum(vals) / len(vals), 2),
            }

        return {
            "session_duration_s":   round(elapsed, 2),
            "frames_processed":     self._frames_processed,
            "frames_in_history":    total_frames,
            "total_crossings":      self._total_crossings,
            "metrics": {
                "vehicle_count":     _stats(counts),
                "vehicle_density":   _stats(densities),
                "average_speed_kmh": _stats(speeds),
                "traffic_flow_vpm":  _stats(flows),
                "road_occupancy":    _stats(occupancies),
                "congestion_score":  _stats(scores),
            },
            "speed_by_class": {
                cls: _stats(vals) for cls, vals in cls_speeds.items() if vals
            },
            "congestion_level_distribution": level_fractions,
            "current": self._last_metrics.to_dict() if self._last_metrics else None,
        }

    def get_dashboard_snapshot(self) -> dict:
        """
        Return a lightweight dict optimised for real-time dashboard WebSocket push.

        Contains only what the React dashboard needs per update:
          - current frame metrics
          - last 300 frames of time-series data (for charts)
          - session-level totals

        This is called by the FastAPI WebSocket handler every N frames.
        Keeping it fast is important: no heavy aggregation.

        Returns:
            JSON-serialisable dict.
        """
        current = self._last_metrics
        if current is None:
            return {"status": "no_data"}

        # Last 300 frames for time-series charts (~10s at 30fps)
        recent = list(self._history)[-300:]

        return {
            "current": current.to_dict(),
            "time_series": {
                "frame_indices":      [m.frame_index       for m in recent],
                "timestamp_ms":       [m.timestamp_ms       for m in recent],
                "vehicle_counts":     [m.vehicle_count      for m in recent],
                "congestion_scores":  [m.congestion_score   for m in recent],
                "congestion_levels":  [m.congestion_level   for m in recent],
                "avg_speeds_kmh":     [round(m.average_speed_kmh, 1) for m in recent],
                "road_occupancies":   [round(m.road_occupancy, 4)    for m in recent],
                "traffic_flows_vpm":  [round(m.traffic_flow_vpm, 1)  for m in recent],
            },
            "totals": {
                "frames_processed": self._frames_processed,
                "total_crossings":  self._total_crossings,
                "session_s":        round(time.monotonic() - self._session_start, 1),
            },
        }

    def get_tft_input(self, lookback: int = 168) -> dict:
        """
        Return a structured input dict for the Temporal Fusion Transformer model.

        The TFT model expects a multivariate time-series of length `lookback`.
        This method extracts the last `lookback` frames from history and packages
        them as named feature arrays.

        Why 168?
        ─────────
        168 = 24 hours × 7 days of hourly data, which is typical for traffic
        TFT training. For real-time streaming at 30 FPS with a 5-minute
        look-back window: lookback = 30 * 60 * 5 = 9000 (override as needed).

        Args:
            lookback: Number of historical frames to include.

        Returns:
            Dict with 'features' (list of dicts per timestep), 'length' (int),
            'feature_names' (list of str).
        """
        history = list(self._history)[-lookback:]
        feature_names = [
            "vehicle_count",
            "vehicle_density",
            "average_speed_kmh",
            "traffic_flow_vpm",
            "road_occupancy",
            "congestion_score",
        ]

        features = [
            {
                "frame_index":       m.frame_index,
                "timestamp_ms":      m.timestamp_ms,
                "vehicle_count":     m.vehicle_count,
                "vehicle_density":   m.vehicle_density,
                "average_speed_kmh": m.average_speed_kmh,
                "traffic_flow_vpm":  m.traffic_flow_vpm,
                "road_occupancy":    m.road_occupancy,
                "congestion_score":  m.congestion_score,
            }
            for m in history
        ]

        return {
            "features":      features,
            "length":        len(features),
            "feature_names": feature_names,
        }

    # ── Export ────────────────────────────────────────────────────────────────

    def export_json(
        self,
        path: Union[str, Path, None] = None,
        include_history: bool = True,
    ) -> Path:
        """
        Export the full session analytics to a JSON file.

        File structure:
        {
            "session_summary": { ... },
            "history": [ { per-frame metrics }, ... ]   ← if include_history
        }

        Args:
            path           : Output file path. Uses config.export_path if None.
                             Falls back to "analytics_<timestamp>.json" in cwd.
            include_history: If True, embed every FrameMetrics in the export.
                             Set False to export summary only (smaller file).

        Returns:
            Path of the written file.

        Raises:
            ValueError: If no path is configured and config.export_path is None.
        """
        if path is None:
            if self.config.export_path:
                path = Path(self.config.export_path)
            else:
                ts = int(time.time())
                path = Path(f"analytics_{ts}.json")

        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        payload: dict = {
            "session_summary": self.get_session_summary(),
        }
        if include_history:
            payload["history"] = self.get_history(as_dicts=True)

        with open(path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, ensure_ascii=False)

        size_kb = path.stat().st_size / 1024
        print(
            f"[Analyser] Exported analytics → {path}\n"
            f"  Frames  : {self._frames_processed}\n"
            f"  File    : {size_kb:.1f} KB"
        )
        return path

    # ── Session management ────────────────────────────────────────────────────

    def reset(self) -> None:
        """
        Reset all session state.

        Clears: frame history, crossing buffer, speed states, score window,
        session counters.

        Use when switching to a new video source. Does NOT change config.
        """
        self._history.clear()
        self._crossing_buffer.clear()
        self._speed_states.clear()
        self._score_window.clear()
        self._session_start = time.monotonic()
        self._frames_processed = 0
        self._total_crossings = 0
        self._last_metrics = None
        print("[Analyser] Reset — session state cleared.")

    # ── Introspection ─────────────────────────────────────────────────────────

    def __repr__(self) -> str:
        lm = self._last_metrics
        level = lm.congestion_level if lm else "N/A"
        score = f"{lm.congestion_score:.3f}" if lm else "N/A"
        return (
            f"TrafficAnalyser("
            f"frames={self._frames_processed}, "
            f"history={len(self._history)}/{self.config.history_len}, "
            f"level={level}, score={score})"
        )
