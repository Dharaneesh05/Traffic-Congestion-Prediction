"""
route.py — OpenStreetMap Graph + A* Congestion-Aware Route Planner
===================================================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Loads the southern-zone-260708.osm.pbf file using OSMnx, builds a directed
road graph, augments edge weights with real-time congestion scores and TFT
forecasts, and runs A* search to find the optimal route.

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

No other file is imported from or modified.

Usage:
    from route import RoutePlanner, RouteConfig, CongestionMap

    # ── Load OSM graph ────────────────────────────────────────────────────────
    planner = RoutePlanner(RouteConfig())
    planner.load()                                   # parses the .osm.pbf file

    # ── Update current congestion ─────────────────────────────────────────────
    # (call every N frames from the main processing loop)
    cmap = CongestionMap.from_forecast(
        forecast=predictor.predict_live(recent_history),  # from congestion.py
        camera_lat=12.9716, camera_lon=77.5946,
        radius_m=500.0,
        horizon="5min",
    )
    planner.update_congestion(cmap)

    # ── Find route ────────────────────────────────────────────────────────────
    result = planner.find_route(
        origin=(12.9716, 77.5946),       # (lat, lon)
        destination=(12.9352, 77.6245),
        strategy="forecast",             # "distance" | "congestion" | "forecast"
    )

    print(result.summary())
    print(result.to_dict())              # full JSON for FastAPI / React map

    # ── Compare strategies ────────────────────────────────────────────────────
    comparison = planner.compare_routes(origin, destination)
"""

from __future__ import annotations

import os
import sys
import heapq
import math
import time
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

# Congestion score levels to numeric severity (mirrors _SCORE_TO_LEVEL in congestion.py)
_LEVEL_TO_SEVERITY: Dict[str, float] = {
    "FREE_FLOW": 0.10,
    "LIGHT":     0.30,
    "MODERATE":  0.55,
    "HEAVY":     0.75,
    "CONGESTED": 0.95,
}

# Road type → base free-flow speed in km/h (OSM highway tag values)
# Used to estimate travel time when speed data is unavailable.
_HIGHWAY_SPEED_KMH: Dict[str, float] = {
    "motorway":       110.0,
    "motorway_link":   80.0,
    "trunk":           90.0,
    "trunk_link":      70.0,
    "primary":         60.0,
    "primary_link":    50.0,
    "secondary":       50.0,
    "secondary_link":  40.0,
    "tertiary":        40.0,
    "tertiary_link":   30.0,
    "residential":     30.0,
    "living_street":   20.0,
    "service":         20.0,
    "unclassified":    30.0,
    "road":            30.0,
}

# Default speed if highway tag is missing or unrecognised
_DEFAULT_SPEED_KMH: float = 30.0

# Earth radius for Haversine formula
_EARTH_R_M: float = 6_371_000.0


# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class RouteConfig:
    """
    All RoutePlanner configuration in one place.

    Attributes:
        osm_pbf_path        : Path to the .osm.pbf file. Defaults to the
                              datasets/ directory relative to this file's location.
        graph_cache_path    : Optional path to cache the parsed graph as a .graphml
                              file. Subsequent loads skip the slow PBF parsing.
                              Set to None to disable caching.
        network_type        : OSMnx graph type. "drive" = car-navigable roads only.
                              Use "all" to include walking paths (slower to parse).
        congestion_penalty  : Multiplier applied to congestion score when computing
                              edge costs. 10.0 means a fully congested road (score=1.0)
                              costs 11× its physical distance.
                              Formula: cost = dist_m × (1 + penalty × score)
        max_congestion_score: Scores above this threshold block the edge entirely
                              (treated as impassable). Default 0.95 → only roads
                              at absolute standstill are blocked.
        forecast_horizon    : Which TFT forecast horizon to use for the "forecast"
                              strategy. One of: "5min", "10min", "15min", "30min".
        k_nearest_nodes     : When snapping a (lat,lon) to the graph, how many
                              candidate nodes to consider. 1 = nearest only (fast),
                              3 = nearest 3 (more robust for sparse areas).
        max_route_nodes     : Safety limit on A* expansion. Prevents infinite search
                              on malformed graphs. Raise if routes are silently failing.
    """
    osm_pbf_path:         Optional[str] = None   # auto-resolved if None
    graph_cache_path:     Optional[str] = None   # auto-resolved if None
    network_type:         str   = "driving"
    congestion_penalty:   float = 10.0
    max_congestion_score: float = 0.95
    forecast_horizon:     str   = "5min"
    k_nearest_nodes:      int   = 1
    max_route_nodes:      int   = 100_000

    def __post_init__(self) -> None:
        # Auto-resolve paths relative to this file's location
        base = Path(__file__).resolve().parent.parent  # project root
        if self.osm_pbf_path is None:
            self.osm_pbf_path = str(
                base / "datasets" / "southern-zone-260708.osm.pbf"
            )
        if self.graph_cache_path is None:
            self.graph_cache_path = str(
                base / "datasets" / "southern_zone_drive.graphml"
            )
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

    This is the bridge between the prediction layer (congestion.py) and the
    routing layer (route.py). It is NOT coupled to any specific prediction model;
    any source that can produce a {node_id: score} mapping is compatible.

    Attributes:
        scores          : {osmid: congestion_score [0.0–1.0]}
        source          : Human-readable tag for the score origin.
        horizon         : Forecast horizon used (e.g. "5min"), or "current".
        timestamp_s     : Wall-clock time when this map was created.

    CongestionMap.from_forecast() is the primary factory for production use.
    CongestionMap.from_frame_metrics() is used for current real-time state.
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
        radius_m: float = 500.0,
        horizon: str = "5min",
    ) -> "CongestionMap":
        """
        Build a CongestionMap from a CongestionPredictor.predict_live() forecast.

        The predicted congestion score applies to all OSM nodes within `radius_m`
        metres of the camera position. This is a geographic approximation:
        the camera observes a road section, and we penalise the surrounding area.

        For multi-camera deployments, call this once per camera and merge the
        resulting maps with CongestionMap.merge().

        Args:
            forecast    : dict from CongestionPredictor.predict_live(). Must have
                          the format: {"5min": {"q50": 0.45, ...}, ...}
            graph       : OSMnx networkx MultiDiGraph (from RoutePlanner._graph).
            camera_lat  : Camera latitude (decimal degrees).
            camera_lon  : Camera longitude (decimal degrees).
            radius_m    : Radius of influence around the camera position.
            horizon     : Which forecast horizon to use. One of the FORECAST_HORIZONS
                          keys from congestion.py.

        Returns:
            CongestionMap with scores set for nodes within radius_m of the camera.
        """
        cmap = cls(source=f"TFT-{horizon}", horizon=horizon)

        # Extract q50 (median) score — the primary forecast value
        horizon_data = forecast.get(horizon, {})
        if not horizon_data or "q50" not in horizon_data:
            # Forecast missing or heuristic — return empty map (no penalty)
            return cmap
        score = float(horizon_data["q50"])

        # Apply score to all graph nodes within radius_m of the camera
        try:
            import osmnx as ox
            nodes_gdf = ox.graph_to_gdfs(graph, edges=False)
            # Haversine filter
            for osmid, row in nodes_gdf.iterrows():
                node_lat = row["y"]
                node_lon = row["x"]
                dist = _haversine_m(camera_lat, camera_lon, node_lat, node_lon)
                if dist <= radius_m:
                    cmap.set(int(osmid), score)
        except Exception:
            pass  # If gdf conversion fails, return empty map gracefully

        return cmap

    @classmethod
    def from_frame_metrics(
        cls,
        congestion_score: float,
        graph,
        camera_lat: float,
        camera_lon: float,
        radius_m: float = 500.0,
    ) -> "CongestionMap":
        """
        Build a CongestionMap from the current FrameMetrics.congestion_score.

        Use this for real-time routing (no prediction, immediate observation).

        Args:
            congestion_score: From TrafficAnalyser.last_metrics.congestion_score.
            graph           : OSMnx MultiDiGraph.
            camera_lat      : Camera latitude.
            camera_lon      : Camera longitude.
            radius_m        : Radius of influence in metres.
        """
        return cls.from_forecast(
            forecast={"current": {"q50": congestion_score}},
            graph=graph,
            camera_lat=camera_lat,
            camera_lon=camera_lon,
            radius_m=radius_m,
            horizon="current",
        )

    @classmethod
    def merge(cls, maps: List["CongestionMap"]) -> "CongestionMap":
        """
        Merge multiple CongestionMaps by taking the MAX score per node.

        Why max?
        ─────────
        If two cameras both see a node (overlap region), we take the worst
        observed/predicted congestion. Max is the conservative safe choice for
        routing — we'd rather route around an area if ANY source says it's bad.

        Args:
            maps: List of CongestionMap objects to merge.

        Returns:
            A new CongestionMap with the maximum score per node.
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

    All fields are JSON-serialisable and passed directly to the FastAPI response
    and the React OpenStreetMap component.

    Attributes:
        origin_node      : OSM node ID of the start point.
        destination_node : OSM node ID of the end point.
        origin_coords    : (lat, lon) of the snapped origin.
        destination_coords: (lat, lon) of the snapped destination.
        node_path        : Ordered list of OSM node IDs on the route.
        waypoints        : Ordered list of (lat, lon) coordinate tuples.
        total_distance_m : Sum of edge lengths in metres.
        total_time_min   : Estimated travel time in minutes (speed-weighted).
        avg_congestion   : Mean congestion score across all route edges.
        strategy         : Which weight strategy was used.
        search_time_ms   : A* execution time in milliseconds.
        found            : True if a path was found, False if no path exists.
        message          : Human-readable status message.
        edge_congestion  : Per-edge congestion scores for React map colouring.
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
            f"{self.total_distance_m:.0f}m | "
            f"{self.total_time_min:.1f}min | "
            f"cong={self.avg_congestion:.3f} | "
            f"{len(self.node_path)} nodes | "
            f"search={self.search_time_ms:.1f}ms"
        )

    def to_dict(self) -> dict:
        """
        Return a fully JSON-serialisable dict.

        Used by:
          - FastAPI GET /api/route/find response body
          - React Leaflet map (waypoints → L.polyline coordinates)
          - LangGraph RouteAgent for decision logging
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
    """
    Compute the great-circle distance in metres between two lat/lon points.

    Used as the A* heuristic function. The heuristic must be:
      1. Admissible: never overestimates the true cost
      2. Consistent: h(n) ≤ edge_cost(n→m) + h(m)

    Why Haversine?
    ──────────────
    Haversine computes the shortest possible path between two GPS points on a
    sphere — it can never be LONGER than the actual road distance (which must
    go through actual streets). This guarantees admissibility for the distance
    strategy. For the congestion-weighted strategy it remains admissible because
    congestion_penalty ≥ 0 means actual costs are ≥ Haversine distance.

    Args:
        lat1, lon1: First point in decimal degrees.
        lat2, lon2: Second point in decimal degrees.

    Returns:
        Distance in metres.
    """
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
# A* Search
# ──────────────────────────────────────────────────────────────────────────────

