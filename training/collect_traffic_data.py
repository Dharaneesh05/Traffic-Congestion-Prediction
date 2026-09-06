"""
collect_traffic_data.py — Real Traffic Telemetry Ingestion Engine
==================================================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Processes traffic video feeds in datasets/videos/ using YOLO11 + ByteTrack + TrafficAnalyser
to collect authentic frame-level and minute-level traffic telemetry:
  - vehicle_count
  - vehicle_density
  - average_speed_kmh
  - traffic_flow_vpm
  - road_occupancy
  - congestion_score
  - class_counts

Saves chronological time-series observations to datasets/traffic_observations.json
and optionally persists snapshots to the PostgreSQL / SQLite database.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

# Ensure backend directory is in sys.path
PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import cv2
import numpy as np

# Internal modules
from track import Tracker
from counter import VehicleCounter, LineConfig
from traffic_analysis import TrafficAnalyser, AnalysisConfig
from database import SessionLocal, TrafficSnapshotModel, CameraModelDB


def collect_data(
    videos_dir: Path,
    output_json: Path,
    frame_skip: int = 15,
    max_frames_per_video: Optional[int] = 100,
    persist_db: bool = True,
    conf_thresh: float = 0.25,
    time_step_s: float = 20.0,
) -> List[dict]:
    """
    Run YOLO11 + ByteTrack + TrafficAnalyser across video files to generate
    genuine chronological traffic telemetry using fast CPU-optimized frame grabbing.
    """
    print("=" * 70)
    print("TRAFFIC DATA COLLECTION PIPELINE (YOLO11 + ByteTrack + Analyser)")
    print("=" * 70)

    if not videos_dir.exists():
        raise FileNotFoundError(f"Videos directory not found: {videos_dir}")

    video_files = sorted(list(videos_dir.glob("*.mp4")))
    if not video_files:
        # Check backend/ByteTrack/videos/palace.mp4 fallback
        fallback = BACKEND_DIR / "ByteTrack" / "videos" / "palace.mp4"
        if fallback.exists():
            video_files = [fallback]
        else:
            raise FileNotFoundError(f"No .mp4 video files found in {videos_dir}")

    print(f"Found {len(video_files)} video feed(s): {[v.name for v in video_files]}")
    print(f"Configuration: frame_skip={frame_skip} (using hardware fast grab), max_frames_per_video={max_frames_per_video}")

    # Initialize YOLO11 + ByteTrack Tracker
    print("\n[Init] Initializing YOLO11 + ByteTrack tracker...")
    tracker = Tracker(weights="yolo11n.pt", conf=conf_thresh, tracker_config="bytetrack.yaml").load()

    # Counter lines and TrafficAnalyser
    counter_line = LineConfig(name="L1", p1=(0.1, 0.5), p2=(0.9, 0.5), direction="both")
    counter = VehicleCounter(lines=[counter_line])
    analyser = TrafficAnalyser(AnalysisConfig(fps=30.0 / max(1, frame_skip)))

    all_observations: List[dict] = []
    # Anchor base wall time to 4 hours ago for continuous progressive time-series
    base_wall_time = time.time() - 14400.0
    simulated_wall_time = base_wall_time

    db_sess = SessionLocal() if persist_db else None
    db_snapshots_count = 0

    total_frames_processed = 0
    start_wall_clock = time.time()

    for v_idx, v_path in enumerate(video_files):
        print(f"\n[{v_idx + 1}/{len(video_files)}] Processing: {v_path.name}...")
        cap = cv2.VideoCapture(str(v_path))
        if not cap.isOpened():
            print(f"  [Warning] Could not open {v_path.name}, skipping.")
            continue

        camera_id = f"CCTV-SKG-{(v_idx % 4) + 1:02d}"
        vid_processed = 0
        vid_t0 = time.time()

        while cap.isOpened():
            # Fast forward across skipped frames without full image decoding
            for _ in range(frame_skip - 1):
                if not cap.grab():
                    break

            ret, frame = cap.read()
            if not ret:
                break

            vid_processed += 1
            total_frames_processed += 1
            simulated_wall_time += time_step_s
            timestamp_ms = (vid_processed * time_step_s) * 1000.0

            # 1. Track frame with YOLO11 + ByteTrack
            track_result = tracker.track_frame(frame, camera_id=camera_id, timestamp_ms=timestamp_ms)

            # 2. Update counter
            events = counter.update(track_result.detections, frame_index=vid_processed)

            # 3. Update traffic analytics
            metrics = analyser.update(
                detections=track_result.detections,
                trajectories=track_result.trajectories,
                crossing_events=events,
                frame_index=vid_processed,
                timestamp_ms=timestamp_ms,
            )

            # Extract per-class vehicle counts
            c_counts = {"car": 0, "truck": 0, "bus": 0, "bike": 0}
            for det in track_result.detections:
                cn = det.class_name.lower()
                if cn in ["motorcycle", "motorbike", "bike"]:
                    c_counts["bike"] += 1
                elif cn in c_counts:
                    c_counts[cn] += 1
                else:
                    c_counts["car"] += 1

            now_iso = datetime.datetime.fromtimestamp(simulated_wall_time, tz=datetime.timezone.utc).isoformat()

            obs = {
                "timestamp": now_iso,
                "wall_time_s": round(simulated_wall_time, 3),
                "camera_id": camera_id,
                "junction_id": "JUNC_SANKAGIRI_01",
                "frame_index": total_frames_processed,
                "vehicle_count": metrics.vehicle_count,
                "vehicle_density": round(metrics.vehicle_density, 4),
                "average_speed_kmh": round(metrics.average_speed_kmh, 2),
                "traffic_flow_vpm": round(metrics.traffic_flow_vpm, 2),
                "road_occupancy": round(metrics.road_occupancy, 4),
                "congestion_score": round(metrics.congestion_score, 4),
                "congestion_level": metrics.congestion_level,
                "class_counts": c_counts,
            }
            all_observations.append(obs)

            # Periodic database snapshot persistence (every 25 sampled frames)
            if db_sess and vid_processed % 25 == 0:
                try:
                    snap = TrafficSnapshotModel(
                        camera_id=camera_id,
                        timestamp=now_iso,
                        car_count=c_counts["car"],
                        truck_count=c_counts["truck"],
                        bus_count=c_counts["bus"],
                        bike_count=c_counts["bike"],
                        total_count=metrics.vehicle_count,
                        congestion_score=int(round(metrics.congestion_score * 100)),
                        average_speed=round(metrics.average_speed_kmh, 2),
                    )
                    db_sess.add(snap)
                    db_sess.commit()
                    db_snapshots_count += 1
                except Exception:
                    db_sess.rollback()

            if max_frames_per_video and vid_processed >= max_frames_per_video:
                print(f"  Reached max frames limit ({max_frames_per_video}) for {v_path.name}")
                break

            if vid_processed % 30 == 0:
                cur_rate = vid_processed / max(0.1, time.time() - vid_t0)
                print(f"  Processed {vid_processed} frames ({cur_rate:.2f} FPS) - vehicle_count={metrics.vehicle_count}, score={metrics.congestion_score:.2f}")

        cap.release()
        vid_time = time.time() - vid_t0
        print(f"  Done {v_path.name}: {vid_processed} frames analyzed in {vid_time:.1f}s ({vid_processed/max(0.1, vid_time):.2f} FPS) (cumulative: {len(all_observations)} observations).")

    if db_sess:
        db_sess.close()

    elapsed_time = time.time() - start_wall_clock
    print(f"\n[Data Collection Complete]")
    print(f"  Total frames analyzed   : {total_frames_processed}")
    print(f"  Total observations saved: {len(all_observations)}")
    print(f"  Database snapshots saved: {db_snapshots_count}")
    print(f"  Processing time         : {elapsed_time:.1f}s ({total_frames_processed / max(0.1, elapsed_time):.1f} FPS)")

    # Save to JSON
    output_json.parent.mkdir(parents=True, exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "total_observations": len(all_observations),
            "observations": all_observations
        }, f, indent=2)

    print(f"  Saved observation dataset to: {output_json}")
    return all_observations


def main():
    parser = argparse.ArgumentParser(description="Collect authentic traffic telemetry from video feeds.")
    parser.add_argument("--videos-dir", type=str, default="datasets/videos", help="Directory containing traffic videos")
    parser.add_argument("--output", type=str, default="datasets/traffic_observations.json", help="Path to save observations JSON")
    parser.add_argument("--frame-skip", type=int, default=15, help="Sample every N frames (default: 15 for fast CPU processing)")
    parser.add_argument("--max-frames", type=int, default=100, help="Max frames per video (default: 100)")
    parser.add_argument("--time-step-s", type=float, default=20.0, help="Chronological simulated time step in seconds between samples (default: 20.0)")
    parser.add_argument("--no-db", action="store_true", help="Skip saving snapshots to database")
    args = parser.parse_args()

    videos_dir = PROJECT_ROOT / args.videos_dir
    output_path = PROJECT_ROOT / args.output

    collect_data(
        videos_dir=videos_dir,
        output_json=output_path,
        frame_skip=args.frame_skip,
        max_frames_per_video=args.max_frames,
        persist_db=not args.no_db,
        time_step_s=args.time_step_s,
    )


if __name__ == "__main__":
    main()
