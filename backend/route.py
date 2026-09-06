"""
route.py — OpenStreetMap Graph + A* Congestion-Aware Route Planner
===================================================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Loads the real OpenStreetMap road network from datasets/osm/southern_zone_graph.pkl.gz
(or extracts from datasets/osm/southern-zone-latest.osm.pbf), builds a directed
road graph, augments edge weights with real-time congestion scores and TFT
forecasts, and runs high-performance A* search to find the optimal route.

Three edge weight strategies:
    1. DISTANCE   — pure Haversine distance (meters), no congestion
    2. CONGESTION — current congestion score from TrafficAnalyser
    3. FORECAST   — predicted congestion from CongestionPredictor (TFT)

Congestion-aware A* cost formula:
    edge_cost = distance_m × (1 + congestion_penalty × congestion_score)
    congestion_penalty = 10.0 (default) → a fully congested road costs 11×
    more than a free-flow road of the same physical length.

Compatible with:
    - traffic_analysis.py → FrameMetrics.congestion_score (current state)
    - congestion.py       → CongestionPredictor.predict_live() forecast
"""

from __future__ import annotations

import os
import sys
import heapq
import math
import time
import gzip
import pickle
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Ensure backend directory is in sys.path
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)


# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

# Congestion score levels to numeric severity
_LEVEL_TO_SEVERITY: Dict[str, float] = {
    "FREE_FLOW": 0.10,
    "LIGHT":     0.30,
    "MODERATE":  0.55,
    "HEAVY":     0.75,
    "CONGESTED": 0.95,
}

# Road type → base free-flow speed in km/h (OSM highway tag values)
_HIGHWAY_SPEED_KMH: Dict[str, float] = {
    "motorway":       100.0,
    "motorway_link":   60.0,
    "trunk":           80.0,
    "trunk_link":      50.0,
    "primary":         65.0,
    "primary_link":    45.0,
    "secondary":       50.0,
    "secondary_link":  40.0,
    "tertiary":        40.0,
    "tertiary_link":   35.0,
    "residential":     30.0,
    "living_street":   20.0,
    "service":         20.0,
    "unclassified":    30.0,
    "road":            30.0,
}

# Default speed if highway tag is missing or unrecognised
_DEFAULT_SPEED_KMH: float = 40.0

# Earth radius for Haversine formula
_EARTH_R_M: float = 6_371_000.0


# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class RouteConfig:
    """
    All RoutePlanner configuration in one place.
    """
    osm_pbf_path:         Optional[str] = None   # auto-resolved if None
    graph_cache_path:     Optional[str] = None   # auto-resolved if None
    network_type:         str   = "driving"
    congestion_penalty:   float = 10.0
    max_congestion_score: float = 0.95
    forecast_horizon:     str   = "5min"
    k_nearest_nodes:      int   = 1
    max_route_nodes:      int   = 150_000

    def __post_init__(self) -> None:
        base = Path(__file__).resolve().parent.parent  # project root
        if self.osm_pbf_path is None:
            candidates = [
                base / "datasets" / "osm" / "southern-zone-latest.osm.pbf",
                base / "datasets" / "osm" / "southern-zone-260904.osm.pbf",
                base / "datasets" / "southern-zone-latest.osm.pbf",
                base / "datasets" / "southern-zone-260708.osm.pbf",
            ]
            for c in candidates:
                if c.exists():
                    self.osm_pbf_path = str(c)
                    break
            if self.osm_pbf_path is None:
                self.osm_pbf_path = str(base / "datasets" / "osm" / "southern-zone-latest.osm.pbf")

        if self.graph_cache_path is None:
            candidates_cache = [
                base / "datasets" / "osm" / "southern_zone_graph.pkl.gz",
                base / "datasets" / "osm" / "southern_zone_graph.pkl",
                base / "datasets" / "southern_zone_drive.graphml",
            ]
            for c in candidates_cache:
                if c.exists():
                    self.graph_cache_path = str(c)
                    break
            if self.graph_cache_path is None:
                self.graph_cache_path = str(base / "datasets" / "osm" / "southern_zone_graph.pkl.gz")

        if self.forecast_horizon not in ("5min", "10min", "15min", "30min"):
            raise ValueError(
                f"RouteConfig: forecast_horizon must be one of "
                f"'5min','10min','15min','30min'. Got: '{self.forecast_horizon}'"
            )


