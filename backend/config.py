"""
config.py — Global Configuration
=================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Central configuration registry for Tamil Nadu locations, camera setups,
and system-wide constants.
"""

from pathlib import Path

# ──────────────────────────────────────────────────────────────────────────────
# Path Constants
# ──────────────────────────────────────────────────────────────────────────────

ROOT_DIR    = Path(__file__).parent.parent
DATASET_DIR = ROOT_DIR / "datasets"
VIDEO_DIR   = DATASET_DIR / "videos"
MODEL_DIR   = Path(__file__).parent / "models"

# ──────────────────────────────────────────────────────────────────────────────
# Tamil Nadu Location Registry
# (lat, lon) — used for route planning via A* on OSM graph
# ──────────────────────────────────────────────────────────────────────────────

LOCATIONS: dict = {
    # Major Bus Stands / Terminals
    "Salem Bus Stand":        (11.6643, 78.1460),
    "Erode Bus Stand":        (11.3410, 77.7172),
    "Namakkal Bus Stand":     (11.2189, 78.1668),
    "Karur Bus Stand":        (10.9601, 78.0766),
    "Coimbatore Bus Stand":   (11.0168, 76.9558),
    "Tiruppur Bus Stand":     (11.1085, 77.3411),
    "Dharmapuri Bus Stand":   (12.1277, 78.1584),
    "Trichy Bus Stand":       (10.7905, 78.7047),

    # Junctions / Signals / Highways
    "Salem Junction":         (11.6686, 78.1440),
    "Erode Toll":             (11.3400, 77.7100),
    "Namakkal Signal":        (11.2200, 78.1680),
    "Karur Bypass":           (10.9550, 78.0800),
    "NH544 Salem Bypass":     (11.6720, 78.1200),
    "Tiruchengode Junction":  (11.3850, 77.8950),
    "Rasipuram Junction":     (11.4580, 78.1670),

    # Cities
    "Salem":       (11.6643, 78.1460),
    "Erode":       (11.3410, 77.7172),
    "Namakkal":    (11.2189, 78.1668),
    "Karur":       (10.9601, 78.0766),
    "Coimbatore":  (11.0168, 76.9558),
    "Tiruppur":    (11.1085, 77.3411),
    "Dharmapuri":  (12.1277, 78.1584),
    "Bangalore":   (12.9716, 77.5946),
    "Chennai":     (13.0827, 80.2707),
    "Trichy":      (10.7905, 78.7047),
    "Ooty":        (11.4102, 76.6950),
    "Mettur":      (11.7872, 77.8010),
    "Gobichettipalayam": (11.4537, 77.4357),
}

# ──────────────────────────────────────────────────────────────────────────────
# Camera Configuration
# Maps each camera ID to its CCTV location and prerecorded video source.
# In the UI these are presented as live CCTV feeds.
# ──────────────────────────────────────────────────────────────────────────────

CAMERAS: list = [
    {
        "camera_id":   "CAM001",
        "camera_name": "Salem Junction",
        "location":    "Salem, Tamil Nadu",
        "address":     "NH544, Salem Junction, Salem - 636001",
        "source_type": "video",
        "source":      str(VIDEO_DIR / "Traffic.mp4"),
        "lat":         11.6686,
        "lon":         78.1440,
        "status":      "OFFLINE",
    },
    {
        "camera_id":   "CAM002",
        "camera_name": "Erode Toll",
        "location":    "Erode, Tamil Nadu",
        "address":     "NH544 Toll Plaza, Erode - 638001",
        "source_type": "video",
        "source":      str(VIDEO_DIR / "Traffic2.mp4"),
        "lat":         11.3400,
        "lon":         77.7100,
        "status":      "OFFLINE",
    },
    {
        "camera_id":   "CAM003",
        "camera_name": "Mobile Camera",
        "location":    "Namakkal, Tamil Nadu",
        "address":     "Main Road Signal, Namakkal - 637001",
        "source_type": "ip_camera",
        "source":      "http://192.168.1.99:8080/video", # Dummy IP for OFFLINE testing
        "lat":         11.2200,
        "lon":         78.1680,
        "status":      "OFFLINE",
    },
    {
        "camera_id":   "CAM004",
        "camera_name": "Laptop Camera",
        "location":    "Karur, Tamil Nadu",
        "address":     "Bypass Road, Karur - 639001",
        "source_type": "webcam",
        "source":      0, # cv2.VideoCapture(0)
        "lat":         10.9550,
        "lon":         78.0800,
        "status":      "OFFLINE",
    },
]

# ──────────────────────────────────────────────────────────────────────────────
# Congestion Level Labels (mirrors congestion.py internal mapping)
# ──────────────────────────────────────────────────────────────────────────────

CONGESTION_LABELS: dict = {
    "FREE_FLOW": "Free Flow",
    "LIGHT":     "Light",
    "MODERATE":  "Moderate",
    "HEAVY":     "Heavy",
    "CONGESTED": "Congested",
}

CONGESTION_COLORS: dict = {
    "FREE_FLOW": "#10b981",
    "LIGHT":     "#34d399",
    "MODERATE":  "#f59e0b",
    "HEAVY":     "#f97316",
    "CONGESTED": "#ef4444",
}
