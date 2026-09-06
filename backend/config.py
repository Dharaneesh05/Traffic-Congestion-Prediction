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

    # Major Cities & Districts
    "Salem":                  (11.6643, 78.1460),
    "Erode":                  (11.3410, 77.7172),
    "Namakkal":               (11.2189, 78.1668),
    "Karur":                  (10.9601, 78.0766),
    "Coimbatore":             (11.0168, 76.9558),
    "Tiruppur":               (11.1085, 77.3411),
    "Dharmapuri":             (12.1277, 78.1584),
    "Chennai":                (13.0827, 80.2707),
    "Madurai":                (9.9252, 78.1198),
    "Trichy":                 (10.7905, 78.7047),
    "Tiruchirappalli":        (10.7905, 78.7047),
    "Tirunelveli":            (8.7139, 77.7567),
    "Kanyakumari":            (8.0883, 77.5385),
    "Nagercoil":              (8.1833, 77.4119),
    "Thanjavur":              (10.7870, 79.1378),
    "Vellore":                (12.9165, 79.1325),
    "Hosur":                  (12.7409, 77.8253),
    "Dindigul":               (10.3673, 77.9803),
    "Krishnagiri":            (12.5186, 78.2137),
    "Cuddalore":              (11.7480, 79.7714),
    "Villupuram":             (11.9401, 79.4861),
    "Kanchipuram":            (12.8342, 79.7036),
    "Tiruvannamalai":         (12.2253, 79.0747),
    "Thoothukudi":            (8.7642, 78.1348),
    "Ramanathapuram":         (9.3639, 78.8395),
    "Sivakasi":               (9.4533, 77.7979),
    "Virudhunagar":           (9.5872, 77.9514),
    "Pollachi":               (10.6609, 77.0048),
    "Nagapattinam":           (10.7672, 79.8449),
    "Puducherry":             (11.9416, 79.8083),
    "Bangalore":              (12.9716, 77.5946),
    "Ooty":                   (11.4102, 76.6950),
    "Mettur":                 (11.7872, 77.8010),
    "Gobichettipalayam":      (11.4537, 77.4357),
    "Sankagiri":              (11.4800, 77.8700),
}

# ──────────────────────────────────────────────────────────────────────────────
# Camera Configuration — 5 Simulated CCTV / IP Camera Sources (Master Spec)
# ──────────────────────────────────────────────────────────────────────────────

CAMERAS: list = [
    {
        "camera_id":     "CAM001",
        "camera_code":   "CCTV-SKG-01",
        "camera_name":   "North: NH544 Salem Inflow",
        "junction_id":   "JUNC_SANKAGIRI_01",
        "approach_id":   "APP_NORTH",
        "approach_name": "North: NH544 Salem Inflow",
        "location":      "Sankagiri North, Tamil Nadu",
        "address":       "NH544 Northern Inflow, Sankagiri - 637301",
        "source_type":   "video",
        "source":        str(VIDEO_DIR / "Traffic.mp4"),
        "source_uri":    str(VIDEO_DIR / "Traffic.mp4"),
        "source_label":  "DEMO / SIMULATED CCTV (Mobile IP 1 Fallback)",
        "lat":           11.4920,
        "lon":           77.8700,
        "status":        "OFFLINE",
    },
    {
        "camera_id":     "CAM002",
        "camera_code":   "CCTV-SKG-02",
        "camera_name":   "South: Erode Toll Inflow",
        "junction_id":   "JUNC_SANKAGIRI_01",
        "approach_id":   "APP_SOUTH",
        "approach_name": "South: Erode Toll Inflow",
        "location":      "Sankagiri South, Tamil Nadu",
        "address":       "NH544 Southern Toll Inflow, Sankagiri - 637301",
        "source_type":   "video",
        "source":        str(VIDEO_DIR / "Traffic2.mp4"),
        "source_uri":    str(VIDEO_DIR / "Traffic2.mp4"),
        "source_label":  "DEMO / SIMULATED CCTV (Mobile IP 2 Fallback)",
        "lat":           11.4680,
        "lon":           77.8700,
        "status":        "OFFLINE",
    },
    {
        "camera_id":     "CAM003",
        "camera_code":   "CCTV-SKG-03",
        "camera_name":   "East: Namakkal Link",
        "junction_id":   "JUNC_SANKAGIRI_01",
        "approach_id":   "APP_EAST",
        "approach_name": "East: Namakkal Link",
        "location":      "Sankagiri East, Tamil Nadu",
        "address":       "SH47 Namakkal Road, Sankagiri - 637301",
        "source_type":   "webcam",
        "source":        0,
        "source_uri":    "0",
        "source_label":  "LOCAL WEBCAM (Laptop Camera 1)",
        "lat":           11.4800,
        "lon":           77.8850,
        "status":        "OFFLINE",
    },
    {
        "camera_id":     "CAM004",
        "camera_code":   "CCTV-SKG-04",
        "camera_name":   "West: Karur Bypass",
        "junction_id":   "JUNC_SANKAGIRI_01",
        "approach_id":   "APP_WEST",
        "approach_name": "West: Karur Bypass",
        "location":      "Sankagiri West, Tamil Nadu",
        "address":       "Bypass Corridor, Sankagiri - 637301",
        "source_type":   "webcam",
        "source":        1,
        "source_uri":    "1",
        "source_label":  "LOCAL WEBCAM (Laptop Camera 2)",
        "lat":           11.4800,
        "lon":           77.8550,
        "status":        "OFFLINE",
    },
    {
        "camera_id":     "CAM005",
        "camera_code":   "CCTV-SKG-05",
        "camera_name":   "Transit: Outer Ring Connector",
        "junction_id":   "JUNC_SANKAGIRI_01",
        "approach_id":   "APP_BYPASS",
        "approach_name": "Transit: Outer Ring Connector",
        "location":      "Sankagiri Outer Ring, Tamil Nadu",
        "address":       "Outer Ring Connector, Sankagiri - 637301",
        "source_type":   "video",
        "source":        str(VIDEO_DIR / "Traffic.mp4"),
        "source_uri":    str(VIDEO_DIR / "Traffic.mp4"),
        "source_label":  "DEMO VIDEO (Laptop Camera 3 Fallback)",
        "lat":           11.4850,
        "lon":           77.8650,
        "status":        "OFFLINE",
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