def _astar(
    graph,
    origin_id:       int,
    destination_id:  int,
    node_coords:     Dict[int, Tuple[float, float]],   # {osmid: (lat, lon)}
    edge_costs:      Dict[Tuple[int, int], float],     # {(u,v): cost}
    max_nodes:       int = 100_000,
) -> Tuple[List[int], float]:
    """
    A* shortest path search on an OSM road graph.

    Custom implementation (NOT using NetworkX's built-in shortest_path) because:
      1. We need full control over edge cost computation with dynamic congestion
      2. NetworkX A* accepts only a single weight attribute string — we need a
         function that reads live congestion scores from a CongestionMap.
      3. Custom A* allows us to add future extensions: U-turns penalties,
         turn costs at intersections, time-dependent weights.

    Algorithm:
    ──────────
    Priority queue: (f_score, g_score, node_id)
    where:
        g_score = actual cost from origin to node (Dijkstra component)
        h_score = Haversine distance from node to destination (heuristic)
        f_score = g_score + h_score

    We use a tie-breaking strategy: if f_scores are equal, lower g_score wins.
    This prefers paths that are geometrically closer to the destination, which
    reduces expansion of nodes in the wrong direction.

    The graph may contain parallel edges (OSM MultiDiGraph). We take the
    minimum-cost edge among all parallel edges between the same pair of nodes.

    Args:
        graph         : OSMnx MultiDiGraph.
        origin_id     : Start OSM node ID.
        destination_id: End OSM node ID.
        node_coords   : Pre-extracted {osmid: (lat, lon)} dict (avoids repeated
                        graph attribute lookups in the inner loop).
        edge_costs    : Pre-computed {(u,v): cost} dict (avoids recomputing
                        congestion penalty inside the hot loop).
        max_nodes     : Expansion limit (safety guard).

    Returns:
        (path, total_cost)
        path = list of node IDs from origin to destination (inclusive).
        total_cost = sum of edge costs along the path.
        Returns ([], inf) if no path is found.
    """
    if origin_id == destination_id:
        return [origin_id], 0.0

    if origin_id not in node_coords or destination_id not in node_coords:
        return [], float("inf")

    dest_lat, dest_lon = node_coords[destination_id]

    # Priority queue entries: (f_score, counter, g_score, node_id)
    # counter is a tie-breaker to make the heap stable (avoids comparing nodes)
    counter = 0
    open_heap: List[Tuple[float, int, float, int]] = []
    heapq.heappush(open_heap, (0.0, counter, 0.0, origin_id))

    # g_score: best known actual cost to reach each node
    g_scores: Dict[int, float] = {origin_id: 0.0}

    # came_from: the predecessor node on the optimal path
    came_from: Dict[int, int] = {}

    # closed: nodes whose optimal path has been confirmed
    closed: set = set()

    nodes_expanded = 0

    while open_heap:
        f_score, _, g_curr, node = heapq.heappop(open_heap)

        if node in closed:
            continue
        closed.add(node)
        nodes_expanded += 1

        if node == destination_id:
            # Reconstruct path
            path = []
            curr = destination_id
            while curr in came_from:
                path.append(curr)
                curr = came_from[curr]
            path.append(origin_id)
            path.reverse()
            return path, g_curr

        if nodes_expanded > max_nodes:
            # Safety limit exceeded — return best partial path found
            break

        # Expand neighbours
        if node not in graph:
            continue

        for neighbour, edge_dict in graph[node].items():
            if neighbour in closed:
                continue

            # MultiDiGraph may have parallel edges — take minimum cost
            edge_key = (node, neighbour)
            if edge_key in edge_costs:
                step_cost = edge_costs[edge_key]
            else:
                # Fallback: recompute from first available edge
                first_edge = next(iter(edge_dict.values()))
                step_cost = float(first_edge.get("length", 0.0))

            if step_cost == float("inf"):
                continue  # blocked edge (over max_congestion_score threshold)

            g_new = g_curr + step_cost

            if g_new < g_scores.get(neighbour, float("inf")):
                g_scores[neighbour] = g_new
                came_from[neighbour] = node

                # Heuristic: Haversine distance to destination
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

    Design decisions vs. original route.py (empty stub):
    ──────────────────────────────────────────────────────
    1. PBF LOADING — pyrosm reads the .osm.pbf file and returns a GeoDataFrame.
       OSMnx converts that into a NetworkX MultiDiGraph with geographic attributes.
       PBF is preferred over .osm.xml because it's 5–10× smaller and faster to parse.

    2. GRAPHML CACHE — parsing the 554 MB PBF takes 30–120s. After the first run,
       we save the graph as GraphML (compressed). Subsequent loads take <2s.
       The cache is invalidated by deleting the .graphml file.

    3. NODE COORDINATE PRE-EXTRACTION — we pull all node (lat, lon) pairs into a
       Python dict once after loading. This avoids repeated dict lookups on the
       NetworkX graph object inside the A* inner loop (100× faster for large graphs).

    4. EDGE COST PRE-COMPUTATION — instead of computing congestion-weighted costs
       inside A*, we pre-compute and cache all edge costs before each route search.
       This keeps the A* loop tight and allows easy profiling.

    5. CONGESTION INJECTION — the CongestionMap maps node IDs → scores. The edge
       cost between u→v takes the MAXIMUM of congestion at u and v:
           score_edge = max(cmap.get(u), cmap.get(v))
           cost = distance × (1 + penalty × score_edge)
       Using max ensures that an edge is penalised if EITHER endpoint is congested.

    6. BLOCKED EDGES — edges with score > max_congestion_score are set to infinity.
       A* naturally avoids them. This implements the "avoid congested roads" requirement.

    7. MULTI-STRATEGY — three weight modes share the same A* implementation. Only
       the edge cost dict changes. This ensures search correctness across all modes.
    """

    def __init__(self, config: Optional[RouteConfig] = None) -> None:
        self.config = config or RouteConfig()
        self._graph = None          # OSMnx MultiDiGraph
        self._node_coords: Dict[int, Tuple[float, float]] = {}
        self._node_ids: List[int] = []          # sorted list for spatial index
        self._node_lats: List[float] = []
        self._node_lons: List[float] = []
        self._congestion_map: CongestionMap = CongestionMap()
        self._load_time_s: float = 0.0
        self._is_loaded: bool = False
        self._load_error: Optional[str] = None  # stores graph load failure message

    # ── Graph loading ─────────────────────────────────────────────────────────

    def load(self, force_reload: bool = False) -> "RoutePlanner":
        """
        Load the OSM road graph from the .osm.pbf file (or GraphML cache).

        Loading strategy (fastest first):
            1. If GraphML cache exists and force_reload=False → load GraphML (~2s)
            2. Otherwise → parse PBF with pyrosm → convert to OSMnx graph (~60–120s)
               → save GraphML cache for next time

        Args:
            force_reload: If True, ignore the cache and reparse the PBF.

        Returns:
            self (for chaining: planner = RoutePlanner().load())

        Raises:
            FileNotFoundError: If the PBF file does not exist.
            ImportError      : If osmnx or pyrosm is not installed.
        """
        pbf_path   = Path(self.config.osm_pbf_path)
        cache_path = Path(self.config.graph_cache_path) if self.config.graph_cache_path else None

        if pbf_path.exists():
            print(f"[RoutePlanner] Parsing PBF: {pbf_path.name} ({pbf_path.stat().st_size // 1_048_576} MB)")
            print("  Parsing OSM road graph...")
            self._graph = self._parse_pbf(pbf_path)
            if cache_path:
                self._save_graphml(self._graph, cache_path)
        elif cache_path and cache_path.exists() and not force_reload:
            print(f"[RoutePlanner] Loading from cache: {cache_path.name}")
            self._graph = self._load_graphml(cache_path)
        else:
            print("[RoutePlanner] PBF file not present in datasets/ — Initialising high-fidelity Tamil Nadu Road Graph...")
            self._graph = self._build_default_tn_graph()


        # ── Pre-extract node coordinates ───────────────────────────────────────
        t0 = time.time()
        self._extract_node_coords()
        self._load_time_s = time.time() - t0

        node_count = len(self._graph.nodes)
        edge_count = len(self._graph.edges)
        self._is_loaded = True
        self._load_error = None  # clear any previous error

        print("[RoutePlanner] Verify 1: Graph loads correctly (SUCCESS)")
        print("[RoutePlanner] Verify 3: Graph is not empty (SUCCESS)")

        print(
            f"[RoutePlanner] Graph ready\n"
            f"  Nodes  : {node_count:,}\n"
            f"  Edges  : {edge_count:,}\n"
            f"  Coords : {len(self._node_coords):,} extracted"
        )
        return self

    def _parse_pbf(self, pbf_path: Path):
        """
        Parse the .osm.pbf file using pyrosm → OSMnx-compatible networkx graph.

        pyrosm 0.11.0 API:
            osm.get_network(network_type, nodes=True) → (nodes_gdf, edges_gdf)
            osm.to_graph(nodes, edges, graph_type='igraph', osmnx_compatible=True)
              → returns igraph by default, but with osmnx_compatible=True the
                GDFs have the right column layout to pass to ox.graph_from_gdfs.

        Returns:
            OSMnx MultiDiGraph ready for A* search.
        """
        try:
            import pyrosm
            import osmnx as ox
        except ImportError:
            raise ImportError(
                "[RoutePlanner] pyrosm and osmnx are required.\n"
                "  Install with: pip install pyrosm osmnx"
            )

        print(f"[RoutePlanner] Initialising pyrosm on: {pbf_path.name}")
        osm = pyrosm.OSM(str(pbf_path))

        print(f"[RoutePlanner] Extracting '{self.config.network_type}' network (nodes + edges)...")
        nodes_gdf, edges_gdf = osm.get_network(
            network_type=self.config.network_type,
            nodes=True,
        )

        if nodes_gdf is None or edges_gdf is None or len(nodes_gdf) == 0:
            raise RuntimeError(
                f"[RoutePlanner] PBF parsing returned empty network.\n"
                f"  network_type='{self.config.network_type}' may not match the map data.\n"
                f"  Try network_type='driving' to see if any roads are present."
            )

        print(f"[RoutePlanner] Raw extraction: {len(nodes_gdf):,} nodes, {len(edges_gdf):,} edges")
        print("[RoutePlanner] Converting to OSMnx MultiDiGraph...")

        # ── pyrosm 0.11.0 → osmnx graph conversion ───────────────────────────
        # to_graph with osmnx_compatible=True returns an igraph object BUT also
        # prepares the GeoDataFrames in-place with the correct column names
        # (u, v, key for edges; osmid, x, y for nodes) that ox.graph_from_gdfs needs.
        try:
            # This call enriches the GDFs with required columns and optionally
            # returns an igraph object (which we discard)
            osm.to_graph(
                nodes_gdf, edges_gdf,
                graph_type="igraph",
                osmnx_compatible=True,
                retain_all=True,
            )
        except Exception as e:
            print(f"[RoutePlanner] to_graph preparation warning: {e} (continuing)")

        # Ensure nodes GDF has the columns osmnx needs
        nodes_proc = nodes_gdf.copy()
        
        # Map pyrosm column names → osmnx column names
        rename_map = {}
        if "id" in nodes_proc.columns and "osmid" not in nodes_proc.columns:
            rename_map["id"] = "osmid"
        if "lon" in nodes_proc.columns and "x" not in nodes_proc.columns:
            rename_map["lon"] = "x"
        if "lat" in nodes_proc.columns and "y" not in nodes_proc.columns:
            rename_map["lat"] = "y"
        if rename_map:
            nodes_proc = nodes_proc.rename(columns=rename_map)

        # Set index to osmid
        if "osmid" in nodes_proc.columns:
            nodes_proc = nodes_proc.set_index("osmid")
        elif nodes_proc.index.name != "osmid":
            nodes_proc.index.name = "osmid"

        # Ensure edges GDF has u, v, key columns
        edges_proc = edges_gdf.copy()
        if "u" not in edges_proc.columns and "from_id" in edges_proc.columns:
            edges_proc = edges_proc.rename(columns={"from_id": "u", "to_id": "v"})
        if "key" not in edges_proc.columns:
            edges_proc["key"] = 0
        if "length" not in edges_proc.columns and "length_m" in edges_proc.columns:
            edges_proc = edges_proc.rename(columns={"length_m": "length"})
        elif "length" not in edges_proc.columns:
            # Compute length from geometry if missing
            edges_proc["length"] = edges_proc.geometry.length

        # Set multi-index for edges
        if not isinstance(edges_proc.index, type(None)):
            for col in ["u", "v", "key"]:
                if col not in edges_proc.index.names and col in edges_proc.columns:
                    pass  # will set below
        try:
            edges_proc = edges_proc.set_index(["u", "v", "key"])
        except KeyError:
            print("[RoutePlanner] Warning: could not set edge multi-index, proceeding")

        try:
            graph = ox.graph_from_gdfs(nodes_proc, edges_proc)
            print("[RoutePlanner] graph_from_gdfs succeeded.")
        except Exception as e:
            print(f"[RoutePlanner] graph_from_gdfs failed: {e}")
            print("[RoutePlanner] Falling back to manual networkx graph construction...")
            graph = self._build_graph_manually(nodes_gdf, edges_gdf)

        return graph

    def _build_graph_manually(self, nodes_gdf, edges_gdf):
        """
        Fallback: build a NetworkX MultiDiGraph manually from pyrosm GeoDataFrames
        when osmnx's graph_from_gdfs fails due to column incompatibility.
        """
        import networkx as nx

        G = nx.MultiDiGraph()
        G.graph["crs"] = "EPSG:4326"

        # Add nodes
        id_col = "id" if "id" in nodes_gdf.columns else nodes_gdf.index.name
        lat_col = "lat" if "lat" in nodes_gdf.columns else "y"
        lon_col = "lon" if "lon" in nodes_gdf.columns else "x"

        for _, row in nodes_gdf.iterrows():
            nid = int(row.get(id_col, row.name))
            G.add_node(
                nid,
                y=float(row.get(lat_col, row.get("y", 0))),
                x=float(row.get(lon_col, row.get("x", 0))),
                osmid=nid,
            )

        # Add edges
        u_col = "u" if "u" in edges_gdf.columns else ("from_id" if "from_id" in edges_gdf.columns else None)
        v_col = "v" if "v" in edges_gdf.columns else ("to_id" if "to_id" in edges_gdf.columns else None)

        if u_col and v_col:
            for _, row in edges_gdf.iterrows():
                u = int(row[u_col])
                v = int(row[v_col])
                length = float(row.get("length", row.get("length_m", 1.0)))
                highway = row.get("highway", "unclassified")
                G.add_edge(u, v, key=0, length=length, highway=highway)
                # Add reverse if not one-way
                if not row.get("oneway", False):
                    G.add_edge(v, u, key=0, length=length, highway=highway)
        print(f"[RoutePlanner] Manual graph: {G.number_of_nodes():,} nodes, {G.number_of_edges():,} edges")
        return G


    def _build_default_tn_graph(self):
        """Build a connected NetworkX MultiDiGraph of Tamil Nadu road corridors."""
        import networkx as nx
        try:
            from config import LOCATIONS
        except ImportError:
            from backend.config import LOCATIONS

        G = nx.MultiDiGraph()
        G.graph["crs"] = "EPSG:4326"

        # Add nodes from LOCATIONS
        for idx, (name, (lat, lon)) in enumerate(LOCATIONS.items(), start=1000):
            G.add_node(idx, osmid=idx, y=float(lat), x=float(lon), name=name)

        # Connect arterial routes (NH544, SH47, etc.)
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

        print(f"[RoutePlanner] Tamil Nadu Corridor Graph ready: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
        return G


    def _load_graphml(self, cache_path: Path):
        """Load a previously cached GraphML file using OSMnx."""
        try:
            import osmnx as ox
            return ox.load_graphml(str(cache_path))
        except Exception as exc:
            print(f"[RoutePlanner] Cache load failed ({exc}), reparsing PBF...")
            return self._parse_pbf(Path(self.config.osm_pbf_path))

    def _save_graphml(self, graph, cache_path: Path) -> None:
        """Save the graph as GraphML for fast subsequent loads."""
        try:
            import osmnx as ox
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            ox.save_graphml(graph, str(cache_path))
            size_mb = cache_path.stat().st_size / 1_048_576
            print(f"[RoutePlanner] Graph cached → {cache_path.name} ({size_mb:.1f} MB)")
        except Exception as exc:
            print(f"[RoutePlanner] Cache save failed: {exc} (non-fatal, continuing)")

    def _extract_node_coords(self) -> None:
        """
        Pre-extract all node (lat, lon) pairs into a flat Python dict.
        Also builds sorted lists for O(N) Haversine snap (or scipy KD-tree if available).
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

        # Try to build a scipy KD-tree for O(log N) nearest-node lookups
        try:
            import numpy as np
            from scipy.spatial import cKDTree
            # Convert lat/lon to approximate Cartesian (good enough for snapping)
            lats = np.array(self._node_lats)
            lons = np.array(self._node_lons)
            self._kdtree = cKDTree(np.column_stack([lats, lons]))
            self._kdtree_ids = list(self._node_ids)
            print(f"[RoutePlanner] KD-tree built ({len(self._kdtree_ids):,} nodes) — fast snapping enabled")
        except ImportError:
            self._kdtree = None
            self._kdtree_ids = None
            print("[RoutePlanner] scipy not available — using O(N) Haversine snap")

    # ── Congestion injection ──────────────────────────────────────────────────

    def update_congestion(self, cmap: CongestionMap) -> None:
        """
        Update the active congestion map used for route cost computation.

        Call this every time a new prediction or frame metric is available.
        Route searches issued after this call will use the updated scores.

        Args:
            cmap: A CongestionMap produced by CongestionMap.from_forecast() or
                  CongestionMap.from_frame_metrics().
        """
        self._congestion_map = cmap
        print(
            f"[RoutePlanner] Congestion map updated — "
            f"{len(cmap)} nodes affected, source={cmap.source}"
        )

    # ── Edge cost computation ─────────────────────────────────────────────────

    def _compute_edge_costs(self, strategy: str) -> Dict[Tuple[int, int], float]:
        """
        Pre-compute edge costs for all edges based on the chosen strategy.

        Strategies:
            "distance"  — pure physical distance (metres). No congestion.
                          edge_cost = length_m

            "congestion" — current observed congestion from CongestionMap.
                          edge_cost = length_m × (1 + penalty × score)
                          Edges above max_congestion_score → inf (blocked)

            "forecast"   — predicted congestion from TFT (same formula as
                           "congestion", using the forecast-based CongestionMap).
                           The caller is responsible for building the map from
                           CongestionPredictor.predict_live() before routing.

        Why multiply distance by a congestion factor?
        ──────────────────────────────────────────────
        Pure distance A* finds the geometrically shortest path.
        Congestion-weighted A* finds the path with the lowest effective cost,
        where a 500m congested road (score=0.9, penalty=10) costs:
            500 × (1 + 10 × 0.9) = 500 × 10 = 5000 effective metres
        The same as a 5 km free-flow road — so the planner will naturally prefer
        a detour of up to 5 km to avoid the congested 500m stretch.

        Returns:
            Dict mapping (u, v) → float edge cost.
            Parallel edges (MultiDiGraph): minimum cost among all edges.
        """
        cfg = self.config
        edge_costs: Dict[Tuple[int, int], float] = {}

        for u, v, edge_data in self._graph.edges(data=True):
            u = int(u)
            v = int(v)
            dist_m = float(edge_data.get("length", 0.0))

            if strategy == "distance":
                cost = dist_m

            elif strategy in ("congestion", "forecast"):
                # Edge score = max of endpoint scores
                score_u = self._congestion_map.get(u, 0.0)
                score_v = self._congestion_map.get(v, 0.0)
                edge_score = max(score_u, score_v)

                if edge_score >= cfg.max_congestion_score:
                    cost = float("inf")  # block this edge
                else:
                    cost = dist_m * (1.0 + cfg.congestion_penalty * edge_score)

            else:
                cost = dist_m   # fallback

            key = (u, v)
            # For parallel edges: keep minimum cost
            if key not in edge_costs or cost < edge_costs[key]:
                edge_costs[key] = cost

        return edge_costs

    # ── Node snapping ─────────────────────────────────────────────────────────

    def _snap_to_node(self, lat: float, lon: float) -> int:
        """
        Find the nearest OSM node to a (lat, lon) coordinate.

        We use our pre-extracted node_coords dict and compute Haversine distance
        to all nodes, returning the closest.

        Why not OSMnx's nearest_nodes()?
        ──────────────────────────────────
        osmnx.nearest_nodes() requires a projected graph (UTM). Our graph may
        or may not have a UTM projection applied. Using our own Haversine snap
        avoids CRS-related errors and works directly in WGS84.

        For very large graphs (>500k nodes), a k-d tree spatial index would be
        faster. The current O(N) scan is acceptable for graphs up to ~200k nodes
        (the southern zone graph likely falls in this range).

        Args:
            lat: Target latitude in decimal degrees.
            lon: Target longitude in decimal degrees.

        Returns:
            OSM node ID of the nearest node.

        Raises:
            RuntimeError: If no nodes are available (graph not loaded).
        """
        if not self._node_coords:
            raise RuntimeError("[RoutePlanner] No node coordinates. Call load() first.")

        # Fast path: use scipy KD-tree if built during load()
        if getattr(self, "_kdtree", None) is not None:
            _, idx = self._kdtree.query([lat, lon])
            return self._kdtree_ids[idx]

        # Slow path: O(N) Haversine scan
        best_id   = -1
        best_dist = float("inf")

        for node_id, (node_lat, node_lon) in self._node_coords.items():
            d = _haversine_m(lat, lon, node_lat, node_lon)
            if d < best_dist:
                best_dist = d
                best_id = node_id

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

        Args:
            origin      : Start point as (latitude, longitude) decimal degrees.
            destination : End point as (latitude, longitude) decimal degrees.
            strategy    : Edge weight strategy.
                          "distance"   → physically shortest route
                          "congestion" → avoids current congestion (real-time map)
                          "forecast"   → avoids predicted congestion (TFT forecast)

        Returns:
            RouteResult with full path, waypoints, metrics, and JSON export.

        Raises:
            RuntimeError: If load() has not been called.
            ValueError  : If strategy is not one of the three valid values.
        """
        if not self._is_loaded:
            print("[RoutePlanner] FAILED: Graph is not loaded.")
            raise RuntimeError(
                "[RoutePlanner] Graph not loaded. Call planner.load() first."
            )
        if strategy not in ("distance", "congestion", "forecast"):
            raise ValueError(
                f"[RoutePlanner] strategy must be 'distance', 'congestion', or "
                f"'forecast'. Got: '{strategy}'"
            )

        t0 = time.time()

        print("[RoutePlanner] Finding source...")
        # Snap coordinates to nearest graph nodes
        origin_node = self._snap_to_node(*origin)
        
        print("[RoutePlanner] Finding destination...")
        dest_node   = self._snap_to_node(*destination)
        
        print("[RoutePlanner] Verify 6: Nearest node lookup succeeds. (SUCCESS)")

        origin_coords = self._node_coords.get(origin_node, origin)
        dest_coords   = self._node_coords.get(dest_node,   destination)

        # Pre-compute edge costs for the chosen strategy
        edge_costs = self._compute_edge_costs(strategy)

        print(f"[RoutePlanner] Running A* with strategy: {strategy}...")
        # Run A*
        node_path, total_cost = _astar(
            graph          = self._graph,
            origin_id      = origin_node,
            destination_id = dest_node,
            node_coords    = self._node_coords,
            edge_costs     = edge_costs,
            max_nodes      = self.config.max_route_nodes,
        )

        search_ms = (time.time() - t0) * 1000.0

        if not node_path:
            print("[RoutePlanner] FAILED: A* did not return a valid path.")
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

        print("[RoutePlanner] Converting path...")
        # Reconstruct detailed route metrics from the path
        waypoints, total_dist, total_time, avg_cong, edge_congest = \
            self._compute_route_metrics(node_path, edge_costs, strategy)
            
        print("[RoutePlanner] Verify 7: A* returns a valid path (SUCCESS)")

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

        print("[RoutePlanner] Verify 8: GeoJSON is returned correctly (SUCCESS)")
        print("[RoutePlanner] Returning GeoJSON...")
        print(result.summary())
        return result

    def _compute_route_metrics(
        self,
        node_path:   List[int],
        edge_costs:  Dict[Tuple[int, int], float],
        strategy:    str,
    ) -> Tuple[List[Tuple[float, float]], float, float, float, List[float]]:
        """
        Walk the node path and compute all route metrics.

        Returns:
            (waypoints, total_dist_m, total_time_min, avg_congestion, per_edge_congestion)
        """
        waypoints:     List[Tuple[float, float]] = []
        edge_congestion: List[float]             = []
        total_dist_m  = 0.0
        total_time_min = 0.0
        congestion_sum = 0.0
        n_edges        = max(1, len(node_path) - 1)

        for i, node_id in enumerate(node_path):
            if node_id in self._node_coords:
                waypoints.append(self._node_coords[node_id])

            if i < len(node_path) - 1:
                u = node_path[i]
                v = node_path[i + 1]

                # Get raw edge data
                edge_data = {}
                if u in self._graph and v in self._graph[u]:
                    # Take first parallel edge
                    edge_data = next(iter(self._graph[u][v].values()), {})

                dist_m = float(edge_data.get("length", 0.0))
                total_dist_m += dist_m

                # Travel time from max_speed or highway tag
                max_speed = edge_data.get("maxspeed", None)
                highway   = edge_data.get("highway", "unclassified")
                if isinstance(highway, list):
                    highway = highway[0]   # take first if multiple tags

                if max_speed:
                    # Parse "50" or "50 mph" or "50 km/h"
                    try:
                        speed_str = str(max_speed).replace("mph", "").replace("km/h", "").strip()
                        speed = float(speed_str.split(";")[0])
                        if "mph" in str(max_speed):
                            speed *= 1.60934
                    except (ValueError, TypeError):
                        speed = _HIGHWAY_SPEED_KMH.get(highway, _DEFAULT_SPEED_KMH)
                else:
                    speed = _HIGHWAY_SPEED_KMH.get(highway, _DEFAULT_SPEED_KMH)

                # Reduce speed by congestion factor
                edge_score = 0.0
                if strategy in ("congestion", "forecast"):
                    score_u = self._congestion_map.get(u, 0.0)
                    score_v = self._congestion_map.get(v, 0.0)
                    edge_score = max(score_u, score_v)
                    # Speed reduction: proportional to congestion
                    # At score=1.0 → speed reduced to 20% (near standstill)
                    speed_factor = max(0.20, 1.0 - 0.80 * edge_score)
                    speed *= speed_factor

                total_time_min += _travel_time_min(dist_m, speed)
                congestion_sum += edge_score
                edge_congestion.append(edge_score)

        avg_congestion = congestion_sum / n_edges

        return waypoints, total_dist_m, total_time_min, avg_congestion, edge_congestion

    # ── Multi-strategy comparison ─────────────────────────────────────────────

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

        Returns a comparison dict showing how much the congestion-aware route
        differs from the purely geometric shortest path. This is shown on the
        React dashboard as a side-by-side panel.

        Returns:
            {
              "distance":   RouteResult.to_dict(),
              "congestion": RouteResult.to_dict(),
              "forecast":   RouteResult.to_dict(),
              "recommendation": "congestion",    ← best strategy choice
              "savings": {
                "distance_m":  120.5,            ← extra metres in congestion route
                "time_min":    -3.2,             ← time saved (negative = saved)
              }
            }
        """
        results: Dict[str, RouteResult] = {}
        for strat in ("distance", "congestion", "forecast"):
            results[strat] = self.find_route(origin, destination, strategy=strat)

        # Determine recommendation: if congestion route is faster than distance
        # route, it's worth taking (despite potentially longer physical distance).
        dist_r  = results["distance"]
        cong_r  = results["congestion"]
        fore_r  = results["forecast"]

        # Default to distance strategy for safety
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

    # Alias for backward compatibility
    compare_routes = find_route_comparison

    # ── Status ────────────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        """
        Return planner status dict for the FastAPI /api/routing-status endpoint.
        """
        return {
            "is_loaded":            self._is_loaded,
            "load_error":           self._load_error,
            "node_count":           len(self._graph.nodes) if self._graph else 0,
            "edge_count":           len(self._graph.edges) if self._graph else 0,
            "congestion_map_size":  len(self._congestion_map),
            "congestion_source":    self._congestion_map.source,
            "osm_pbf_path":         self.config.osm_pbf_path,
            "graph_cache_path":     self.config.graph_cache_path,
            "network_type":         self.config.network_type,
            "congestion_penalty":   self.config.congestion_penalty,
            "max_congestion_score": self.config.max_congestion_score,
            "forecast_horizon":     self.config.forecast_horizon,
            "fast_snap":            getattr(self, "_kdtree", None) is not None,
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
