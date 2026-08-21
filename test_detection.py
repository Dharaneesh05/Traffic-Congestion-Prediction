import sys
import os
sys.path.append('backend')
from detect import Detector

detector = Detector(weights='yolo11n.pt', conf=0.40)
detector.load()

results = detector.detect_video(source='datasets/videos/Traffic.mp4', max_frames=5, camera_id='CAM001')
for r in results:
    print(f"Frame: {r.frame_index}, Cam: {r.camera_id}, Time: {r.timestamp_ms}ms, Detections: {r.vehicle_count}")
    for d in r.detections:
        print(f"  - {d.class_name} ({d.confidence:.2f}) {d.bbox}")