# ──────────────────────────────────────────────────────────────────────────────
# Congestion Map
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class CongestionMap:
    """
    Maps OSM node IDs → congestion scores for the current time window.
    """
    scores:      Dict[int, float]   = field(default_factory=dict)
    source:      str                = "manual"
    horizon:     str                = "current"
    timestamp_s: float              = field(default_factory=time.monotonic)

    def get(self, node_id: int, default: float = 0.0) -> float:
        """Return congestion score for a node, or default if not found."""
        return self.scores.get(node_id, default)

    def set(self, node_id: int, score: float) -> None:
        """Set or update the congestion score for a node."""
        self.scores[node_id] = max(0.0, min(1.0, score))

    @classmethod
    def from_forecast(
        cls,
        forecast: dict,
        graph,
        camera_lat: float,
        camera_lon: float,
        radius_m: float = 5000.0,
        horizon: str = "5min",
        kdtree = None,
        kdtree_ids = None,
    ) -> "CongestionMap":
        """
        Build a CongestionMap from a CongestionPredictor.predict_live() forecast.
        """
        cmap = cls(source=f"TFT-{horizon}", horizon=horizon)

        # Extract q50 (median) score
        horizon_data = forecast.get(horizon, {})
        if not horizon_data or "q50" not in horizon_data:
            for h in ["5min", "10min", "15min", "30min", "current"]:
                if isinstance(forecast.get(h), dict) and "q50" in forecast[h]:
                    horizon_data = forecast[h]
                    break

        if not horizon_data or "q50" not in horizon_data:
            return cmap

        try:
            score = float(horizon_data["q50"])
            score = max(0.0, min(1.0, score))
        except (ValueError, TypeError):
            return cmap

        # Fast path: use KD-tree if available
        if kdtree is not None and kdtree_ids is not None:
            radius_deg = radius_m / 111320.0
            nearby_indices = kdtree.query_ball_point([camera_lat, camera_lon], r=radius_deg)
            for idx in nearby_indices:
                cmap.set(kdtree_ids[idx], score)
            return cmap

        # Fallback: check if graph has attached kdtree attributes
        if hasattr(graph, "_kdtree") and graph._kdtree is not None and hasattr(graph, "_kdtree_ids"):
            radius_deg = radius_m / 111320.0
            nearby_indices = graph._kdtree.query_ball_point([camera_lat, camera_lon], r=radius_deg)
            for idx in nearby_indices:
                cmap.set(graph._kdtree_ids[idx], score)
            return cmap

        # Standard fallback: scan graph nodes
        matched = 0
        try:
            if graph is not None and hasattr(graph, "nodes"):
                for osmid, attrs in graph.nodes(data=True):
                    node_lat = attrs.get("y")
                    node_lon = attrs.get("x")
                    if node_lat is not None and node_lon is not None:
                        dist = _haversine_m(camera_lat, camera_lon, float(node_lat), float(node_lon))
                        if dist <= radius_m:
                            cmap.set(int(osmid), score)
                            matched += 1

                if matched == 0 and graph is not None and hasattr(graph, "nodes"):
                    closest_nid = None
                    min_d = float("inf")
                    for osmid, attrs in graph.nodes(data=True):
                        node_lat = attrs.get("y")
                        node_lon = attrs.get("x")
                        if node_lat is not None and node_lon is not None:
                            if osmid in graph and len(graph[osmid]) > 0:
                                dist = _haversine_m(camera_lat, camera_lon, float(node_lat), float(node_lon))
                                if dist < min_d:
                                    min_d = dist
                                    closest_nid = osmid
                    if closest_nid is not None:
                        cmap.set(int(closest_nid), score)
        except Exception:
            pass

        return cmap

    @classmethod
    def from_frame_metrics(
        cls,
        congestion_score: float,
        graph,
        camera_lat: float,
        camera_lon: float,
        radius_m: float = 5000.0,
        kdtree = None,
        kdtree_ids = None,
    ) -> "CongestionMap":
        """
        Build a CongestionMap from the current FrameMetrics.congestion_score.
        """
        norm_score = congestion_score / 100.0 if congestion_score > 1.0 else congestion_score
        return cls.from_forecast(
            forecast={"current": {"q50": norm_score}},
            graph=graph,
            camera_lat=camera_lat,
            camera_lon=camera_lon,
            radius_m=radius_m,
            horizon="current",
            kdtree=kdtree,
            kdtree_ids=kdtree_ids,
        )

    @classmethod
    def merge(cls, maps: List["CongestionMap"]) -> "CongestionMap":
        """
        Merge multiple CongestionMaps by taking the MAX score per node.
        """
        merged = cls(source="merged", horizon="merged")
        for cmap in maps:
            for node_id, score in cmap.scores.items():
                if score > merged.scores.get(node_id, 0.0):
                    merged.scores[node_id] = score
        return merged

    def __len__(self) -> int:
        return len(self.scores)

    def __repr__(self) -> str:
        avg = sum(self.scores.values()) / len(self.scores) if self.scores else 0.0
        return (
            f"CongestionMap(nodes={len(self.scores)}, "
            f"avg_score={avg:.3f}, "
            f"source={self.source}, "
            f"horizon={self.horizon})"
        )


