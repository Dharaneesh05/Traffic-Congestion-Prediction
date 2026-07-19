"""
counter.py — Virtual Line Vehicle Counter
==========================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Counts vehicles crossing configurable virtual counting lines using the
cross-product sign-change algorithm. Tracks direction (inbound/outbound),
per-class breakdown, per-lane counts, and emits structured crossing events.

Compatible with:
    - track.py  → TrackedFrame.detections  (primary, track_id populated)
    - detect.py → FrameResult.detections   (fallback, track_id may be None)

Cross-product algorithm explained:
────────────────────────────────────
For a line from P1→P2 and a point Q, the cross product z-component is:
    z = (P2.x - P1.x) * (Q.y - P1.y) - (P2.y - P1.y) * (Q.x - P1.x)

When a vehicle moves from position prev to curr:
    sign(z_prev) ≠ sign(z_curr)  →  vehicle crossed the line
    sign tells us the direction (which side the vehicle came from)

This is geometrically exact — no bounding box overlap needed.

Usage:
    from counter import VehicleCounter, LineConfig

    # ── Define counting lines ────────────────────────────────────────────────
    # Coordinates are RELATIVE (0.0–1.0 of frame width/height)
    # so lines are resolution-independent
    lines = [
        LineConfig(name="Entry",  p1=(0.05, 0.5), p2=(0.95, 0.5),
                   direction="both",  color=(0, 255, 0)),
        LineConfig(name="Exit",   p1=(0.05, 0.75), p2=(0.95, 0.75),
                   direction="both",  color=(0, 100, 255)),
    ]

    # ── Lanes (optional, vertical strips within each counting line) ──────────
    from counter import LaneConfig
    lanes = [
        LaneConfig(name="Lane 1", x_start=0.0,  x_end=0.33),
        LaneConfig(name="Lane 2", x_start=0.33, x_end=0.66),
        LaneConfig(name="Lane 3", x_start=0.66, x_end=1.0),
    ]

    counter = VehicleCounter(lines=lines, lanes=lanes, frame_w=1280, frame_h=720)

    # ── Frame loop (from Tracker) ────────────────────────────────────────────
    for tracked_frame in tracker.track_video("Traffic.mp4"):
        events = counter.update(tracked_frame.detections)

        for event in events:
            print(event)  # CrossingEvent objects

        stats = counter.get_stats()       # full JSON statistics
        print(counter.get_summary())      # quick human-readable summary

    # ── Reset for time-windowed counting ─────────────────────────────────────
    counter.reset_counts()   # clear counts but keep line definitions
"""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Union

import numpy as np

# ── Shared types from detect.py ───────────────────────────────────────────────
# counter.py accepts Detection objects — the common currency of the pipeline.
# We do NOT import from track.py to avoid a circular dependency.
# Both detect.py (FrameResult.detections) and track.py (TrackedFrame.detections)
# produce List[Detection], so counter.py works with both.
from detect import CLASS_NAMES, Detection


# ──────────────────────────────────────────────────────────────────────────────
# Configuration Dataclasses
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class LaneConfig:
    """
    Defines a vertical lane strip within a counting line.

    Lanes divide the horizontal span of a counting line into named segments.
    A crossing event is assigned to a lane based on where (horizontally)
    the vehicle crossed the line.

    Attributes:
        name    : Human-readable lane label (e.g. "Lane 1", "Fast Lane").
        x_start : Left edge of the lane as a fraction of frame width [0.0, 1.0].
        x_end   : Right edge of the lane as a fraction of frame width [0.0, 1.0].

    Example:
        3-lane road dividing the frame into thirds:
        LaneConfig("Lane 1", 0.0,  0.33)
        LaneConfig("Lane 2", 0.33, 0.66)
        LaneConfig("Lane 3", 0.66, 1.0)
    """
    name: str
    x_start: float   # relative [0.0, 1.0]
    x_end: float     # relative [0.0, 1.0]

    def __post_init__(self) -> None:
        if not (0.0 <= self.x_start < self.x_end <= 1.0):
            raise ValueError(
                f"LaneConfig '{self.name}': x_start ({self.x_start}) must be "
                f"< x_end ({self.x_end}) and both in [0.0, 1.0]."
            )


