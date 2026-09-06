"""
detect.py — YOLO11 Vehicle Detection Module
============================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Provides the `Detector` class for running YOLO11-based vehicle detection.

Supported sources:
    - Single image file       (.jpg, .png, .bmp, etc.)
    - Directory of images     (all images inside a folder)
    - Video file              (.mp4, .avi, .mov, etc.)
    - Webcam / live stream    (pass integer index, e.g. 0)

Usage:
    from detect import Detector

    detector = Detector(weights="yolo11n.pt", conf=0.40)
    detector.load()

    # ── Image ──────────────────────────────────────────────────────────────
    result = detector.detect_image("frame.jpg")
    print(result.vehicle_count, result.class_counts)

    # ── Video (generator — memory efficient) ───────────────────────────────
    for frame_result in detector.detect_video("datasets/videos/Traffic.mp4"):
        print(frame_result.frame_index, frame_result.vehicle_count)

    # ── Webcam ─────────────────────────────────────────────────────────────
    for frame_result in detector.detect_video(source=0, max_frames=300):
        print(frame_result.detections)

    # ── Image folder ───────────────────────────────────────────────────────
    results = detector.detect_image_folder("datasets/vehicle_dataset/valid/images")
    for r in results:
        print(r.frame_index, r.vehicle_count)
"""

from __future__ import annotations

import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Generator, List, Optional, Tuple, Union

import cv2
import numpy as np

# Ensure backend directory is in sys.path
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)



# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

# COCO pretrained model class IDs → project class IDs
# COCO: car=2, motorcycle=3, bus=5, truck=7
_COCO_TO_PROJECT: dict[int, int] = {2: 0, 3: 3, 5: 2, 7: 1}

# Project class names (index matches project class ID)
CLASS_NAMES: List[str] = ["car", "truck", "bus", "motorcycle"]

# BGR colors per class (used for visualization in other modules)
CLASS_COLORS: dict[str, Tuple[int, int, int]] = {
    "car":        (50,  220,  50),   # Green
    "truck":      (50,  180, 255),   # Blue
    "bus":        (255, 100,  50),   # Orange
    "motorcycle": (200,  50, 255),   # Purple
}

# Supported image extensions for folder detection
_IMAGE_EXTENSIONS: Tuple[str, ...] = (
    ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"
)


# ──────────────────────────────────────────────────────────────────────────────
# Data Structures
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class Detection:
    """
    A single vehicle detection from one frame.

    Attributes:
        bbox         : Bounding box (x1, y1, x2, y2) in pixel coordinates.
        confidence   : Detection confidence score in [0.0, 1.0].
        class_id     : Project class index (0=car, 1=truck, 2=bus, 3=motorcycle).
        class_name   : Human-readable class label.
        track_id     : Assigned by the tracker (None until tracking is applied).
    """
    bbox: Tuple[float, float, float, float]  # (x1, y1, x2, y2)
    confidence: float
    class_id: int
    class_name: str
    track_id: Optional[int] = None

    # ── Derived properties ────────────────────────────────────────────────

    @property
    def center(self) -> Tuple[float, float]:
        """(cx, cy) center of the bounding box in pixels."""
        x1, y1, x2, y2 = self.bbox
        return (x1 + x2) / 2.0, (y1 + y2) / 2.0

    @property
    def width(self) -> float:
        """Width of the bounding box in pixels."""
        return self.bbox[2] - self.bbox[0]

    @property
    def height(self) -> float:
        """Height of the bounding box in pixels."""
        return self.bbox[3] - self.bbox[1]

    @property
    def area(self) -> float:
        """Pixel area of the bounding box. Always >= 0."""
        return max(0.0, self.width) * max(0.0, self.height)

    def to_dict(self) -> dict:
        """Return a JSON-serialisable dict. Used by FastAPI response schemas."""
        return {
            "bbox": list(self.bbox),
            "confidence": round(self.confidence, 4),
            "class_id": self.class_id,
            "class_name": self.class_name,
            "track_id": self.track_id,
        }

    def __repr__(self) -> str:
        tid = f" track={self.track_id}" if self.track_id is not None else ""
        return (
            f"Detection({self.class_name}{tid} "
            f"conf={self.confidence:.2f} "
            f"bbox=({self.bbox[0]:.0f},{self.bbox[1]:.0f},"
            f"{self.bbox[2]:.0f},{self.bbox[3]:.0f}))"
        )