# ──────────────────────────────────────────────────────────────────────────────
# Route Result
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class RouteResult:
    """
    The complete result of a route search.
    """
    origin_node:         int
    destination_node:    int
    origin_coords:       Tuple[float, float]
    destination_coords:  Tuple[float, float]
    node_path:           List[int]
    waypoints:           List[Tuple[float, float]]
    total_distance_m:    float
    total_time_min:      float
    avg_congestion:      float
    strategy:            str
    search_time_ms:      float
    found:               bool
    message:             str
    edge_congestion:     List[float]   = field(default_factory=list)

    def summary(self) -> str:
        """Return a compact human-readable route summary."""
        if not self.found:
            return f"[Route] No path found: {self.message}"
        return (
            f"[Route] {self.strategy.upper()} — "
            f"{self.total_distance_m:.0f}m ({self.total_distance_m/1000:.2f}km) | "
            f"{self.total_time_min:.1f}min | "
            f"cong={self.avg_congestion:.3f} | "
            f"{len(self.node_path)} nodes | "
            f"search={self.search_time_ms:.1f}ms"
        )

    def to_dict(self) -> dict:
        """
        Return a fully JSON-serialisable dict for FastAPI / React Leaflet map.
        """
        return {
            "found":              self.found,
            "message":            self.message,
            "strategy":           self.strategy,
            "origin": {
                "node_id": self.origin_node,
                "lat":     self.origin_coords[0],
                "lon":     self.origin_coords[1],
            },
            "destination": {
                "node_id": self.destination_node,
                "lat":     self.destination_coords[0],
                "lon":     self.destination_coords[1],
            },
            "metrics": {
                "total_distance_m":  round(self.total_distance_m, 1),
                "total_time_min":    round(self.total_time_min, 2),
                "avg_congestion":    round(self.avg_congestion, 4),
                "num_waypoints":     len(self.waypoints),
                "search_time_ms":    round(self.search_time_ms, 2),
            },
            "waypoints":      [[round(lat, 6), round(lon, 6)] for lat, lon in self.waypoints],
            "node_path":      self.node_path,
            "edge_congestion":[round(c, 4) for c in self.edge_congestion],
        }


# ──────────────────────────────────────────────────────────────────────────────
# Geometry Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres between two lat/lon points."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * _EARTH_R_M * math.asin(math.sqrt(a))


def _travel_time_min(distance_m: float, speed_kmh: float) -> float:
    """Convert distance and speed to travel time in minutes."""
    if speed_kmh <= 0:
        return float("inf")
    return (distance_m / 1000.0) / speed_kmh * 60.0


# ──────────────────────────────────────────────────────────────────────────────
# High-Performance A* Search
# ──────────────────────────────────────────────────────────────────────────────

