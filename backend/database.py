"""
database.py — Persistent Database Layer (PostgreSQL / SQLite Fallback)
=====================================================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Provides persistent storage for Junctions, Cameras, Traffic Snapshots, Traffic Events,
Route Requests, and Route Results using SQLAlchemy.

Supports PostgreSQL (default via DATABASE_URL) with automatic fallback to SQLite.
"""

import os
import sys
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text, Index
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session

# Ensure backend directory is in sys.path
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from config import VIDEO_DIR

# ──────────────────────────────────────────────────────────────────────────────
# Engine Initialization with Fallback Strategy
# ──────────────────────────────────────────────────────────────────────────────

PG_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/traffic_db")
SQLITE_URL = f"sqlite:///{os.path.join(_BACKEND_DIR, 'traffic_system.db')}"

engine = None
try:
    print(f"[Database] Connecting to PostgreSQL: {PG_URL}")
    test_engine = create_engine(PG_URL, connect_args={"connect_timeout": 2})
    with test_engine.connect() as conn:
        pass
    engine = test_engine
    print("[Database] Connected successfully to PostgreSQL.")
except Exception as e:
    print(f"[Database] PostgreSQL connection unavailable ({e}). Using SQLite fallback: {SQLITE_URL}")
    engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ──────────────────────────────────────────────────────────────────────────────
# Database Models
# ──────────────────────────────────────────────────────────────────────────────

class JunctionModel(Base):
    """Represents a traffic junction / intersection."""
    __tablename__ = "junctions"

    id = Column(Integer, primary_key=True, index=True)
    junction_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False, index=True)
    district = Column(String, nullable=False, default="Salem")
    state = Column(String, nullable=False, default="Tamil Nadu")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    created_at = Column(String, default=lambda: datetime.now(timezone.utc).isoformat())

    cameras = relationship("CameraModelDB", back_populates="junction", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "junction_id": self.junction_id,
            "name": self.name,
            "district": self.district,
            "state": self.state,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "created_at": self.created_at
        }


class CameraModelDB(Base):
    """Represents a camera monitoring approach for a specific junction."""
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    camera_code = Column(String, unique=True, index=True, nullable=False)
    junction_id = Column(String, ForeignKey("junctions.junction_id"), nullable=False)
    name = Column(String, nullable=False)
    approach = Column(String, nullable=False)
    road_name = Column(String, nullable=False, default="Main Approach")
    source_type = Column(String, nullable=False)  # "ip" | "webcam" | "video" | "rtsp"
    source_url = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(String, default="OFFLINE")
    created_at = Column(String, default=lambda: datetime.now(timezone.utc).isoformat())

    junction = relationship("JunctionModel", back_populates="cameras")
    snapshots = relationship("TrafficSnapshotModel", back_populates="camera", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "camera_id": self.camera_code,
            "camera_code": self.camera_code,
            "junction_id": self.junction_id,
            "name": self.name,
            "approach": self.approach,
            "road_name": self.road_name,
            "source_type": self.source_type,
            "source_url": self.source_url,
            "source": self.source_url,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "status": self.status,
            "created_at": self.created_at
        }


class TrafficSnapshotModel(Base):
    """Periodic historical traffic snapshot produced by vehicle detection and tracking."""
    __tablename__ = "traffic_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String, ForeignKey("cameras.camera_code"), nullable=False, index=True)
    timestamp = Column(String, nullable=False, index=True, default=lambda: datetime.now(timezone.utc).isoformat())
    car_count = Column(Integer, default=0)
    truck_count = Column(Integer, default=0)
    bus_count = Column(Integer, default=0)
    bike_count = Column(Integer, default=0)
    total_count = Column(Integer, default=0)
    congestion_score = Column(Integer, default=0)
    average_speed = Column(Float, nullable=True)

    camera = relationship("CameraModelDB", back_populates="snapshots")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "camera_id": self.camera_id,
            "timestamp": self.timestamp,
            "car_count": self.car_count,
            "truck_count": self.truck_count,
            "bus_count": self.bus_count,
            "bike_count": self.bike_count,
            "total_count": self.total_count,
            "congestion_score": self.congestion_score,
            "average_speed": self.average_speed
        }