@dataclass
class LineConfig:
    """
    Configuration for a single virtual counting line.

    Coordinates use relative values (0.0–1.0) so the same configuration
    works for any video resolution. They are converted to pixel coordinates
    when VehicleCounter is initialised with frame_w and frame_h.

    Attributes:
        name      : Unique label (used as dict key in stats output).
        p1        : Start point as (x_frac, y_frac) in [0.0, 1.0].
        p2        : End point   as (x_frac, y_frac) in [0.0, 1.0].
        direction : Which crossings to count.
                    "both"     → count vehicles going in both directions
                    "positive" → count only positive-to-negative sign change
                    "negative" → count only negative-to-positive sign change
                    Positive/negative refers to the cross-product sign on the
                    vehicle's previous position.
        color     : BGR tuple for visualization (used by other modules).

    Example:
        # Horizontal mid-frame entry line
        LineConfig("Entry", p1=(0.05, 0.5), p2=(0.95, 0.5), direction="both")
    """
    name: str
    p1: Tuple[float, float]    # (x_frac, y_frac)
    p2: Tuple[float, float]    # (x_frac, y_frac)
    direction: str = "both"    # "both" | "positive" | "negative"
    color: Tuple[int, int, int] = (0, 255, 0)   # BGR, green default

    def __post_init__(self) -> None:
        if self.direction not in ("both", "positive", "negative"):
            raise ValueError(
                f"LineConfig '{self.name}': direction must be "
                f"'both', 'positive', or 'negative'. Got: '{self.direction}'"
            )


# ──────────────────────────────────────────────────────────────────────────────
# Runtime State (internal use only)
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class _LineState:
    """
    Live state for one counting line.

    Holds pixel-space coordinates and all accumulated counts.
    This is an internal class — external callers interact via VehicleCounter.
    """
    config: LineConfig

    # Pixel coordinates (computed from relative config + frame dimensions)
    px1: Tuple[float, float] = field(default=(0.0, 0.0))
    px2: Tuple[float, float] = field(default=(0.0, 0.0))

    # Per-direction crossing totals
    count_positive: int = 0   # vehicle was on the positive side → crossed to negative
    count_negative: int = 0   # vehicle was on the negative side → crossed to positive

    # Per-class counts (both directions combined)
    class_counts: Dict[str, int] = field(
        default_factory=lambda: {name: 0 for name in CLASS_NAMES}
    )

    # Per-lane counts: {lane_name: {class_name: count}}
    lane_counts: Dict[str, Dict[str, int]] = field(default_factory=dict)

    @property
    def total(self) -> int:
        """Total crossings in both directions."""
        return self.count_positive + self.count_negative

    def reset_counts(self) -> None:
        """Reset all counters while keeping coordinates."""
        self.count_positive = 0
        self.count_negative = 0
        self.class_counts = {name: 0 for name in CLASS_NAMES}
        self.lane_counts = {
            lane_name: {name: 0 for name in CLASS_NAMES}
            for lane_name in self.lane_counts
        }


# ──────────────────────────────────────────────────────────────────────────────
# Crossing Event
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class CrossingEvent:
    """
    A single vehicle-line crossing event.

    Emitted by VehicleCounter.update() for every confirmed crossing.
    These events are consumed by traffic_analysis.py, the LangGraph agent,
    and stored in the database by the FastAPI layer.

    Attributes:
        track_id     : Permanent ByteTrack ID of the crossing vehicle.
                       None if called with untracked detections (detect.py path).
        class_name   : Vehicle class ("car", "truck", "bus", "motorcycle").
        class_id     : Numeric class index.
        line_name    : Name of the crossed counting line.
        direction    : "positive" or "negative" (which side the vehicle came from).
        lane_name    : Name of the lane where the crossing occurred.
                       None if no lanes are configured.
        crossing_x   : X pixel coordinate of the crossing midpoint.
        crossing_y   : Y pixel coordinate of the crossing midpoint.
        timestamp_ms : Wall-clock time of the event in milliseconds.
        frame_index  : Frame number where the crossing was detected.
    """
    track_id: Optional[int]
    class_name: str
    class_id: int
    line_name: str
    direction: str               # "positive" | "negative"
    lane_name: Optional[str]     # None if no lanes configured
    crossing_x: float
    crossing_y: float
    timestamp_ms: float
    frame_index: int

    def to_dict(self) -> dict:
        """Return a JSON-serialisable dict for FastAPI / WebSocket / DB storage."""
        return {
            "track_id": self.track_id,
            "class_name": self.class_name,
            "class_id": self.class_id,
            "line_name": self.line_name,
            "direction": self.direction,
            "lane_name": self.lane_name,
            "crossing_x": round(self.crossing_x, 1),
            "crossing_y": round(self.crossing_y, 1),
            "timestamp_ms": round(self.timestamp_ms, 2),
            "frame_index": self.frame_index,
        }

    def __repr__(self) -> str:
        tid = f"#{self.track_id}" if self.track_id is not None else "untracked"
        lane = f" [{self.lane_name}]" if self.lane_name else ""
        return (
            f"CrossingEvent({tid} {self.class_name} "
            f"→ {self.line_name}{lane} "
            f"dir={self.direction} "
            f"frame={self.frame_index})"
        )