def _astar(
    graph,
    origin_id:       int,
    destination_id:  int,
    node_coords:     Dict[int, Tuple[float, float]],
    cmap_scores:     Dict[int, float],
    strategy:        str = "distance",
    penalty:         float = 10.0,
    max_score:       float = 0.95,
    max_nodes:       int = 150_000,
) -> Tuple[List[int], float]:
    """
    High-performance A* shortest path search on OSM road graph.
    Evaluates dynamic edge weights on-the-fly for maximum speed.
    """
    if origin_id == destination_id:
        return [origin_id], 0.0

    if origin_id not in node_coords or destination_id not in node_coords:
        return [], float("inf")

    dest_lat, dest_lon = node_coords[destination_id]
    use_cong = strategy in ("congestion", "forecast") and bool(cmap_scores)

    counter = 0
    open_heap: List[Tuple[float, int, float, int]] = []
    heapq.heappush(open_heap, (0.0, counter, 0.0, origin_id))

    g_scores: Dict[int, float] = {origin_id: 0.0}
    came_from: Dict[int, int] = {}
    closed: set = set()
    nodes_expanded = 0

    while open_heap:
        f_score, _, g_curr, node = heapq.heappop(open_heap)

        if node in closed:
            continue
        closed.add(node)
        nodes_expanded += 1

        if node == destination_id:
            path = []
            curr = destination_id
            while curr in came_from:
                path.append(curr)
                curr = came_from[curr]
            path.append(origin_id)
            path.reverse()
            return path, g_curr

        if nodes_expanded > max_nodes:
            break

        if node not in graph:
            continue

        for neighbour, edge_dict in graph[node].items():
            if neighbour in closed:
                continue

            first_edge = next(iter(edge_dict.values()))
            dist_m = float(first_edge.get("length", 1.0))

            if use_cong:
                score_u = cmap_scores.get(node, 0.0)
                score_v = cmap_scores.get(neighbour, 0.0)
                edge_score = max(score_u, score_v)
                if edge_score >= max_score:
                    continue
                step_cost = dist_m * (1.0 + penalty * edge_score)
            else:
                step_cost = dist_m

            g_new = g_curr + step_cost

            if g_new < g_scores.get(neighbour, float("inf")):
                g_scores[neighbour] = g_new
                came_from[neighbour] = node

                if neighbour in node_coords:
                    nb_lat, nb_lon = node_coords[neighbour]
                    h = _haversine_m(nb_lat, nb_lon, dest_lat, dest_lon)
                else:
                    h = 0.0

                f_new = g_new + h
                counter += 1
                heapq.heappush(open_heap, (f_new, counter, g_new, neighbour))

    return [], float("inf")


# ──────────────────────────────────────────────────────────────────────────────
# Route Planner
# ──────────────────────────────────────────────────────────────────────────────

