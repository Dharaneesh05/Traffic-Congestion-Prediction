"""
track.py — YOLO11 + Ultralytics ByteTrack Vehicle Tracking Module
==================================================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Provides the `Tracker` class for running detection AND tracking together
using YOLO11's built-in Ultralytics ByteTrack integration.

Architecture decision — why Tracker owns detection:
────────────────────────────────────────────────────
Running model.track(frame, persist=True) performs both detection and tracking
in a single GPU pass, which is faster and more accurate than running them
separately. ByteTrack needs raw confidence scores from the detector to perform
its two-stage matching. Splitting detect → track would require passing those
internal scores across the module boundary.

detect.py is used for:  images, folders, evaluation (no tracking needed)
track.py is used for:   video streams, webcam (persistent IDs needed)

Both modules return `Detection` objects from detect.py, ensuring
full compatibility with counter.py, traffic_analysis.py, and the FastAPI layer.

Supported sources:
    - Video file      (.mp4, .avi, .mov, etc.)
    - Webcam stream   (integer index, e.g. 0)

Usage:
    from track import Tracker

    tracker = Tracker(weights=\"yolo11n.pt\", conf=0.40)
    tracker.load()

    # ── Video stream ────────────────────────────────────────────────────────
    for tracked_frame in tracker.track_video(\"datasets/videos/Traffic.mp4\"):
        print(tracked_frame.frame_index, tracked_frame.vehicle_count)
        for det in tracked_frame.detections:
            print(det.track_id, det.class_name, det.bbox)

    # ── Webcam stream ───────────────────────────────────────────────────────
    for tracked_frame in tracker.track_video(source=0, max_frames=300):
        traj = tracker.get_trajectory(track_id=5)  # list of (cx, cy) points
        all_traj = tracker.get_all_trajectories()   # {id: [(cx,cy),...]}

    # ── Query trajectories at any time ──────────────────────────────────────
    summary = tracker.get_track_summary(track_id=5)
    stats   = tracker.get_stats()
    tracker.reset()  # clear all track history
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Generator, List, Optional, Tuple, Union

import cv2
import numpy as np

# ── Import shared types from detect.py ────────────────────────────────────────
# We import Detection and CLASS_NAMES so track.py output is directly compatible
# with counter.py, traffic_analysis.py, and every downstream consumer.
# detect.py is NOT modified — only its public API is consumed here.
from detect import CLASS_NAMES, CLASS_COLORS, Detection, _COCO_TO_PROJECT


# ──────────────────────────────────────────────────────────────────────────────
# Data Structures
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class TrackState:
    """
    Persistent metadata for one tracked vehicle across its entire lifetime.

    This lives in Tracker._track_states and is NEVER deleted, even after a
    track is lost. This allows downstream modules (AnalyticsStore, RouteAgent)
    to query the full trajectory of any vehicle that ever appeared.

    Attributes:
        track_id        : Permanent ByteTrack integer ID. Never reused.
        class_id        : Project class index (0=car, 1=truck, 2=bus, 3=motorcycle).
        class_name      : Human-readable class label.
        trajectory      : Bounded deque of (cx, cy) center-point history.
                          maxlen controls memory usage per track.
        first_seen      : Frame index when this track was first confirmed.
        last_seen       : Frame index of the most recent successful match.
        total_hits      : Total number of frames where this ID was matched.
        is_active       : True if this track was seen in the most recent frame.
    """
    track_id: int
    class_id: int
    class_name: str
    trajectory: deque = field(repr=False)      # deque[(cx, cy)]
    first_seen: int = 0
    last_seen: int = 0
    total_hits: int = 0
    is_active: bool = True

    def update(self, cx: float, cy: float, frame_index: int) -> None:
        """Record a new matched position for this frame."""
        self.trajectory.append((cx, cy))
        self.last_seen = frame_index
        self.total_hits += 1
        self.is_active = True

    @property
    def trajectory_list(self) -> List[Tuple[float, float]]:
        """Return trajectory as a plain list (JSON-serialisable)."""
        return list(self.trajectory)

    @property
    def displacement(self) -> float:
        """
        Straight-line distance (pixels) from first to last trajectory point.
        Zero if only one point recorded.
        """
        pts = self.trajectory_list
        if len(pts) < 2:
            return 0.0
        dx = pts[-1][0] - pts[0][0]
        dy = pts[-1][1] - pts[0][1]
        return (dx ** 2 + dy ** 2) ** 0.5

    def to_dict(self) -> dict:
        """Return a JSON-serialisable summary of this track."""
        return {
            "track_id": self.track_id,
            "class_name": self.class_name,
            "class_id": self.class_id,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
            "total_hits": self.total_hits,
            "is_active": self.is_active,
            "trajectory_length": len(self.trajectory),
            "displacement_px": round(self.displacement, 2),
        }


@dataclass
class TrackedFrame:
    """
    Tracking results for a single frame.

    Structurally mirrors detect.py's FrameResult so the two are
    interchangeable downstream (counter.py, traffic_analysis.py).

    Extra fields vs FrameResult:
        active_track_ids : IDs visible in this frame (subset of all seen IDs).
        trajectories     : Snapshot of trajectories for ACTIVE tracks only.
                           Use Tracker.get_all_trajectories() for full history.

    Note: `detections` are `Detection` objects from detect.py with track_id
    populated — exactly the same type that Detector returns, just with IDs set.
    """
    frame_index: int
    timestamp_ms: float
    detections: List[Detection]           # track_id is always populated
    inference_time_ms: float
    active_track_ids: List[int]           # IDs confirmed active this frame
    trajectories: Dict[int, List[Tuple[float, float]]]  # {id: [(cx,cy),...]}
    camera_id: Optional[str] = None
    frame: Optional[np.ndarray] = field(default=None, repr=False)

    # ── Convenience properties (mirrors detect.py FrameResult) ───────────────

    @property
    def vehicle_count(self) -> int:
        """Total tracked vehicles visible in this frame."""
        return len(self.detections)

    @property
    def class_counts(self) -> Dict[str, int]:
        """Per-class vehicle count. {'car': 3, 'truck': 1, 'bus': 0, 'motorcycle': 2}"""
        counts: Dict[str, int] = {name: 0 for name in CLASS_NAMES}
        for det in self.detections:
            counts[det.class_name] = counts.get(det.class_name, 0) + 1
        return counts

    def to_dict(self) -> dict:
        """Return a JSON-serialisable dict for FastAPI / WebSocket push."""
        return {
            "frame_index": self.frame_index,
            "timestamp_ms": round(self.timestamp_ms, 2),
            "camera_id": self.camera_id,
            "vehicle_count": self.vehicle_count,
            "class_counts": self.class_counts,
            "inference_time_ms": round(self.inference_time_ms, 2),
            "active_track_ids": self.active_track_ids,
            "detections": [d.to_dict() for d in self.detections],
            "trajectories": {
                str(tid): [(round(x, 1), round(y, 1)) for x, y in pts]
                for tid, pts in self.trajectories.items()
            },
        }


# ──────────────────────────────────────────────────────────────────────────────
# Tracker Class
# ──────────────────────────────────────────────────────────────────────────────

class Tracker:
    """
    Production YOLO11 + Ultralytics ByteTrack vehicle tracker.

    Design decisions vs. original track.py:
    ─────────────────────────────────────────
    1. CLASS WRAPPER — old code was a flat 10-line script. A class loads the
       model once and maintains track state across ALL frames of a video session.
       ByteTrack track states would be lost if re-initialised per frame.

    2. ULTRALYTICS BYTETRACK — old code called model.track(...) correctly but:
       a) Used \"../yolo11n.pt\" (path breaks from project root)
       b) Used show=True (blocks in headless server environments)
       c) Processed a static image folder, not a live video stream
       d) Returned raw Ultralytics result objects (incompatible with pipeline)
       The new code fixes all four issues.

    3. PERSIST=TRUE — the critical Ultralytics flag that makes ByteTrack
       maintain track state between calls. Without it, every frame starts fresh
       with new IDs, which breaks vehicle counting and trajectory building.

    4. PERMANENT IDs — ByteTrack assigns monotonically increasing integers.
       IDs are never reused within a session. A vehicle that leaves and returns
       (within track_buffer frames) keeps its original ID.

    5. TRAJECTORY HISTORY — every confirmed track's center-point history is
       recorded in a deque bounded by `max_trajectory_len`. Even after a track
       is lost, its history is preserved in `_track_states` for the session.

    6. DETECTION COMPATIBILITY — output `Detection` objects come directly from
       detect.py. track_id is populated so counter.py, traffic_analysis.py,
       and the FastAPI layer all work without changes.

    7. COCO FILTER — same as detect.py: only car/truck/bus/motorcycle pass
       through. People, traffic lights, etc. are filtered out.
    """

    # ── Construction ──────────────────────────────────────────────────────────

    def __init__(
        self,
        weights: Union[str, Path, None] = None,
        conf: float = 0.40,
        iou: float = 0.45,
        device: Optional[str] = None,
        custom_trained: bool = False,
        img_size: int = 640,
        max_det: int = 300,
        tracker_config: str = "bytetrack.yaml",
        max_trajectory_len: int = 120,
    ) -> None:
        """
        Args:
            weights           : Path to YOLO11 .pt file.
                                Defaults to <project_root>/yolo11n.pt.
            conf              : Minimum detection confidence for ByteTrack's
                                HIGH threshold (0.0–1.0). Detections above this
                                are matched first. Those below (but above ~0.1)
                                are used in the second-pass low-conf matching.
            iou               : IoU threshold for Non-Maximum Suppression.
            device            : \"cpu\", \"cuda\", \"cuda:0\", \"mps\", or None (auto).
            custom_trained    : True if model was fine-tuned on our dataset
                                (class IDs map directly to CLASS_NAMES).
                                False (default) for pretrained COCO weights.
            img_size          : Input image size (must match training size).
            max_det           : Max detections per frame passed to ByteTrack.
            tracker_config    : ByteTrack YAML config name.
                                \"bytetrack.yaml\" → Ultralytics built-in config.
                                You can also pass an absolute path to a custom
                                YAML for fine-tuned tracking parameters.
            max_trajectory_len: Maximum number of center points stored per
                                track. Older points are automatically dropped.
                                120 frames ≈ 4 seconds at 30 FPS.
        """
        # Path resolution — same logic as detect.py
        if weights is None:
            self.weights = Path(__file__).resolve().parent.parent / "yolo11n.pt"
        else:
            self.weights = Path(weights).resolve()

        self.conf = conf
        self.iou_threshold = iou
        self.img_size = img_size
        self.max_det = max_det
        self.tracker_config = tracker_config
        self.custom_trained = custom_trained
        self.max_trajectory_len = max_trajectory_len

        self.device: str = device if device is not None else self._resolve_device()

        self._model = None             # Loaded by .load()
        self._inference_times: List[float] = []

        # ── Track state storage ───────────────────────────────────────────
        # _track_states holds ALL tracks ever seen (active + lost + removed).
        # Key: track_id (permanent ByteTrack integer)
        # Value: TrackState with full trajectory and metadata.
        #
        # Why keep lost tracks?
        # → Trajectory queries from the route agent or analytics store should
        #   work for any vehicle that ever appeared, not just currently visible ones.
        self._track_states: Dict[int, TrackState] = {}

        # IDs that were active in the LAST processed frame
        self._prev_active_ids: set = set()

        # Monotonically increasing frame counter for this tracker session
        self._frame_count: int = 0

    # ── Device selection ──────────────────────────────────────────────────────

    @staticmethod
    def _resolve_device() -> str:
        """Auto-select CUDA → MPS → CPU. Same logic as detect.py Detector."""
        try:
            import torch
            if torch.cuda.is_available():
                return "cuda"
            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                return "mps"
        except ImportError:
            pass
        return "cpu"

    # ── Model loading ──────────────────────────────────────────────────────────

    def load(self) -> "Tracker":
        """
        Load YOLO11 weights and run warmup tracking passes.

        Why warmup for tracking?
        ─────────────────────────
        The first model.track() call compiles ByteTrack internals alongside
        the CUDA detection kernels. Warmup eliminates this latency from the
        first real frame. We run 3 passes so the Kalman filter matrices and
        the Hungarian matching buffers are also initialised.

        Returns self so you can chain: tracker = Tracker().load()
        """
        if not self.weights.exists():
            raise FileNotFoundError(
                f"[Tracker] Model weights not found: {self.weights}\n"
                f"  Expected location: {self.weights.resolve()}\n"
                f"  Make sure yolo11n.pt is in the project root."
            )

        from ultralytics import YOLO
        self._model = YOLO(str(self.weights))
        self._model.to(self.device)

        # Warmup: 3 silent tracking passes with a blank frame.
        dummy = np.zeros((self.img_size, self.img_size, 3), dtype=np.uint8)
        for _ in range(3):
            self._model.track(
                dummy,
                tracker=self.tracker_config,
                persist=False,
                verbose=False,
            )

        self._inference_times.clear()
        self._track_states.clear()
        self._frame_count = 0

        print(
            f"[Tracker] YOLO11 + ByteTrack loaded\n"
            f"  Weights : {self.weights.name}\n"
            f"  Device  : {self.device}\n"
            f"  Conf    : {self.conf}  |  IoU: {self.iou_threshold}\n"
            f"  Config  : {self.tracker_config}\n"
            f"  MaxTraj : {self.max_trajectory_len} frames"
        )
        return self

    def _require_loaded(self) -> None:
        """Raise a clear error if the model was not loaded before tracking."""
        if self._model is None:
            raise RuntimeError(
                "[Tracker] Model not loaded. Call tracker.load() before tracking."
            )

    # ── Core tracking ──────────────────────────────────────────────────────────

    def _track_frame_internal(
        self,
        frame: np.ndarray,
        frame_index: int,
        timestamp_ms: float,
        camera_id: Optional[str],
        return_frame: bool,
    ) -> TrackedFrame:
        """
        Run YOLO11 + ByteTrack on a single BGR frame.

        Why model.track() instead of model.predict() + separate tracker?
        ─────────────────────────────────────────────────────────────────
        model.track(persist=True) is the Ultralytics-recommended way to run
        ByteTrack. Internally:
          1. YOLO detection runs on the GPU
          2. Raw detections (with confidence scores) are handed directly to
             the ByteTrack C++ engine in the same process
          3. ByteTrack performs two-pass Hungarian matching:
             Pass 1: high-conf detections ↔ confirmed tracks (IoU cost)
             Pass 2: remaining tracks ↔ low-conf detections (to recover lost)
          4. Unmatched high-conf detections → new tentative tracks
          5. Tracks unseen for > track_buffer frames → permanently removed

        Splitting this into detect.py → track.py would require serialising the
        raw confidence scores between modules, losing ByteTrack's ability to
        use them in the second-pass low-conf matching.

        persist=True:
          This is the KEY argument. It tells Ultralytics to keep the ByteTrack
          state between calls. Without it, every call creates a fresh tracker
          with new IDs — trajectories break and counting is impossible.

        Args:
            frame       : BGR numpy array from cv2.VideoCapture.
            frame_index : Sequential frame number (for TrackState.first_seen).
            timestamp_ms: Stream position from CAP_PROP_POS_MSEC.
            return_frame: Whether to attach the BGR frame to the result.

        Returns:
            TrackedFrame with Detection objects (track_id populated),
            active track IDs, and a trajectory snapshot.
        """
        t0 = time.perf_counter()

        # ── Run YOLO11 detection + ByteTrack in one GPU call ─────────────────
        results = self._model.track(
            frame,
            conf=self.conf,
            iou=self.iou_threshold,
            imgsz=self.img_size,
            max_det=self.max_det,
            tracker=self.tracker_config,
            persist=True,    # ← CRITICAL: maintains ByteTrack state between frames
            verbose=False,   # ← suppress per-frame YOLO console output
        )

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        self._inference_times.append(elapsed_ms)

        # ── Parse Ultralytics results → Detection objects ─────────────────────
        detections: List[Detection] = []
        active_ids: List[int] = []

        result = results[0] if results else None

        if result is not None and result.boxes is not None:
            boxes = result.boxes

            # Why check boxes.id separately?
            # On the very first frame, ByteTrack has not yet confirmed any
            # tracks (they start in "tentative" state). boxes.id will be None
            # until at least one track is confirmed (typically after 3 hits).
            # We must guard against this to avoid AttributeError.
            if boxes.id is not None:
                track_ids_raw  = boxes.id.cpu().numpy().astype(int)
                bboxes_raw     = boxes.xyxy.cpu().numpy()        # (N, 4)
                confs_raw      = boxes.conf.cpu().numpy()        # (N,)
                classes_raw    = boxes.cls.cpu().numpy().astype(int)  # (N,)

                for track_id, bbox, conf_val, coco_cls in zip(
                    track_ids_raw, bboxes_raw, confs_raw, classes_raw
                ):
                    track_id = int(track_id)

                    # ── COCO class filtering ──────────────────────────────────
                    # Same logic as detect.py _infer():
                    #   custom_trained → class IDs are already 0–5 for our set
                    #   pretrained     → COCO IDs must be mapped to project IDs
                    if self.custom_trained:
                        if coco_cls >= len(CLASS_NAMES):
                            continue  # ignore unsupported classes
                        class_id = coco_cls
                    else:
                        if coco_cls not in _COCO_TO_PROJECT:
                            continue  # not a vehicle class (e.g., person, sign)
                        class_id = _COCO_TO_PROJECT[coco_cls]

                    x1, y1, x2, y2 = bbox.tolist()
                    cx = (x1 + x2) / 2.0
                    cy = (y1 + y2) / 2.0

                    # ── Update or create TrackState ───────────────────────────
                    # Why maintain TrackState separately from Detection?
                    # Detection is stateless (one frame snapshot). TrackState
                    # is the persistent record that accumulates trajectory history
                    # and metadata across the entire session.
                    if track_id not in self._track_states:
                        # New track confirmed by ByteTrack
                        self._track_states[track_id] = TrackState(
                            track_id=track_id,
                            class_id=class_id,
                            class_name=CLASS_NAMES[class_id],
                            trajectory=deque(maxlen=self.max_trajectory_len),
                            first_seen=frame_index,
                            last_seen=frame_index,
                            total_hits=0,
                            is_active=True,
                        )

                    self._track_states[track_id].update(cx, cy, frame_index)

                    # Build the Detection object that the pipeline expects
                    detections.append(Detection(
                        bbox=(x1, y1, x2, y2),
                        confidence=float(conf_val),
                        class_id=class_id,
                        class_name=CLASS_NAMES[class_id],
                        track_id=track_id,   # ← ByteTrack permanent ID
                    ))
                    active_ids.append(track_id)

        # ── Mark previously-active tracks that disappeared as inactive ────────
        # Why do this explicitly?
        # ByteTrack removes tracks after track_buffer frames (typically 30).
        # Between disappearance and removal, a track is "lost" but still in
        # ByteTrack's internal state. We mark is_active=False immediately when
        # a track is no longer returned, so queries to _track_states are accurate.
        current_active_set = set(active_ids)
        for tid in self._prev_active_ids - current_active_set:
            if tid in self._track_states:
                self._track_states[tid].is_active = False
        self._prev_active_ids = current_active_set

        # ── Build trajectory snapshot for this frame ──────────────────────────
        # Why only active tracks?
        # Sending all trajectories (including lost ones) per frame would be
        # wasteful for WebSocket streaming. The full history is always available
        # via get_trajectory() / get_all_trajectories() on demand.
        trajectories: Dict[int, List[Tuple[float, float]]] = {
            tid: self._track_states[tid].trajectory_list
            for tid in active_ids
            if tid in self._track_states
        }

        return TrackedFrame(
            frame_index=frame_index,
            timestamp_ms=timestamp_ms,
            detections=detections,
            inference_time_ms=elapsed_ms,
            active_track_ids=active_ids,
            trajectories=trajectories,
            camera_id=camera_id,
            frame=frame if return_frame else None,
        )

    # ── Public API ────────────────────────────────────────────────────────────

    def track_frame(
        self,
        frame: np.ndarray,
        camera_id: Optional[str] = None,
        timestamp_ms: float = 0.0,
        return_frame: bool = False,
    ) -> TrackedFrame:
        """
        Run tracking on a single BGR frame.

        Use this when you are managing the video capture loop yourself
        (e.g., inside a FastAPI WebSocket handler reading from cv2.VideoCapture).

        Args:
            frame       : BGR numpy array (H, W, 3) from cv2.VideoCapture.
            return_frame: If True, attach the raw frame to the result.
                          Keep False in the server to reduce memory per frame.

        Returns:
            TrackedFrame with tracked detections and trajectory snapshot.

        Raises:
            RuntimeError: If the model has not been loaded via .load().
        """
        self._require_loaded()
        self._frame_count += 1
        return self._track_frame_internal(
            frame=frame,
            frame_index=self._frame_count,
            timestamp_ms=timestamp_ms,
            camera_id=camera_id,
            return_frame=return_frame,
        )

    def track_video(
        self,
        source: Union[str, Path, int],
        skip_frames: int = 0,
        max_frames: Optional[int] = None,
        return_frames: bool = False,
    ) -> Generator[TrackedFrame, None, None]:
        """
        Generator that yields TrackedFrame for each frame of a video or webcam.

        Why a generator?
        ─────────────────
        Same reasoning as detect.py's detect_video():
        Traffic.mp4 is ~9,000 frames — loading all at once would require ~55 GB.
        A generator yields one frame at a time and allows the FastAPI WebSocket
        handler to push results to the client without waiting for the full video.

        ByteTrack state is maintained ACROSS generator yields thanks to persist=True.
        Pausing iteration mid-video and resuming works correctly.

        Args:
            source      : Video file path (str/Path) OR webcam index (int).
                          Examples: \"datasets/videos/Traffic.mp4\", 0
            skip_frames : Process every (skip_frames+1)th frame.
                          0 = all frames. 1 = every other frame (2× speed).
                          Use 1–2 on slow machines to maintain real-time output.
            max_frames  : Stop after this many PROCESSED frames.
                          None = entire video / continuous webcam.
            return_frames: If True, attach BGR frames to TrackedFrame results.
                           Keep False in production to save memory.

        Yields:
            TrackedFrame per processed frame, in order.

        Raises:
            FileNotFoundError: Video file path does not exist.
            RuntimeError     : Video source cannot be opened, or model not loaded.
        """
        self._require_loaded()

        # ── Resolve source ────────────────────────────────────────────────────
        if isinstance(source, int):
            cap_source: Union[int, str] = source
            source_label = f"Webcam:{source}"
        else:
            source_path = Path(source).resolve()
            if not source_path.exists():
                raise FileNotFoundError(
                    f"[Tracker] Video not found: {source_path}"
                )
            cap_source = str(source_path)
            source_label = source_path.name

        cap = cv2.VideoCapture(cap_source)
        if not cap.isOpened():
            raise RuntimeError(
                f"[Tracker] Cannot open video source: {source_label}\n"
                f"  Verify the file is not corrupted and the codec is supported."
            )

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        total_label = "∞ (webcam)" if isinstance(source, int) else str(total_frames)
        print(
            f"[Tracker] Opening: {source_label}\n"
            f"  FPS    : {fps:.1f}  |  Total frames: {total_label}\n"
            f"  Device : {self.device}  |  Conf: {self.conf}  |  Skip: {skip_frames}"
        )

        raw_frame_idx = 0
        processed_count = 0

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break  # end of file or camera disconnect

                raw_frame_idx += 1

                # ── Frame skipping ────────────────────────────────────────────
                # Why still call track on non-skipped frames?
                # ByteTrack internally predicts track positions for every frame
                # using the Kalman filter. Skipping frames means the Kalman
                # predictions accumulate error. We skip to reduce GPU load
                # but the tracker still ages its internal states even for
                # skipped frames via predict-only steps in ByteTrack internals.
                if skip_frames > 0 and (raw_frame_idx - 1) % (skip_frames + 1) != 0:
                    continue

                self._frame_count += 1
                timestamp_ms = cap.get(cv2.CAP_PROP_POS_MSEC)

                tracked = self._track_frame_internal(
                    frame=frame,
                    frame_index=self._frame_count,
                    timestamp_ms=timestamp_ms,
                    camera_id=None,
                    return_frame=return_frames,
                )

                yield tracked
                processed_count += 1

                if max_frames is not None and processed_count >= max_frames:
                    break

        finally:
            # Always release the capture, even if the caller breaks early
            cap.release()
            print(
                f"[Tracker] Done — {source_label}\n"
                f"  Processed  : {processed_count} frames\n"
                f"  Total IDs  : {len(self._track_states)}\n"
                f"  Avg speed  : {self.avg_inference_ms:.1f} ms/frame "
                f"({self.avg_fps:.1f} FPS)"
            )

    # ── Trajectory queries ────────────────────────────────────────────────────

    def get_trajectory(self, track_id: int) -> List[Tuple[float, float]]:
        """
        Return the full trajectory for a specific track ID.

        Works for both active and inactive (lost/removed) tracks.
        Returns an empty list if the track_id was never seen.

        Args:
            track_id: The permanent ByteTrack integer ID.

        Returns:
            List of (cx, cy) center-point tuples, oldest first.
            Maximum length is max_trajectory_len.
        """
        state = self._track_states.get(track_id)
        if state is None:
            return []
        return state.trajectory_list

    def get_all_trajectories(
        self,
        active_only: bool = False,
    ) -> Dict[int, List[Tuple[float, float]]]:
        """
        Return trajectories for all tracked vehicles.

        Args:
            active_only: If True, only return tracks active in the last frame.
                         If False (default), return ALL tracks ever seen.

        Returns:
            Dict mapping track_id → list of (cx, cy) tuples.

        Usage:
            # All trajectories including lost vehicles
            all_traj = tracker.get_all_trajectories()

            # Only currently visible vehicles
            active_traj = tracker.get_all_trajectories(active_only=True)
        """
        if active_only:
            return {
                tid: state.trajectory_list
                for tid, state in self._track_states.items()
                if state.is_active
            }
        return {
            tid: state.trajectory_list
            for tid, state in self._track_states.items()
        }

    def get_track_summary(self, track_id: int) -> Optional[dict]:
        """
        Return a summary dict for a specific track ID.

        Includes class, trajectory length, displacement, and lifetime stats.
        Returns None if track_id was never seen.

        Args:
            track_id: The permanent ByteTrack integer ID.

        Returns:
            dict with track metadata, or None.
        """
        state = self._track_states.get(track_id)
        return state.to_dict() if state else None

    def get_all_track_summaries(self) -> List[dict]:
        """
        Return summary dicts for all tracks ever seen in this session.

        Useful for analytics: count total unique vehicles, filter by class,
        identify longest-lived tracks, export trajectory data to DB.

        Returns:
            List of track summary dicts, sorted by track_id ascending.
        """
        return [
            state.to_dict()
            for state in sorted(self._track_states.values(), key=lambda s: s.track_id)
        ]

    def get_active_count(self) -> int:
        """Return the number of tracks active in the most recent frame."""
        return len(self._prev_active_ids)

    def get_total_unique_vehicles(self) -> int:
        """
        Return total number of unique vehicles seen across the entire session.

        This is the correct way to count unique vehicles — not the per-frame
        count, which can fluctuate as vehicles enter and exit the frame.
        """
        return len(self._track_states)

    # ── Session management ────────────────────────────────────────────────────

    def reset(self) -> None:
        """
        Clear all track history and reset ByteTrack internal state.

        Use this when switching to a new video source to prevent track IDs
        from the previous session bleeding into the new one.

        After reset(), track IDs start from 1 again.

        Note: Does NOT reload the model weights. Call load() for that.
        """
        if self._model is not None and hasattr(self._model, "predictor") and self._model.predictor is not None:
            if hasattr(self._model.predictor, "trackers"):
                for t in self._model.predictor.trackers:
                    t.reset()

        self._track_states.clear()
        self._prev_active_ids.clear()
        self._inference_times.clear()
        self._frame_count = 0
        print("[Tracker] Session reset — track history and ByteTrack state cleared.")

    # ── Performance monitoring ────────────────────────────────────────────────

    @property
    def avg_inference_ms(self) -> float:
        """Rolling average inference time in ms (last 100 frames)."""
        recent = self._inference_times[-100:]
        if not recent:
            return 0.0
        return sum(recent) / len(recent)

    @property
    def avg_fps(self) -> float:
        """Estimated processing throughput in frames per second."""
        ms = self.avg_inference_ms
        return 1000.0 / ms if ms > 0 else 0.0

    def get_stats(self) -> dict:
        """
        Return a performance and session stats dict.

        Used by:
          - FastAPI /health endpoint
          - AnalyticsStore for logging
          - Debugging during development
        """
        return {
            "weights": str(self.weights),
            "device": self.device,
            "conf_threshold": self.conf,
            "iou_threshold": self.iou_threshold,
            "tracker_config": self.tracker_config,
            "max_trajectory_len": self.max_trajectory_len,
            "total_frames_processed": self._frame_count,
            "total_unique_vehicles": self.get_total_unique_vehicles(),
            "currently_active_tracks": self.get_active_count(),
            "avg_inference_ms": round(self.avg_inference_ms, 2),
            "avg_fps": round(self.avg_fps, 2),
        }

    def __repr__(self) -> str:
        status = "loaded" if self._model is not None else "not loaded"
        return (
            f"Tracker(weights={self.weights.name}, "
            f"device={self.device}, "
            f"conf={self.conf}, "
            f"status={status}, "
            f"tracks={len(self._track_states)})"
        )