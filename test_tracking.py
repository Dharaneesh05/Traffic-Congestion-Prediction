import sys
import os
sys.path.append('backend')
from track import Tracker

tracker = Tracker(weights='yolo11n.pt', conf=0.40)
tracker.load()

results = tracker.track_video(source='datasets/videos/Traffic.mp4', max_frames=5)
for r in results:
    print(f"Frame: {r.frame_index}, Time: {r.timestamp_ms}ms, Active IDs: {r.active_track_ids}")
    for d in r.detections:
        print(f"  - ID: {d.track_id} {d.class_name} ({d.confidence:.2f}) {d.bbox}")
    for tid, traj in r.trajectories.items():
        print(f"  - Traj ID {tid}: {len(traj)} points")