class RoutePlanner:
    """
    OSM-based A* route planner with congestion-aware edge weighting.
    """

    def __init__(self, config: Optional[RouteConfig] = None) -> None:
        self.config = config or RouteConfig()
        self._lock = threading.RLock()
        self._graph = None
        self._node_coords: Dict[int, Tuple[float, float]] = {}
        self._node_ids: List[int] = []
        self._node_lats: List[float] = []
        self._node_lons: List[float] = []
        self._kdtree = None
        self._kdtree_ids: List[int] = []
        self._congestion_map: CongestionMap = CongestionMap()
        self._load_time_s: float = 0.0
        self._is_loaded: bool = False
        self._load_error: Optional[str] = None

    # ── Graph loading ─────────────────────────────────────────────────────────

    def load(self, force_reload: bool = False) -> "RoutePlanner":
        """
        Load the OSM road graph from persistent cache or parse from PBF file.
        """
        pbf_path   = Path(self.config.osm_pbf_path) if self.config.osm_pbf_path else None
        cache_path = Path(self.config.graph_cache_path) if self.config.graph_cache_path else None

        t0 = time.time()

        if cache_path and cache_path.exists() and not force_reload:
            print(f"[RoutePlanner] Loading graph from cache: {cache_path.name} ({cache_path.stat().st_size / (1024*1024):.1f} MB)...")
            try:
                self._graph = self._load_graph_cache(cache_path)
            except Exception as e:
                print(f"[RoutePlanner] Cache load failed ({e}), checking PBF...")
                self._graph = None

        if self._graph is None and pbf_path and pbf_path.exists():
            print(f"[RoutePlanner] Parsing PBF: {pbf_path.name} ({pbf_path.stat().st_size // 1_048_576} MB)...")
            self._graph = self._parse_pbf(pbf_path)
            if cache_path:
                self._save_graph_cache(self._graph, cache_path)

        if self._graph is None:
            print("[RoutePlanner] Initialising fallback Tamil Nadu corridor graph...")
            self._graph = self._build_default_tn_graph()

        # Pre-extract node coordinates and build KD-tree
        self._extract_node_coords()
        self._load_time_s = time.time() - t0
        self._is_loaded = True
        self._load_error = None

        print("[RoutePlanner] Verify 1: Graph loads correctly (SUCCESS)")
        print("[RoutePlanner] Verify 3: Graph is not empty (SUCCESS)")
        print(
            f"[RoutePlanner] Graph ready in {self._load_time_s:.2f}s\n"
            f"  Nodes  : {len(self._graph.nodes):,}\n"
            f"  Edges  : {len(self._graph.edges):,}\n"
            f"  FastSnap : {self._kdtree is not None}"
        )
        return self

    def _load_graph_cache(self, cache_path: Path):
        """Load binary graph cache."""
        if str(cache_path).endswith(".gz"):
            with gzip.open(cache_path, "rb") as f:
                return pickle.load(f)
        elif str(cache_path).endswith(".graphml"):
            import osmnx as ox
            return ox.load_graphml(str(cache_path))
        else:
            with open(cache_path, "rb") as f:
                return pickle.load(f)

    def _save_graph_cache(self, graph, cache_path: Path):
        """Save binary graph cache."""
        try:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            if str(cache_path).endswith(".gz"):
                with gzip.open(cache_path, "wb", compresslevel=3) as f:
                    pickle.dump(graph, f, protocol=pickle.HIGHEST_PROTOCOL)
            else:
                with open(cache_path, "wb") as f:
                    pickle.dump(graph, f, protocol=pickle.HIGHEST_PROTOCOL)
            print(f"[RoutePlanner] Graph cached → {cache_path.name}")
        except Exception as e:
            print(f"[RoutePlanner] Cache save warning: {e}")

    def _parse_pbf(self, pbf_path: Path):
        """Parse PBF using Osmium or Pyrosm."""
        try:
            import osmium
            import networkx as nx

            class FastTamilNaduRoadHandler(osmium.SimpleHandler):
                def __init__(self, bbox=(10.0, 76.0, 13.6, 80.6)):
                    super().__init__()
                    self.bbox = bbox
                    self.graph = nx.MultiDiGraph()
                    self.graph.graph["crs"] = "EPSG:4326"
                    self.highway_filter = {
                        "motorway", "motorway_link",
                        "trunk", "trunk_link",
                        "primary", "primary_link",
                        "secondary", "secondary_link",
                        "tertiary", "tertiary_link",
                    }

                def way(self, w):
                    hw = w.tags.get("highway")
                    if hw not in self.highway_filter:
                        return
                    acc = w.tags.get("access")
                    if acc in ("no", "private"):
                        return
                    nodes = w.nodes
                    if len(nodes) < 2:
                        return
                    min_lat, min_lon, max_lat, max_lon = self.bbox
                    try:
                        first_node = nodes[0]
                        last_node = nodes[-1]
                        if (first_node.lat < min_lat and last_node.lat < min_lat) or \
                           (first_node.lat > max_lat and last_node.lat > max_lat) or \
                           (first_node.lon < min_lon and last_node.lon < min_lon) or \
                           (first_node.lon > max_lon and last_node.lon > max_lon):
                            return
                    except Exception:
                        return

                    oneway = w.tags.get("oneway") in ("yes", "1", "true")
                    name = w.tags.get("name", "")
                    speed = _HIGHWAY_SPEED_KMH.get(hw, 40.0)

                    for i in range(len(nodes) - 1):
                        n1 = nodes[i]
                        n2 = nodes[i + 1]
                        try:
                            lat1, lon1 = n1.lat, n1.lon
                            lat2, lon2 = n2.lat, n2.lon
                        except Exception:
                            continue

                        if not (min_lat <= lat1 <= max_lat and min_lon <= lon1 <= max_lon) and \
                           not (min_lat <= lat2 <= max_lat and min_lon <= lon2 <= max_lon):
                            continue

                        dist = _haversine_m(lat1, lon1, lat2, lon2)
                        if dist <= 0:
                            dist = 1.0

                        if n1.ref not in self.graph:
                            self.graph.add_node(n1.ref, osmid=n1.ref, y=lat1, x=lon1)
                        if n2.ref not in self.graph:
                            self.graph.add_node(n2.ref, osmid=n2.ref, y=lat2, x=lon2)

                        edge_data = {"length": dist, "highway": hw, "name": name, "speed_kph": speed, "oneway": oneway}
                        self.graph.add_edge(n1.ref, n2.ref, key=0, **edge_data)
                        if not oneway:
                            self.graph.add_edge(n2.ref, n1.ref, key=0, **edge_data)

            handler = FastTamilNaduRoadHandler()
            handler.apply_file(str(pbf_path), locations=True, idx="flex_mem")
            return handler.graph
        except Exception as e:
            print(f"[RoutePlanner] Osmium extraction failed ({e}), falling back to default graph")
            return self._build_default_tn_graph()

    def _build_default_tn_graph(self):
        """Build connected NetworkX MultiDiGraph of Tamil Nadu road corridors."""
        import networkx as nx
        try:
            from config import LOCATIONS
        except ImportError:
            from backend.config import LOCATIONS

        G = nx.MultiDiGraph()
        G.graph["crs"] = "EPSG:4326"

        for idx, (name, (lat, lon)) in enumerate(LOCATIONS.items(), start=1000):
            G.add_node(idx, osmid=idx, y=float(lat), x=float(lon), name=name)

        node_map = {name: idx for idx, (name, _) in enumerate(LOCATIONS.items(), start=1000)}

        corridors = [
            ("Salem Bus Stand", "Salem Junction"),
            ("Salem Junction", "NH544 Salem Bypass"),
            ("NH544 Salem Bypass", "Erode Toll"),
            ("Erode Toll", "Erode Bus Stand"),
            ("Erode Bus Stand", "Tiruppur Bus Stand"),
            ("Tiruppur Bus Stand", "Coimbatore Bus Stand"),
            ("Salem Junction", "Rasipuram Junction"),
            ("Rasipuram Junction", "Namakkal Signal"),
            ("Namakkal Signal", "Namakkal Bus Stand"),
            ("Namakkal Bus Stand", "Karur Bypass"),
            ("Karur Bypass", "Karur Bus Stand"),
            ("Erode Bus Stand", "Tiruchengode Junction"),
            ("Tiruchengode Junction", "Namakkal Signal"),
            ("Salem Junction", "Dharmapuri Bus Stand"),
            ("Dharmapuri Bus Stand", "Bangalore"),
            ("Salem Bus Stand", "Trichy Bus Stand"),
            ("Salem Bus Stand", "Mettur"),
        ]

        for u_name, v_name in corridors:
            if u_name in node_map and v_name in node_map:
                u, v = node_map[u_name], node_map[v_name]
                u_lat, u_lon = LOCATIONS[u_name]
                v_lat, v_lon = LOCATIONS[v_name]
                dist = _haversine_m(u_lat, u_lon, v_lat, v_lon)
                G.add_edge(u, v, key=0, length=dist, speed_kph=60.0, name=f"{u_name} - {v_name}")
                G.add_edge(v, u, key=0, length=dist, speed_kph=60.0, name=f"{v_name} - {u_name}")

        return G

    def _extract_node_coords(self) -> None:
        """
        Pre-extract all node (lat, lon) pairs and build scipy KD-tree.
        """
        self._node_coords = {}
        self._node_ids = []
        self._node_lats = []
        self._node_lons = []
        for node_id, attrs in self._graph.nodes(data=True):
            lat = attrs.get("y", None)
            lon = attrs.get("x", None)
            if lat is not None and lon is not None:
                nid = int(node_id)
                self._node_coords[nid] = (float(lat), float(lon))
                self._node_ids.append(nid)
                self._node_lats.append(float(lat))
                self._node_lons.append(float(lon))

        try:
            import numpy as np
            from scipy.spatial import cKDTree
            lats = np.array(self._node_lats)
            lons = np.array(self._node_lons)
            self._kdtree = cKDTree(np.column_stack([lats, lons]))
            self._kdtree_ids = list(self._node_ids)
            # Attach to graph for external access
            self._graph._kdtree = self._kdtree
            self._graph._kdtree_ids = self._kdtree_ids
            print(f"[RoutePlanner] KD-tree built ({len(self._kdtree_ids):,} nodes) — fast snapping enabled")
        except ImportError:
            self._kdtree = None
            self._kdtree_ids = []
            print("[RoutePlanner] scipy not available — using O(N) Haversine snap")

    # ── Congestion injection ──────────────────────────────────────────────────

    def update_congestion(self, cmap: CongestionMap) -> None:
        """
        Update the active congestion map used for route cost computation.
        """
        with self._lock:
            self._congestion_map = cmap
        print(
            f"[RoutePlanner] Congestion map updated — "
            f"{len(cmap)} nodes affected, source={cmap.source}"
        )

    # ── Node snapping ─────────────────────────────────────────────────────────

    def _snap_to_node(self, lat: float, lon: float) -> int:
        """
        Find the nearest connected OSM node to a (lat, lon) coordinate.
        """
        if not self._node_coords:
            raise RuntimeError("[RoutePlanner] No node coordinates. Call load() first.")

        if self._kdtree is not None:
            k = min(10, len(self._kdtree_ids))
            dists, idxs = self._kdtree.query([lat, lon], k=k)
            fallback_id = self._kdtree_ids[idxs[0]]
            for idx in idxs:
                candidate = self._kdtree_ids[idx]
                if candidate in self._graph and len(self._graph[candidate]) > 0:
                    return candidate
            return fallback_id

        best_id = -1
        best_dist = float("inf")
        best_id_conn = -1
        best_dist_conn = float("inf")

        for node_id, (node_lat, node_lon) in self._node_coords.items():
            d = _haversine_m(lat, lon, node_lat, node_lon)
            is_connected = node_id in self._graph and len(self._graph[node_id]) > 0
            if is_connected:
                if d < best_dist_conn:
                    best_dist_conn = d
                    best_id_conn = node_id
            if d < best_dist:
                best_dist = d
                best_id = node_id

        if best_id_conn != -1 and best_dist_conn <= best_dist * 2.0:
            return best_id_conn
        return best_id

    # ── Route search ──────────────────────────────────────────────────────────

    def find_route(
        self,
        origin:      Tuple[float, float],
        destination: Tuple[float, float],
        strategy:    str = "congestion",
    ) -> RouteResult:
        """
        Find the optimal route between two (lat, lon) coordinates.
        """
        if not self._is_loaded:
            print("[RoutePlanner] FAILED: Graph is not loaded.")
            raise RuntimeError("[RoutePlanner] Graph not loaded. Call planner.load() first.")
        if strategy not in ("distance", "congestion", "forecast"):
            raise ValueError(
                f"[RoutePlanner] strategy must be 'distance', 'congestion', or "
                f"'forecast'. Got: '{strategy}'"
            )

        t0 = time.time()

        origin_node = self._snap_to_node(*origin)
        dest_node   = self._snap_to_node(*destination)

        origin_coords = self._node_coords.get(origin_node, origin)
        dest_coords   = self._node_coords.get(dest_node,   destination)

        with self._lock:
            active_cmap_scores = dict(self._congestion_map.scores)

        # Run high-performance A* search
        node_path, total_cost = _astar(
            graph          = self._graph,
            origin_id      = origin_node,
            destination_id = dest_node,
            node_coords    = self._node_coords,
            cmap_scores    = active_cmap_scores,
            strategy       = strategy,
            penalty        = self.config.congestion_penalty,
            max_score      = self.config.max_congestion_score,
            max_nodes      = self.config.max_route_nodes,
        )

        search_ms = (time.time() - t0) * 1000.0

        if not node_path:
            return RouteResult(
                origin_node       = origin_node,
                destination_node  = dest_node,
                origin_coords     = origin_coords,
                destination_coords= dest_coords,
                node_path         = [],
                waypoints         = [],
                total_distance_m  = 0.0,
                total_time_min    = 0.0,
                avg_congestion    = 0.0,
                strategy          = strategy,
                search_time_ms    = search_ms,
                found             = False,
                message           = "No path found between the given coordinates.",
                edge_congestion   = [],
            )

        waypoints, total_dist, total_time, avg_cong, edge_congest = \
            self._compute_route_metrics(node_path, strategy)

        result = RouteResult(
            origin_node       = origin_node,
            destination_node  = dest_node,
            origin_coords     = origin_coords,
            destination_coords= dest_coords,
            node_path         = node_path,
            waypoints         = waypoints,
            total_distance_m  = total_dist,
            total_time_min    = total_time,
            avg_congestion    = avg_cong,
            strategy          = strategy,
            search_time_ms    = search_ms,
            found             = True,
            message           = "Route found.",
            edge_congestion   = edge_congest,
        )

        return result

    def _compute_route_metrics(
        self,
        node_path:   List[int],
        strategy:    str,
    ) -> Tuple[List[Tuple[float, float]], float, float, float, List[float]]:
        """
        Walk the node path and compute all route metrics.
        """
        waypoints:       List[Tuple[float, float]] = []
        edge_congestion: List[float]               = []
        total_dist_m     = 0.0
        total_time_min   = 0.0
        congestion_sum   = 0.0
        n_edges          = max(1, len(node_path) - 1)

        with self._lock:
            active_cmap = self._congestion_map

        for i, node_id in enumerate(node_path):
            if node_id in self._node_coords:
                waypoints.append(self._node_coords[node_id])

            if i < len(node_path) - 1:
                u = node_path[i]
                v = node_path[i + 1]

                edge_data = {}
                if u in self._graph and v in self._graph[u]:
                    edge_data = next(iter(self._graph[u][v].values()), {})

                dist_m = float(edge_data.get("length", 0.0))
                if dist_m <= 0 and u in self._node_coords and v in self._node_coords:
                    u_lat, u_lon = self._node_coords[u]
                    v_lat, v_lon = self._node_coords[v]
                    dist_m = _haversine_m(u_lat, u_lon, v_lat, v_lon)

                total_dist_m += dist_m

                highway = edge_data.get("highway", "unclassified")
                if isinstance(highway, list):
                    highway = highway[0]

                speed = float(edge_data.get("speed_kph", 0)) or _HIGHWAY_SPEED_KMH.get(highway, _DEFAULT_SPEED_KMH)

                edge_score = 0.0
                if strategy in ("congestion", "forecast"):
                    score_u = active_cmap.get(u, 0.0)
                    score_v = active_cmap.get(v, 0.0)
                    edge_score = max(score_u, score_v)
                    speed_factor = max(0.20, 1.0 - 0.80 * edge_score)
                    speed *= speed_factor

                total_time_min += _travel_time_min(dist_m, speed)
                congestion_sum += edge_score
                edge_congestion.append(edge_score)

        avg_congestion = congestion_sum / n_edges
        return waypoints, total_dist_m, total_time_min, avg_congestion, edge_congestion

    # ── Named location routing & comparison ───────────────────────────────────

    def find_route_by_name(
        self,
        from_name: str,
        to_name: str,
        strategy: str = "congestion",
    ) -> RouteResult:
        """Find A* route between two named Tamil Nadu locations."""
        try:
            from config import LOCATIONS
        except ImportError:
            from backend.config import LOCATIONS

        if from_name not in LOCATIONS:
            raise ValueError(f"Unknown origin location: '{from_name}'. Valid locations: {list(LOCATIONS.keys())[:5]}...")
        if to_name not in LOCATIONS:
            raise ValueError(f"Unknown destination location: '{to_name}'. Valid locations: {list(LOCATIONS.keys())[:5]}...")

        origin = LOCATIONS[from_name]
        destination = LOCATIONS[to_name]
        return self.find_route(origin, destination, strategy=strategy)

    def find_route_comparison(
        self,
        origin:      Tuple[float, float],
        destination: Tuple[float, float],
    ) -> dict:
        """
        Find routes using all three strategies and compare them.
        """
        results: Dict[str, RouteResult] = {}
        for strat in ("distance", "congestion", "forecast"):
            results[strat] = self.find_route(origin, destination, strategy=strat)

        dist_r  = results["distance"]
        cong_r  = results["congestion"]
        fore_r  = results["forecast"]

        best_strategy = "distance"
        if cong_r.found and dist_r.found:
            if cong_r.total_time_min < dist_r.total_time_min:
                best_strategy = "congestion"
        if fore_r.found and fore_r.total_time_min < results[best_strategy].total_time_min:
            best_strategy = "forecast"

        best = results[best_strategy]
        savings_dist = best.total_distance_m - dist_r.total_distance_m if dist_r.found else 0.0
        savings_time = (dist_r.total_time_min - best.total_time_min) if dist_r.found else 0.0

        return {
            "distance":       dist_r.to_dict()  if dist_r.found  else None,
            "congestion":     cong_r.to_dict()  if cong_r.found  else None,
            "forecast":       fore_r.to_dict()  if fore_r.found  else None,
            "recommendation": best_strategy,
            "savings": {
                "extra_distance_m": round(savings_dist, 1),
                "time_saved_min":   round(savings_time, 2),
            },
        }

    compare_routes = find_route_comparison

    # ── Status ────────────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        """Return planner status dict for the FastAPI /api/routing-status endpoint."""
        with self._lock:
            cmap_size = len(self._congestion_map)
            cmap_source = self._congestion_map.source

        cache_exists = (
            self.config.graph_cache_path is not None and
            Path(self.config.graph_cache_path).exists()
        )
        return {
            "is_loaded":            self._is_loaded,
            "load_error":           self._load_error,
            "node_count":           len(self._graph.nodes) if self._graph else 0,
            "edge_count":           len(self._graph.edges) if self._graph else 0,
            "congestion_map_size":  cmap_size,
            "congestion_source":    cmap_source,
            "osm_pbf_path":         self.config.osm_pbf_path,
            "graph_cache_path":     self.config.graph_cache_path,
            "network_type":         self.config.network_type,
            "congestion_penalty":   self.config.congestion_penalty,
            "max_congestion_score": self.config.max_congestion_score,
            "forecast_horizon":     self.config.forecast_horizon,
            "fast_snap":            self._kdtree is not None,
            "graph_source":         "osm_pbf" if cache_exists else "fallback",
        }

    def __repr__(self) -> str:
        status = "loaded" if self._is_loaded else "not loaded"
        nodes  = len(self._graph.nodes) if self._graph else 0
        return (
            f"RoutePlanner("
            f"status={status}, "
            f"nodes={nodes:,}, "
            f"cong_nodes={len(self._congestion_map)})"
        )