class TrafficEventModel(Base):
    """Records significant traffic anomalies, line crossings, or congestion spikes."""
    __tablename__ = "traffic_events"

    id = Column(Integer, primary_key=True, index=True)
    junction_id = Column(String, nullable=False, index=True)
    camera_id = Column(String, nullable=False, index=True)
    event_type = Column(String, nullable=False)  # "CONGESTION_SPIKE" | "INCIDENT" | "LINE_CROSSING"
    severity = Column(String, nullable=False, default="LOW")  # "LOW" | "MEDIUM" | "HIGH"
    timestamp = Column(String, nullable=False, index=True, default=lambda: datetime.now(timezone.utc).isoformat())
    description = Column(Text, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "junction_id": self.junction_id,
            "camera_id": self.camera_id,
            "event_type": self.event_type,
            "severity": self.severity,
            "timestamp": self.timestamp,
            "description": self.description
        }


class RouteRequestModel(Base):
    """Records origin-destination route requests for analytics and auditing."""
    __tablename__ = "route_requests"

    id = Column(Integer, primary_key=True, index=True)
    junction_id = Column(String, nullable=True)
    source = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    timestamp = Column(String, nullable=False, index=True, default=lambda: datetime.now(timezone.utc).isoformat())

    results = relationship("RouteResultModel", back_populates="request", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "junction_id": self.junction_id,
            "source": self.source,
            "destination": self.destination,
            "timestamp": self.timestamp
        }


class RouteResultModel(Base):
    """Records computed routes and costs."""
    __tablename__ = "route_results"

    id = Column(Integer, primary_key=True, index=True)
    route_request_id = Column(Integer, ForeignKey("route_requests.id"), nullable=False)
    method = Column(String, nullable=False, default="A*")
    route_cost = Column(Float, nullable=False)
    congestion = Column(Float, nullable=False, default=0.0)
    route_data = Column(Text, nullable=True)
    timestamp = Column(String, nullable=False, index=True, default=lambda: datetime.now(timezone.utc).isoformat())

    request = relationship("RouteRequestModel", back_populates="results")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "route_request_id": self.route_request_id,
            "method": self.method,
            "route_cost": self.route_cost,
            "congestion": self.congestion,
            "route_data": self.route_data,
            "timestamp": self.timestamp
        }


# ──────────────────────────────────────────────────────────────────────────────
# Database Initialization & Demo Seeding
# ──────────────────────────────────────────────────────────────────────────────

def init_db():
    """Create tables and seed database with Sankagiri Junction & 4 cameras."""
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        junc = db.query(JunctionModel).filter(JunctionModel.junction_id == "JUNC_SANKAGIRI_01").first()
        if not junc:
            print("[Database] Seeding default Sankagiri Junction & 4 cameras...")
            junc = JunctionModel(
                junction_id="JUNC_SANKAGIRI_01",
                name="Sankagiri Junction",
                district="Salem",
                state="Tamil Nadu",
                latitude=11.4800,
                longitude=77.8700
            )
            db.add(junc)
            db.commit()

            demo_cams = [
                {
                    "camera_code": "CCTV-SKG-01",
                    "junction_id": "JUNC_SANKAGIRI_01",
                    "name": "North Approach",
                    "approach": "North Approach",
                    "road_name": "NH544 Salem Inflow",
                    "source_type": "video",
                    "source_url": str(VIDEO_DIR / "Traffic.mp4"),
                    "latitude": 11.4920,
                    "longitude": 77.8700,
                    "status": "OFFLINE"
                },
                {
                    "camera_code": "CCTV-SKG-02",
                    "junction_id": "JUNC_SANKAGIRI_01",
                    "name": "South Approach",
                    "approach": "South Approach",
                    "road_name": "Erode Toll Inflow",
                    "source_type": "video",
                    "source_url": str(VIDEO_DIR / "Traffic2.mp4"),
                    "latitude": 11.4680,
                    "longitude": 77.8700,
                    "status": "OFFLINE"
                },
                {
                    "camera_code": "CCTV-SKG-03",
                    "junction_id": "JUNC_SANKAGIRI_01",
                    "name": "East Approach",
                    "approach": "East Approach",
                    "road_name": "Namakkal Link",
                    "source_type": "webcam",
                    "source_url": "0",
                    "latitude": 11.4800,
                    "longitude": 77.8850,
                    "status": "OFFLINE"
                },
                {
                    "camera_code": "CCTV-SKG-04",
                    "junction_id": "JUNC_SANKAGIRI_01",
                    "name": "West Approach",
                    "approach": "West Approach",
                    "road_name": "Karur Bypass",
                    "source_type": "webcam",
                    "source_url": "1",
                    "latitude": 11.4800,
                    "longitude": 77.8550,
                    "status": "OFFLINE"
                }
            ]

            for c_data in demo_cams:
                cam = CameraModelDB(**c_data)
                db.add(cam)

            db.commit()
            print("[Database] Sankagiri Junction and 4 cameras seeded successfully.")
    except Exception as e:
        print(f"[Database] Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()


def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