# ──────────────────────────────────────────────────────────────────────────────
# Vehicle Counter
# ──────────────────────────────────────────────────────────────────────────────

class VehicleCounter:
    """
    Multi-line, multi-lane vehicle counter using cross-product sign-change detection.

    Cross-product algorithm:
    ─────────────────────────
    Given line P1→P2 and a vehicle center Q:
        z = (P2.x - P1.x)*(Q.y - P1.y) - (P2.y - P1.y)*(Q.x - P1.x)
        sign(z) > 0  →  Q is to the left  of the directed line P1→P2
        sign(z) < 0  →  Q is to the right of the directed line P1→P2
        sign(z) == 0 →  Q is exactly on the line

    A crossing is detected when sign(z_prev) ≠ sign(z_curr) AND
    sign(z_prev) ≠ 0 (vehicle was not on the line last frame).

    We also verify that the crossing midpoint lies within the line segment's
    bounding box (with tolerance) to reject false positives at line extensions.

    Why cross-product instead of bbox overlap?
    ───────────────────────────────────────────
    - BBox overlap fires when a vehicle is NEAR the line, not when it CROSSES it
    - Cross-product detects the exact frame of crossing regardless of vehicle size
    - Works correctly for diagonal lines (not just horizontal/vertical)
    - Directional information is free from the sign of the cross product

    Duplicate prevention:
    ──────────────────────
    Each (track_id, line_name) pair can only fire ONE event per passage.
    We record confirmed crossings in _crossed_pairs. When a vehicle reverses and
    crosses again, a new event fires. Reversals are detected by tracking
    the most recent direction for each (track_id, line_name) pair.
    """

    def __init__(
        self,
        lines: List[LineConfig],
        lanes: Optional[List[LaneConfig]] = None,
        frame_w: int = 1280,
        frame_h: int = 720,
        segment_tolerance: float = 0.05,
    ) -> None:
        """
        Args:
            lines              : List of LineConfig objects defining counting lines.
                                 Must have unique names.
            lanes              : Optional list of LaneConfig objects dividing the
                                 horizontal span into named segments.
                                 Applied to ALL counting lines equally.
                                 Pass None (default) to disable lane counting.
            frame_w            : Frame width in pixels (for coordinate conversion).
            frame_h            : Frame height in pixels.
            segment_tolerance  : Fraction of frame width added as tolerance when
                                 testing if a crossing midpoint lies within the
                                 line segment. Default 0.05 = 5% of frame width.
                                 Prevents false rejections near segment endpoints.
        """
        if not lines:
            raise ValueError("[Counter] At least one LineConfig must be provided.")

        # Check for duplicate line names
        names = [lc.name for lc in lines]
        if len(names) != len(set(names)):
            raise ValueError(
                f"[Counter] Duplicate line names detected: "
                f"{[n for n in names if names.count(n) > 1]}"
            )

        self.frame_w = frame_w
        self.frame_h = frame_h
        self.lanes: List[LaneConfig] = lanes or []
        self._tolerance_px = segment_tolerance * frame_w

        # Build internal _LineState objects from configs
        self._line_states: Dict[str, _LineState] = {}
        for lc in lines:
            state = _LineState(config=lc)
            # Convert relative coords → pixel coords
            state.px1 = (lc.p1[0] * frame_w, lc.p1[1] * frame_h)
            state.px2 = (lc.p2[0] * frame_w, lc.p2[1] * frame_h)
            # Initialise per-lane counters
            if self.lanes:
                state.lane_counts = {
                    lane.name: {name: 0 for name in CLASS_NAMES}
                    for lane in self.lanes
                }
            self._line_states[lc.name] = state

        # ── Per-track crossing state ────────────────────────────────────────
        # _prev_positions: last known center position for each track_id
        #   key: track_id (int) or a synthetic key for untracked detections
        #   value: (cx, cy)
        self._prev_positions: Dict[Union[int, str], Tuple[float, float]] = {}

        # _crossed_pairs: set of (track_key, line_name) pairs that have crossed.
        # When a vehicle crosses once, the key is added here. The next crossing
        # (in the same direction) is suppressed. A reversal (direction change)
        # clears the key, allowing a new event to fire.
        self._crossed_pairs: set = set()

        # _last_direction: last crossing direction per (track_key, line_name)
        # Used to detect reversals (vehicle crosses in opposite direction → new event)
        self._last_direction: Dict[Tuple, str] = {}

        # ── Event log ──────────────────────────────────────────────────────
        # All events ever fired in this session. Bounded by max_event_log.
        self._event_log: List[CrossingEvent] = []
        self._max_event_log: int = 10_000  # ~28 hours at 1 event/10s

        # Session start time for rate calculations
        self._session_start: float = time.monotonic()

        # Frame counter (set by update())
        self._last_frame_index: int = 0

        print(
            f"[Counter] Initialised\n"
            f"  Lines  : {[lc.name for lc in lines]}\n"
            f"  Lanes  : {[ln.name for ln in self.lanes] if self.lanes else 'None'}\n"
            f"  Frame  : {frame_w}×{frame_h}px"
        )

    # ── Cross-product geometry ─────────────────────────────────────────────────

    @staticmethod
    def _cross_z(
        p1: Tuple[float, float],
        p2: Tuple[float, float],
        q:  Tuple[float, float],
    ) -> float:
        """
        Compute the z-component of the cross product of (P2-P1) × (Q-P1).

        Returns:
            > 0  → Q is to the LEFT  of the directed line P1→P2
            < 0  → Q is to the RIGHT of the directed line P1→P2
            = 0  → Q lies exactly on the line through P1 and P2
        """
        return (p2[0] - p1[0]) * (q[1] - p1[1]) - (p2[1] - p1[1]) * (q[0] - p1[0])

    def _within_segment(
        self,
        p1: Tuple[float, float],
        p2: Tuple[float, float],
        midpoint: Tuple[float, float],
    ) -> bool:
        """
        Check if `midpoint` lies within the axis-aligned bounding box of
        segment P1→P2, expanded by `_tolerance_px` on all sides.

        Why this check?
        ────────────────
        The cross-product test detects crossings of the INFINITE LINE through
        P1 and P2. Without this check, a vehicle passing far to the left of P1
        (on the extended line) would incorrectly register as a crossing.
        The bounding-box check confines events to the actual segment region.
        """
        tol = self._tolerance_px
        x_min = min(p1[0], p2[0]) - tol
        x_max = max(p1[0], p2[0]) + tol
        y_min = min(p1[1], p2[1]) - tol
        y_max = max(p1[1], p2[1]) + tol
        return (x_min <= midpoint[0] <= x_max) and (y_min <= midpoint[1] <= y_max)

    def _assign_lane(self, cx_pixel: float) -> Optional[str]:
        """
        Determine which lane a vehicle belongs to based on its x center pixel.

        Why x-coordinate only?
        ───────────────────────
        Counting lines are typically horizontal (parallel to the road).
        Lanes are vertical strips — the x position at the crossing point
        determines which lane the vehicle was in. Y position is irrelevant.

        Returns:
            Lane name string, or None if no lanes are configured or the
            x coordinate falls outside all defined lane boundaries.
        """
        if not self.lanes:
            return None
        for lane in self.lanes:
            lane_x_start_px = lane.x_start * self.frame_w
            lane_x_end_px   = lane.x_end   * self.frame_w
            if lane_x_start_px <= cx_pixel < lane_x_end_px:
                return lane.name
        return None   # outside all lanes (edge case: x beyond last lane boundary)

    # ── Core update ───────────────────────────────────────────────────────────

    def update(
        self,
        detections: List[Detection],
        frame_index: int = 0,
        timestamp_ms: Optional[float] = None,
    ) -> List[CrossingEvent]:
        """
        Process one frame's detections and return any new crossing events.

        Called once per frame, passing the detection list from either:
          - track.py  → TrackedFrame.detections   (track_id populated)
          - detect.py → FrameResult.detections    (track_id may be None)

        When track_id is None (untracked detections), a synthetic key based on
        bbox position is used. This prevents double-counting within a frame
        but cannot suppress duplicates across frames for the same vehicle.
        For production use, always feed tracked detections from track.py.

        Args:
            detections  : List of Detection objects for the current frame.
            frame_index : Current frame number (for event logging).
            timestamp_ms: Current stream timestamp. Defaults to wall-clock time.

        Returns:
            List of CrossingEvent objects — one per confirmed crossing.
            Empty list if no crossings occurred this frame.
        """
        if timestamp_ms is None:
            timestamp_ms = time.monotonic() * 1000.0

        self._last_frame_index = frame_index
        new_events: List[CrossingEvent] = []
        current_track_keys: set = set()

        for det in detections:
            # ── Build a stable key for this detection ─────────────────────────
            # track_id from ByteTrack is the ideal key — permanent and unique.
            # For untracked detections, we use the rounded center position as
            # a per-frame proxy (good enough to avoid double-counting same frame).
            if det.track_id is not None:
                track_key: Union[int, str] = det.track_id
            else:
                cx_r, cy_r = det.center
                track_key = f"u_{round(cx_r)}_{round(cy_r)}"

            current_track_keys.add(track_key)
            curr_pos = det.center   # (cx, cy) from detect.py Detection.center

            # ── Check against every counting line ─────────────────────────────
            if track_key in self._prev_positions:
                prev_pos = self._prev_positions[track_key]

                for line_name, ls in self._line_states.items():
                    event = self._check_crossing(
                        track_key=track_key,
                        detection=det,
                        prev_pos=prev_pos,
                        curr_pos=curr_pos,
                        line_state=ls,
                        frame_index=frame_index,
                        timestamp_ms=timestamp_ms,
                    )
                    if event is not None:
                        new_events.append(event)

            # ── Store current position for next frame ─────────────────────────
            self._prev_positions[track_key] = curr_pos

        # ── Clean up stale position records ───────────────────────────────────
        # Why clean up?
        # If a vehicle leaves the frame, its track_id will never appear again.
        # Keeping stale positions grows memory indefinitely in long sessions.
        # We remove any track_key not seen in the current frame.
        #
        # IMPORTANT: Only clean untracked (string) keys — ByteTrack integer keys
        # should stay because a vehicle may reappear after brief occlusion.
        # We keep integer keys that were active in the last 150 frames (~5s).
        stale_untracked = {
            k for k in self._prev_positions
            if isinstance(k, str) and k not in current_track_keys
        }
        for k in stale_untracked:
            del self._prev_positions[k]

        # ── Append events to session log ──────────────────────────────────────
        if new_events:
            self._event_log.extend(new_events)
            if len(self._event_log) > self._max_event_log:
                # Drop oldest events when log is full
                self._event_log = self._event_log[-self._max_event_log:]

        return new_events

    def _check_crossing(
        self,
        track_key: Union[int, str],
        detection: Detection,
        prev_pos: Tuple[float, float],
        curr_pos: Tuple[float, float],
        line_state: _LineState,
        frame_index: int,
        timestamp_ms: float,
    ) -> Optional[CrossingEvent]:
        """
        Test whether a single vehicle crossed a single line between two frames.

        Algorithm steps:
        1. Compute cross-product z for both prev and curr positions
        2. Check sign change (crossing condition)
        3. Guard: prev must not be zero (vehicle was already on the line)
        4. Guard: crossing midpoint must be within the line segment bounds
        5. Guard: direction filter (if line is directional)
        6. Guard: not already recorded for this (track, line) pair in same direction
        7. Update counts, create and return CrossingEvent

        Returns:
            CrossingEvent if a valid crossing is confirmed, else None.
        """
        p1 = line_state.px1
        p2 = line_state.px2
        cfg = line_state.config

        z_prev = self._cross_z(p1, p2, prev_pos)
        z_curr = self._cross_z(p1, p2, curr_pos)

        # ── Step 1: Sign change check ─────────────────────────────────────────
        sign_prev = 1 if z_prev > 0 else (-1 if z_prev < 0 else 0)
        sign_curr = 1 if z_curr > 0 else (-1 if z_curr < 0 else 0)

        if sign_prev == sign_curr or sign_prev == 0:
            # No crossing: same side both frames, or vehicle was exactly on line
            return None

        # ── Step 2: Direction of crossing ────────────────────────────────────
        # "positive" direction: vehicle moved from left-of-line to right-of-line
        #   → z_prev was positive (left), z_curr is negative (right)
        direction = "positive" if sign_prev > 0 else "negative"

        # ── Step 3: Line direction filter ────────────────────────────────────
        if cfg.direction != "both" and cfg.direction != direction:
            return None   # Line configured to only count one direction

        # ── Step 4: Segment boundary check ───────────────────────────────────
        # Midpoint between prev and curr is the estimated crossing location
        mid_x = (prev_pos[0] + curr_pos[0]) / 2.0
        mid_y = (prev_pos[1] + curr_pos[1]) / 2.0
        if not self._within_segment(p1, p2, (mid_x, mid_y)):
            return None   # Crossing is on the extended line, outside the segment

        # ── Step 5: Duplicate suppression ────────────────────────────────────
        # (track_key, line_name) pair key for direction-aware deduplication
        pair_key = (track_key, cfg.name)
        prev_direction = self._last_direction.get(pair_key)

        if pair_key in self._crossed_pairs:
            if direction == prev_direction:
                # Same direction as last crossing — suppress duplicate
                return None
            else:
                # Direction reversed — vehicle crossed back. Allow new event.
                self._crossed_pairs.discard(pair_key)

        # ── Step 6: Record this crossing ─────────────────────────────────────
        self._crossed_pairs.add(pair_key)
        self._last_direction[pair_key] = direction

        # ── Step 7: Update counts ─────────────────────────────────────────────
        if direction == "positive":
            line_state.count_positive += 1
        else:
            line_state.count_negative += 1

        cls_name = detection.class_name
        line_state.class_counts[cls_name] = line_state.class_counts.get(cls_name, 0) + 1

        # ── Step 8: Lane assignment ───────────────────────────────────────────
        # Use the crossing midpoint x-coordinate for lane assignment
        lane_name = self._assign_lane(mid_x)
        if lane_name and lane_name in line_state.lane_counts:
            line_state.lane_counts[lane_name][cls_name] = (
                line_state.lane_counts[lane_name].get(cls_name, 0) + 1
            )

        # ── Step 9: Build and return the CrossingEvent ────────────────────────
        return CrossingEvent(
            track_id=detection.track_id,
            class_name=cls_name,
            class_id=detection.class_id,
            line_name=cfg.name,
            direction=direction,
            lane_name=lane_name,
            crossing_x=mid_x,
            crossing_y=mid_y,
            timestamp_ms=timestamp_ms,
            frame_index=frame_index,
        )

    # ── Statistics API ────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        """
        Return complete JSON-serialisable statistics for all lines and lanes.

        Output structure:
        {
          "session_duration_s": 42.1,
          "total_events": 87,
          "last_frame": 1260,
          "lines": {
            "Entry": {
              "total": 52,
              "inbound": 35,        ← positive direction crossings
              "outbound": 17,       ← negative direction crossings
              "by_class": {"car": 38, "truck": 8, ...},
              "by_lane": {
                "Lane 1": {"car": 12, "truck": 3, ...},
                "Lane 2": {...},
              }
            },
            "Exit": { ... }
          },
          "totals": {
            "all_lines": {"car": 65, "truck": 12, ...},
            "inbound":   55,
            "outbound":  32
          },
          "recent_events": [ ... ]   ← last 20 events as dicts
        }

        This dict is returned directly by the FastAPI /api/counter/stats endpoint.
        """
        elapsed = time.monotonic() - self._session_start

        lines_stats: Dict[str, dict] = {}
        grand_totals: Dict[str, int] = {name: 0 for name in CLASS_NAMES}
        grand_inbound = 0
        grand_outbound = 0

        for line_name, ls in self._line_states.items():
            line_stats: dict = {
                "total": ls.total,
                "inbound": ls.count_positive,
                "outbound": ls.count_negative,
                "by_class": dict(ls.class_counts),
            }

            if ls.lane_counts:
                line_stats["by_lane"] = {
                    lane_name: dict(counts)
                    for lane_name, counts in ls.lane_counts.items()
                }

            lines_stats[line_name] = line_stats

            # Accumulate grand totals
            grand_inbound  += ls.count_positive
            grand_outbound += ls.count_negative
            for cls, cnt in ls.class_counts.items():
                grand_totals[cls] = grand_totals.get(cls, 0) + cnt

        return {
            "session_duration_s": round(elapsed, 2),
            "total_events": len(self._event_log),
            "last_frame": self._last_frame_index,
            "lines": lines_stats,
            "totals": {
                "all_lines": grand_totals,
                "inbound":   grand_inbound,
                "outbound":  grand_outbound,
                "combined":  grand_inbound + grand_outbound,
            },
            "recent_events": [
                e.to_dict() for e in self._event_log[-20:]
            ],
        }

    def get_line_stats(self, line_name: str) -> Optional[dict]:
        """
        Return statistics for a single counting line.

        Args:
            line_name: The name of the line as given in LineConfig.

        Returns:
            Stats dict for the line, or None if line_name not found.
        """
        ls = self._line_states.get(line_name)
        if ls is None:
            return None
        stats = {
            "total": ls.total,
            "inbound": ls.count_positive,
            "outbound": ls.count_negative,
            "by_class": dict(ls.class_counts),
        }
        if ls.lane_counts:
            stats["by_lane"] = {
                lane_name: dict(counts)
                for lane_name, counts in ls.lane_counts.items()
            }
        return stats

    def get_summary(self) -> str:
        """
        Return a compact human-readable summary string.

        Useful for terminal logging. Not for production API responses.

        Example:
            [Counter] Frame 1260 | Entry: 52 (in=35 out=17) | Exit: 30 (in=20 out=10)
        """
        parts = [f"[Counter] Frame {self._last_frame_index}"]
        for name, ls in self._line_states.items():
            parts.append(
                f"| {name}: {ls.total} (in={ls.count_positive} out={ls.count_negative})"
            )
        return " ".join(parts)

    def get_recent_events(self, n: int = 50) -> List[dict]:
        """
        Return the last `n` crossing events as a list of dicts.

        Args:
            n: Number of events to return (most recent first). Default 50.

        Returns:
            List of event dicts, newest first.
        """
        return [e.to_dict() for e in reversed(self._event_log[-n:])]

    def get_class_totals(self) -> Dict[str, int]:
        """
        Return total crossings per vehicle class across ALL lines.

        Returns:
            {'car': 120, 'truck': 34, 'bus': 8, 'motorcycle': 22}
        """
        totals: Dict[str, int] = {name: 0 for name in CLASS_NAMES}
        for ls in self._line_states.values():
            for cls, cnt in ls.class_counts.items():
                totals[cls] = totals.get(cls, 0) + cnt
        return totals

    def get_lane_totals(self, line_name: Optional[str] = None) -> Dict[str, Dict[str, int]]:
        """
        Return per-lane vehicle class totals.

        Args:
            line_name: If given, return lane totals for that line only.
                       If None, return aggregated lane totals across all lines.

        Returns:
            {lane_name: {class_name: count, ...}, ...}
        """
        if line_name is not None:
            ls = self._line_states.get(line_name)
            return {lane: dict(counts) for lane, counts in ls.lane_counts.items()} if ls else {}

        # Aggregate across all lines
        aggregated: Dict[str, Dict[str, int]] = defaultdict(
            lambda: {name: 0 for name in CLASS_NAMES}
        )
        for ls in self._line_states.values():
            for lane_name, counts in ls.lane_counts.items():
                for cls, cnt in counts.items():
                    aggregated[lane_name][cls] += cnt
        return dict(aggregated)

    # ── Session management ────────────────────────────────────────────────────

    def reset_counts(self) -> None:
        """
        Reset all crossing counts and event log.

        Use this for time-windowed counting (e.g., count per 5-minute window).
        Line definitions and lane definitions are preserved.
        Previous-position memory is also cleared so no stale crossings fire.

        Does NOT reset _crossed_pairs — this prevents duplicate events from
        vehicles that were mid-line at the moment of reset.
        """
        for ls in self._line_states.values():
            ls.reset_counts()
        self._event_log.clear()
        self._prev_positions.clear()
        self._session_start = time.monotonic()
        self._last_frame_index = 0
        print("[Counter] Counts reset — line and lane definitions preserved.")

    def reset_all(self) -> None:
        """
        Full reset: clear counts, event log, position memory, AND crossing records.

        Use when changing the video source or restarting the pipeline.
        """
        self.reset_counts()
        self._crossed_pairs.clear()
        self._last_direction.clear()
        print("[Counter] Full reset — all state cleared.")

    # ── Factory constructors ──────────────────────────────────────────────────

    @classmethod
    def from_dict(
        cls,
        config: dict,
        frame_w: int = 1280,
        frame_h: int = 720,
    ) -> "VehicleCounter":
        """
        Construct a VehicleCounter from a plain Python dict (e.g., loaded from YAML).

        Dict format:
        {
          "lines": [
            {
              "name": "Entry",
              "p1": [0.05, 0.5],
              "p2": [0.95, 0.5],
              "direction": "both",
              "color": [0, 255, 0]
            }
          ],
          "lanes": [                       ← optional
            {"name": "Lane 1", "x_start": 0.0,  "x_end": 0.33},
            {"name": "Lane 2", "x_start": 0.33, "x_end": 0.66},
            {"name": "Lane 3", "x_start": 0.66, "x_end": 1.0}
          ]
        }

        This is the format used in config.yaml and by the FastAPI setup endpoint.

        Args:
            config : Dict matching the format above.
            frame_w: Frame width in pixels.
            frame_h: Frame height in pixels.

        Returns:
            A configured VehicleCounter instance.
        """
        line_configs = [
            LineConfig(
                name=lc["name"],
                p1=tuple(lc["p1"]),
                p2=tuple(lc["p2"]),
                direction=lc.get("direction", "both"),
                color=tuple(lc.get("color", [0, 255, 0])),
            )
            for lc in config.get("lines", [])
        ]

        lane_configs = [
            LaneConfig(
                name=ln["name"],
                x_start=ln["x_start"],
                x_end=ln["x_end"],
            )
            for ln in config.get("lanes", [])
        ] or None

        return cls(lines=line_configs, lanes=lane_configs, frame_w=frame_w, frame_h=frame_h)

    @classmethod
    def default(cls, frame_w: int = 1280, frame_h: int = 720) -> "VehicleCounter":
        """
        Create a counter with two default horizontal counting lines and three lanes.

        Entry line at 50% height, Exit line at 75% height.
        Lane 1 (left third), Lane 2 (centre), Lane 3 (right third).

        Use this for quick testing or when no specific road layout is known.

        Args:
            frame_w: Frame width in pixels.
            frame_h: Frame height in pixels.

        Returns:
            A VehicleCounter ready to use without any configuration.
        """
        lines = [
            LineConfig(
                name="Entry",
                p1=(0.05, 0.50),
                p2=(0.95, 0.50),
                direction="both",
                color=(0, 255, 0),
            ),
            LineConfig(
                name="Exit",
                p1=(0.05, 0.75),
                p2=(0.95, 0.75),
                direction="both",
                color=(0, 100, 255),
            ),
        ]
        lanes = [
            LaneConfig("Lane 1", 0.0,  0.333),
            LaneConfig("Lane 2", 0.333, 0.666),
            LaneConfig("Lane 3", 0.666, 1.0),
        ]
        return cls(lines=lines, lanes=lanes, frame_w=frame_w, frame_h=frame_h)

    # ── Introspection ─────────────────────────────────────────────────────────

    def __repr__(self) -> str:
        line_names = list(self._line_states.keys())
        lane_names = [ln.name for ln in self.lanes]
        return (
            f"VehicleCounter("
            f"lines={line_names}, "
            f"lanes={lane_names if lane_names else 'None'}, "
            f"frame={self.frame_w}×{self.frame_h}, "
            f"events={len(self._event_log)})"
        )
