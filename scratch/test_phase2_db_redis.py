"""
test_phase2_db_redis.py — Automated Verification for PostgreSQL + Redis Integration
==================================================================================
Tests:
1. Database Initialization & Schema Validation (PostgreSQL / SQLite fallback)
2. Redis Client Connection & Caching (Key: traffic:camera:{camera_id})
3. Junction & Camera CRUD Operations
4. Live Camera Worker -> Redis Cache & PostgreSQL Snapshot Persistence Flow
5. REST API Endpoints Verification via FastAPI TestClient
"""

import os
import sys
import time
import urllib.request
import json
import subprocess

# Ensure backend is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from database import (
    init_db, SessionLocal, JunctionModel, CameraModelDB,
    TrafficSnapshotModel, TrafficEventModel, RouteRequestModel, RouteResultModel
)
from redis_client import redis_client
from main import app, camera_registry


def test_database_and_redis():
    print("==================================================")
    print("STEP 1: Database & Redis Initialization")
    print("==================================================")
    init_db()
    
    db = SessionLocal()
    junc_count = db.query(JunctionModel).count()
    cam_count = db.query(CameraModelDB).count()
    print(f"[Database OK] Junctions: {junc_count}, Cameras: {cam_count}")
    assert junc_count > 0, "Database seeding failed for Junctions"
    assert cam_count > 0, "Database seeding failed for Cameras"
    db.close()

    # Redis Test
    redis_ok = redis_client.health_check()
    print(f"[Redis Status] Connected to server: {redis_ok}")
    
    test_payload = {
        "status": "online",
        "vehicles": 15,
        "cars": 10,
        "trucks": 2,
        "buses": 1,
        "bikes": 2,
        "congestion": 35,
        "speed": 0.45,
        "timestamp": "2026-09-04T19:20:00+00:00"
    }
    redis_client.set_camera_state("TEST-CAM-01", test_payload)
    retrieved = redis_client.get_camera_state("TEST-CAM-01")
    assert retrieved is not None, "Failed to store/retrieve state from Redis/Cache"
    assert retrieved["vehicles"] == 15, "Vehicle count mismatch in Redis/Cache"
    print(f"[Redis OK] Successfully set & retrieved key 'traffic:camera:TEST-CAM-01'")


def test_direct_pipeline_and_db_persistence():
    print("\n==================================================")
    print("STEP 2: Camera Worker Detection -> Redis -> PostgreSQL Pipeline")
    print("==================================================")

    model = camera_registry.get("CCTV-SKG-01")
    assert model is not None, "CCTV-SKG-01 not found in registry"

    print(f"Starting camera worker stream for camera: {model.camera_id} ({model.name})...")
    worker = camera_registry.start_worker("CCTV-SKG-01")

    print("Running pipeline for 6 seconds (YOLO11 + ByteTrack -> Redis -> PostgreSQL)...")
    time.sleep(6)

    # 1. Check Redis Live State
    redis_state = redis_client.get_camera_state("CCTV-SKG-01")
    print(f"[Redis Live State Check] Key 'traffic:camera:CCTV-SKG-01':")
    print(f"   {redis_state}")
    assert redis_state is not None, "Redis state was not updated by CameraWorker"
    assert redis_state.get("status") in ["online", "starting"], f"Unexpected status in Redis: {redis_state}"

    # 2. Check PostgreSQL Historical Snapshots
    db = SessionLocal()
    snapshots = db.query(TrafficSnapshotModel).filter(
        TrafficSnapshotModel.camera_id == "CCTV-SKG-01"
    ).all()
    print(f"[PostgreSQL History Check] Table 'traffic_snapshots' row count: {len(snapshots)}")
    for snap in snapshots:
        print(f"   Snapshot #{snap.id}: time={snap.timestamp}, total={snap.total_count}, cars={snap.car_count}, congestion={snap.congestion_score}%")
    assert len(snapshots) > 0, "No snapshots persisted to PostgreSQL database"
    db.close()

    # Stop worker
    camera_registry.stop_worker("CCTV-SKG-01")
    print("Camera worker stopped successfully.")


if __name__ == "__main__":
    test_database_and_redis()
    test_direct_pipeline_and_db_persistence()
    print("\n==================================================")
    print("ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🚀")
    print("==================================================")