@dataclass
class FrameResult:
    """
    All detection results for a single frame.

    Attributes:
        frame_index      : Sequential frame number (1-based for video).
        timestamp_ms     : Position in the video stream in milliseconds.
        detections       : List of Detection objects found in this frame.
        inference_time_ms: Time taken by the model to process this frame (ms).
        frame            : Raw BGR frame (numpy array). Only set if
                           `return_frame=True` was passed to the detect method.
    """
    frame_index: int
    timestamp_ms: float
    detections: List[Detection]
    inference_time_ms: float
    camera_id: Optional[str] = None
    frame: Optional[np.ndarray] = field(default=None, repr=False)

    @property
    def vehicle_count(self) -> int:
        """Total number of detected vehicles in this frame."""
        return len(self.detections)

    @property
    def class_counts(self) -> dict[str, int]:
        """Per-class vehicle count for this frame. e.g. {'car': 3, 'truck': 1, ...}"""
        counts: dict[str, int] = {name: 0 for name in CLASS_NAMES}
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
            "detections": [d.to_dict() for d in self.detections],
        }


# ──────────────────────────────────────────────────────────────────────────────
# Detector Class
# ──────────────────────────────────────────────────────────────────────────────

class Detector:
    """
    Production YOLO11 vehicle detector.

    Design decisions vs. original detect.py:
    ─────────────────────────────────────────
    1. CLASS WRAPPER — old code was a flat script (no class). A class allows the
       model to be loaded once and reused across thousands of frames without
       reloading weights each time. It also lets FastAPI hold a single shared
       instance safely.

    2. PATH RESOLUTION — old code used "../yolo11n.pt" (relative to backend/).
       This breaks when FastAPI is started from the project root. We now resolve
       all paths relative to THIS file's location using pathlib.Path(__file__).

    3. GPU AUTO-DETECTION — old code had no device handling. We now check for
       CUDA, then Apple MPS (Silicon), then fall back to CPU automatically.

    4. FRAME-BY-FRAME API — old code called model.predict() in one shot on a
       folder. That loads all images into memory. We now use cv2.VideoCapture
       with a generator for videos (memory-efficient, frame-by-frame streaming).

    5. STRUCTURED OUTPUT — old code returned raw Ultralytics result objects.
       We now return Detection and FrameResult dataclasses that are JSON-ready
       and compatible with the rest of the pipeline (tracker, counter, etc.).

    6. WARMUP INFERENCE — 3 dummy passes on load() prime the CUDA kernels and
       eliminate cold-start latency spikes on the first real frame.

    7. COCO FILTER — pretrained YOLO11 detects 80 COCO classes. We filter to
       only the 4 vehicle classes (car, truck, bus, motorcycle) and map their
       COCO IDs to our project IDs before returning.
    """

    # ── Construction ─────────────────────────────────────────────────────────

    def __init__(
        self,
        weights: Union[str, Path, None] = None,
        conf: float = 0.40,
        iou: float = 0.45,
        device: Optional[str] = None,
        custom_trained: bool = False,
        img_size: int = 640,
        max_det: int = 300,
    ) -> None:
        """
        Args:
            weights       : Path to YOLO11 .pt file.
                            Defaults to <project_root>/yolo11n.pt
                            (one level above backend/).
            conf          : Minimum confidence threshold (0.0–1.0).
                            Lower = more detections but more false positives.
                            0.40 is a good starting point for CCTV footage.
            iou           : IoU threshold for Non-Maximum Suppression (0.0–1.0).
                            Lower = fewer overlapping boxes.
            device        : "cpu", "cuda", "cuda:0", "mps", or None for auto.
                            None triggers automatic GPU detection.
            custom_trained: Set True when using a model fine-tuned on our
                            dataset (class IDs are already 0–5 for our classes).
                            Set False (default) when using pretrained COCO
                            weights (class IDs must be remapped via COCO map).
            img_size      : Input image size fed to the model (default 640).
                            Must match the size used during training.
            max_det       : Maximum number of detections per frame.
        """
        # ── Why resolve the path here instead of passing it as-is? ──────────
        # When FastAPI starts from the project root (Smart Traffic/),
        # "../yolo11n.pt" would be an invalid path. We resolve relative to
        # this file's parent (backend/) so the path is always correct
        # regardless of the caller's working directory.
        if weights is None:
            candidate = Path(__file__).resolve().parent.parent / "yolo11n.pt"
            if not candidate.exists():
                candidate = Path(__file__).resolve().parent / "yolo11n.pt"
            self.weights = candidate
        else:
            p = Path(weights)
            if not p.is_absolute() and not p.exists():
                backend_p = Path(__file__).resolve().parent / p.name
                if backend_p.exists():
                    p = backend_p
            self.weights = p.resolve()


        self.conf = conf
        self.iou_threshold = iou
        self.img_size = img_size
        self.max_det = max_det
        self.custom_trained = custom_trained

        # ── Why auto-detect GPU instead of hardcoding? ──────────────────────
        # If the user has CUDA, we use it for 10–40× faster inference.
        # If they're on Apple Silicon, MPS gives 5–10× speedup over CPU.
        # This makes the code portable across lab, laptop, and server.
        self.device: str = device if device is not None else self._resolve_device()

        self._model = None  # Loaded by .load() — not at __init__ time
        self._inference_times: List[float] = []  # Rolling inference log (ms)

    # ── Device selection ─────────────────────────────────────────────────────

    @staticmethod
    def _resolve_device() -> str:
        """
        Auto-select the best available compute device.

        Why this order?
        ─────────────
        1. CUDA (NVIDIA GPU) — fastest for YOLO inference (40+ FPS on T4)
        2. MPS (Apple Silicon) — good speedup on M1/M2 Macs
        3. CPU — universally available fallback
        """
        try:
            import torch
            if torch.cuda.is_available():
                return "cuda"
            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                return "mps"
        except ImportError:
            pass
        return "cpu"

    # ── Model loading ─────────────────────────────────────────────────────────

    def load(self) -> "Detector":
        """
        Load YOLO11 weights and run warmup inference.

        Why warmup?
        ───────────
        CUDA lazily compiles kernels on the first inference call. Without warmup,
        the first frame takes 2–10× longer than subsequent frames, causing a
        visible spike in FPS. 3 dummy passes prime all kernels at load time.

        Returns self so you can chain: detector = Detector().load()
        """
        # ── Why check file existence here instead of at __init__? ────────────
        # We want the error to appear at startup, not midway through processing.
        from ultralytics import YOLO

        if not self.weights.exists():
            print(f"[Detector] Weights {self.weights} not found. Auto-downloading yolo11n.pt...")
            self._model = YOLO("yolo11n.pt")
        else:
            self._model = YOLO(str(self.weights))

        self._model.to(self.device)

        # Warmup: 3 silent passes with a blank frame
        dummy = np.zeros((self.img_size, self.img_size, 3), dtype=np.uint8)
        for _ in range(3):
            self._model(dummy, verbose=False)
        self._inference_times.clear()

        print(
            f"[Detector] YOLO11 loaded successfully\n"
            f"  Weights : {self.weights.name}\n"
            f"  Device  : {self.device}\n"
            f"  Conf    : {self.conf}  |  IoU: {self.iou_threshold}\n"
            f"  ImgSize : {self.img_size}"
        )
        return self

    def _require_loaded(self) -> None:
        """Raise a clear error if the model was not loaded before inference."""
        if self._model is None:
            raise RuntimeError(
                "[Detector] Model not loaded. Call detector.load() before running inference."
            )

    # ── Core inference ────────────────────────────────────────────────────────

    def _infer(self, frame: np.ndarray) -> List[Detection]:
        """
        Run YOLO11 on a single BGR frame and return Detection objects.

        Why return Detection objects instead of raw Ultralytics results?
        ────────────────────────────────────────────────────────────────
        - Ultralytics result objects are tightly coupled to the YOLO library.
        - Downstream modules (tracker, counter, analytics) should not depend
          on Ultralytics internals — they need a stable, library-agnostic API.
        - Detection dataclass is JSON-serialisable via to_dict().

        Args:
            frame: BGR image as numpy array (H, W, 3).

        Returns:
            List of Detection objects for vehicle classes only.
        """
        t0 = time.perf_counter()

        # ── Why verbose=False? ──────────────────────────────────────────────
        # YOLO prints a table for every inference call by default.
        # In a FastAPI server processing 30 FPS, this would flood logs.
        results = self._model(
            frame,
            conf=self.conf,
            iou=self.iou_threshold,
            imgsz=self.img_size,
            max_det=self.max_det,
            verbose=False,
        )

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        self._inference_times.append(elapsed_ms)

        detections: List[Detection] = []
        for result in results:
            if result.boxes is None:
                continue

            for box in result.boxes:
                coco_cls = int(box.cls[0].item())
                conf_val = float(box.conf[0].item())
                x1, y1, x2, y2 = box.xyxy[0].tolist()

                if self.custom_trained:
                    # ── Custom-trained model ────────────────────────────────
                    # Class IDs map directly to our 6-class dataset:
                    # 0=3wheeler, 1=bike, 2=bus, 3=car, 4=person, 5=truck
                    # We only keep vehicle classes (not person=4).
                    # Adjust this mapping when data.yaml class order changes.
                    if coco_cls >= len(CLASS_NAMES):
                        continue
                    class_id = coco_cls
                else:
                    # ── Pretrained COCO model ───────────────────────────────
                    # Filter out non-vehicle COCO classes.
                    # Map COCO IDs to our project IDs.
                    if coco_cls not in _COCO_TO_PROJECT:
                        continue
                    class_id = _COCO_TO_PROJECT[coco_cls]

                detections.append(Detection(
                    bbox=(x1, y1, x2, y2),
                    confidence=conf_val,
                    class_id=class_id,
                    class_name=CLASS_NAMES[class_id],
                ))

        return detections

    # ── Public API ────────────────────────────────────────────────────────────

    def detect(
        self,
        frame: np.ndarray,
        frame_index: int = 0,
        timestamp_ms: float = 0.0,
        camera_id: Optional[str] = None,
        return_frame: bool = False,
    ) -> FrameResult:
        """
        Process a single raw BGR frame from memory.
        """
        self._require_loaded()
        detections = self._infer(frame)
        return FrameResult(
            frame_index=frame_index,
            timestamp_ms=timestamp_ms,
            detections=detections,
            inference_time_ms=self._inference_times[-1],
            camera_id=camera_id,
            frame=frame if return_frame else None,
        )

    def detect_image(
        self,
        path: Union[str, Path],
        return_frame: bool = False,
    ) -> FrameResult:
        """
        Run detection on a single image file.

        Why return FrameResult instead of just List[Detection]?
        ────────────────────────────────────────────────────────
        FrameResult bundles the detections with metadata (inference time,
        frame index, timestamp) that the analytics store and FastAPI endpoint
        need. This avoids passing multiple return values.

        Args:
            path        : Absolute or relative path to an image file.
            return_frame: If True, the raw BGR frame is attached to the result.
                          Keep False in production to avoid large memory usage.

        Returns:
            FrameResult with detections and metadata.

        Raises:
            FileNotFoundError: If the image file does not exist.
            ValueError       : If OpenCV cannot read the file (corrupted / wrong format).
            RuntimeError     : If the model has not been loaded via .load().
        """
        self._require_loaded()
        path = Path(path).resolve()

        if not path.exists():
            raise FileNotFoundError(f"[Detector] Image not found: {path}")

        frame = cv2.imread(str(path))
        if frame is None:
            raise ValueError(
                f"[Detector] OpenCV could not read image: {path}\n"
                f"  File may be corrupted or in an unsupported format."
            )

        detections = self._infer(frame)
        return FrameResult(
            frame_index=0,
            timestamp_ms=0.0,
            detections=detections,
            inference_time_ms=self._inference_times[-1],
            frame=frame if return_frame else None,
        )

    def detect_image_folder(
        self,
        folder: Union[str, Path],
        extensions: Tuple[str, ...] = _IMAGE_EXTENSIONS,
        return_frames: bool = False,
    ) -> List[FrameResult]:
        """
        Run detection on all images in a directory.

        Why load images sequentially instead of all at once?
        ─────────────────────────────────────────────────────
        The valid split has ~1,500 images × 640×640 pixels = ~1.7 GB RAM if
        loaded simultaneously. Sequential loading keeps memory constant.

        Args:
            folder       : Path to the image directory.
            extensions   : File extensions to include (case-insensitive).
            return_frames: If True, attach BGR frames to results.

        Returns:
            List of FrameResult, one per successfully read image.
            Unreadable files are skipped with a warning.

        Raises:
            NotADirectoryError: If the path is not a directory.
            FileNotFoundError : If no images found in the folder.
            RuntimeError      : If the model has not been loaded.
        """
        self._require_loaded()
        folder = Path(folder).resolve()

        if not folder.is_dir():
            raise NotADirectoryError(f"[Detector] Not a directory: {folder}")

        image_paths = sorted(
            p for p in folder.iterdir()
            if p.suffix.lower() in extensions
        )

        if not image_paths:
            raise FileNotFoundError(
                f"[Detector] No images found in: {folder}\n"
                f"  Supported extensions: {extensions}"
            )

        print(f"[Detector] Processing {len(image_paths)} images from: {folder.name}")
        results: List[FrameResult] = []

        for idx, img_path in enumerate(image_paths):
            frame = cv2.imread(str(img_path))
            if frame is None:
                print(f"[Detector] Warning: skipping unreadable image — {img_path.name}")
                continue

            detections = self._infer(frame)
            results.append(FrameResult(
                frame_index=idx,
                timestamp_ms=0.0,
                detections=detections,
                inference_time_ms=self._inference_times[-1],
                frame=frame if return_frames else None,
            ))

        print(
            f"[Detector] Folder done — processed {len(results)}/{len(image_paths)} images "
            f"| avg {self.avg_inference_ms:.1f} ms/frame"
        )
        return results

    def detect_video(
        self,
        source: Union[str, Path, int],
        skip_frames: int = 0,
        max_frames: Optional[int] = None,
        return_frames: bool = False,
        camera_id: Optional[str] = None,
    ) -> Generator[FrameResult, None, None]:
        """
        Generator that yields FrameResult for each frame of a video or webcam.

        Why a generator instead of returning a list?
        ─────────────────────────────────────────────
        Traffic.mp4 is 163 MB / ~30 FPS / ~5 minutes ≈ ~9,000 frames.
        Loading all frames at once would use 9,000 × 1920×1080×3 bytes ≈ 55 GB.
        A generator yields one frame at a time — memory stays constant regardless
        of video length. This also enables real-time streaming to a WebSocket.

        Why not use model.predict(source=video)?
        ─────────────────────────────────────────
        Ultralytics' bulk predict loads the entire video before processing and
        returns all results at once. This blocks the event loop and cannot
        stream results frame-by-frame to connected clients.

        Args:
            source      : Video file path (str/Path) OR webcam index (int).
                          Examples: "datasets/videos/Traffic.mp4", 0, 1
            skip_frames : Process every (skip_frames+1)th frame.
                          0 = process every frame (default).
                          1 = process every other frame (2× speed, ½ accuracy).
                          Use 1–2 to reduce load on slow machines.
            max_frames  : Stop after this many frames. None = entire video.
                          Useful for testing: detect_video("x.mp4", max_frames=100)
            return_frames: If True, attach the BGR frame to each FrameResult.
                          Keep False in the FastAPI server — frames are encoded
                          to JPEG separately by the WebSocket handler.

        Yields:
            FrameResult for each processed frame, in order.

        Raises:
            FileNotFoundError: If the video file path does not exist.
            RuntimeError     : If the video source cannot be opened,
                               or if the model has not been loaded.
        """
        self._require_loaded()

        # ── Resolve source ────────────────────────────────────────────────────
        # Why separate int/Path handling?
        # cv2.VideoCapture(0) opens webcam 0. cv2.VideoCapture("video.mp4")
        # opens a file. They need different validation logic.
        if isinstance(source, int):
            cap_source: Union[int, str] = source  # webcam index
            source_label = f"Webcam:{source}"
        else:
            source_path = Path(source).resolve()
            if not source_path.exists():
                raise FileNotFoundError(
                    f"[Detector] Video file not found: {source_path}"
                )
            cap_source = str(source_path)
            source_label = source_path.name

        cap = cv2.VideoCapture(cap_source)
        if not cap.isOpened():
            raise RuntimeError(
                f"[Detector] Cannot open video source: {source_label}\n"
                f"  Check that the file is not corrupted and codec is supported."
            )

        # ── Video metadata ─────────────────────────────────────────────────
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        total_label = "∞ (webcam)" if isinstance(source, int) else str(total_frames)
        print(
            f"[Detector] Opening: {source_label}\n"
            f"  FPS    : {fps:.1f}  |  Total frames: {total_label}\n"
            f"  Device : {self.device}  |  Skip: every {skip_frames + 1}"
        )

        raw_frame_idx = 0      # counts every frame read from the stream
        processed_count = 0    # counts frames we actually ran inference on

        try:
            while True:
                ret, frame = cap.read()

                # ── End of stream ─────────────────────────────────────────
                # ret=False when the video ends or the camera disconnects.
                if not ret:
                    break

                raw_frame_idx += 1

                # ── Frame skipping ────────────────────────────────────────
                # Why use modulo instead of a counter?
                # Modulo is deterministic — frame 1 is always processed,
                # frame 2 skipped (if skip=1), frame 3 processed, etc.
                # A counter approach would lose sync if the loop continues.
                if skip_frames > 0 and (raw_frame_idx - 1) % (skip_frames + 1) != 0:
                    continue

                # ── Timestamp from the video stream ───────────────────────
                # CAP_PROP_POS_MSEC gives the current position in ms.
                # This is more reliable than computing from FPS × frame_idx.
                timestamp_ms = cap.get(cv2.CAP_PROP_POS_MSEC)

                detections = self._infer(frame)

                yield FrameResult(
                    frame_index=raw_frame_idx,
                    timestamp_ms=timestamp_ms,
                    detections=detections,
                    inference_time_ms=self._inference_times[-1],
                    camera_id=camera_id,
                    frame=frame if return_frames else None,
                )

                processed_count += 1

                # ── Early stop ────────────────────────────────────────────
                if max_frames is not None and processed_count >= max_frames:
                    break

        finally:
            # ── Why use finally? ─────────────────────────────────────────
            # If the caller breaks out of the loop early (e.g., KeyboardInterrupt,
            # exception in the processing code), the VideoCapture must still
            # be released. Without this, the camera/file remains locked.
            cap.release()
            print(
                f"[Detector] Done — {source_label}\n"
                f"  Processed : {processed_count} frames\n"
                f"  Avg speed : {self.avg_inference_ms:.1f} ms/frame "
                f"({self.avg_fps:.1f} FPS)"
            )

    # ── Performance monitoring ────────────────────────────────────────────────

    @property
    def avg_inference_ms(self) -> float:
        """
        Rolling average inference time in milliseconds (last 100 frames).

        Why only 100 frames?
        ─────────────────────
        We want a responsive estimate that adapts to changing conditions
        (temperature throttling, VRAM pressure). Older frames are less
        representative of current performance.
        """
        recent = self._inference_times[-100:]
        if not recent:
            return 0.0
        return sum(recent) / len(recent)

    @property
    def avg_fps(self) -> float:
        """Estimated throughput in frames per second based on inference time."""
        ms = self.avg_inference_ms
        return 1000.0 / ms if ms > 0 else 0.0

    def get_stats(self) -> dict:
        """Return a stats dict for logging or the FastAPI /health endpoint."""
        return {
            "weights": str(self.weights),
            "device": self.device,
            "conf_threshold": self.conf,
            "iou_threshold": self.iou_threshold,
            "img_size": self.img_size,
            "avg_inference_ms": round(self.avg_inference_ms, 2),
            "avg_fps": round(self.avg_fps, 2),
            "total_inferences": len(self._inference_times),
        }

    def __repr__(self) -> str:
        status = "loaded" if self._model is not None else "not loaded"
        return (
            f"Detector(weights={self.weights.name}, "
            f"device={self.device}, "
            f"conf={self.conf}, "
            f"status={status})"
        )