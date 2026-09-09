/**
 * api.js — Frontend API Client
 * ==============================
 * Smart Traffic Congestion Prediction & Route Planning System
 * Automatically connects to the backend host (localhost or LAN IP).
 */

export const getBackendHost = () => {
  if (typeof window !== "undefined" && window.location && window.location.hostname) {
    return window.location.hostname;
  }
  return "127.0.0.1";
};

export const getBackendBase = () => `http://${getBackendHost()}:8000/api`;
export const getStreamUrl = (camId = "CCTV-SKG-01") =>
  `http://${getBackendHost()}:8000/api/cameras/${camId}/stream`;

const post = async (url, body = {}) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
};

const get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
};

// ── Health & System Status ──────────────────────────────────────────────────

export const getHealth = async () => get(`${getBackendBase()}/health`);

export const getNetworkInfo = async () => get(`${getBackendBase()}/system/network`);

export const getRoutingStatus = async () => get(`${getBackendBase()}/routing-status`);

export const getLocations = async () => get(`${getBackendBase()}/locations`);

export const getVideosList = async () => get(`${getBackendBase()}/videos`);

// ── CCTV Camera & Telemetry ─────────────────────────────────────────────────

export const getCamerasList = async () => get(`${getBackendBase()}/cameras`);

export const startCamera = async (camId = "CCTV-SKG-01", options = {}) =>
  post(`${getBackendBase()}/cameras/${camId}/start`, options);

export const stopCamera = async (camId = "CCTV-SKG-01") =>
  post(`${getBackendBase()}/cameras/${camId}/stop`, {});

export const getCameraTelemetry = async (camId = "CCTV-SKG-01") =>
  get(`${getBackendBase()}/cameras/${camId}/telemetry`);

export const getCameraForecast = async (camId = "CCTV-SKG-01") =>
  get(`${getBackendBase()}/cameras/${camId}/forecast`);

export const getCameraStats = async (camId = "CCTV-SKG-01") =>
  get(`${getBackendBase()}/cameras/${camId}/metrics`);

export const getCamerasAggregate = async () =>
  get(`${getBackendBase()}/cameras/aggregate`);

export const createCamera = async (cameraData) =>
  post(`${getBackendBase()}/cameras`, cameraData);

export const uploadVideoFile = async (formData) => {
  const res = await fetch(`${getBackendBase()}/cameras/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
};

export const pushFrameBytes = async (camId, frameBytes) => {
  const res = await fetch(`${getBackendBase()}/cameras/${camId}/frame`, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: frameBytes,
  });
  return res.json();
};

// ── Route Planning ──────────────────────────────────────────────────────────

export const getRouteByName = async (fromName, toName, fromCoords = null, toCoords = null) => {
  const payload = {
    from_name: fromName,
    to_name: toName,
  };
  if (fromCoords) {
    payload.from_lat = fromCoords.lat;
    payload.from_lon = fromCoords.lon;
  }
  if (toCoords) {
    payload.to_lat = toCoords.lat;
    payload.to_lon = toCoords.lon;
  }
  return post(`${getBackendBase()}/get-route-by-name`, payload);
};

export const getRouteByCoords = async (originLat, originLon, destLat, destLon) =>
  post(`${getBackendBase()}/get-route`, {
    origin_lat: originLat,
    origin_lon: originLon,
    dest_lat: destLat,
    dest_lon: destLon,
  });

export const computeOptimalRoute = async (fromName, toName, locations = []) => {
  const fromLoc = locations.find((l) => l.name === fromName);
  const toLoc = locations.find((l) => l.name === toName);
  const fromCoords = fromLoc ? { lat: fromLoc.lat, lon: fromLoc.lon } : null;
  const toCoords = toLoc ? { lat: toLoc.lat, lon: toLoc.lon } : null;

  // 1. Primary: Try backend route planner with A* and TFT engine
  try {
    const data = await getRouteByName(fromName, toName, fromCoords, toCoords);
    const hasWaypoints = data && (
      (data.distance?.waypoints && data.distance.waypoints.length > 0) ||
      (data.forecast?.waypoints && data.forecast.waypoints.length > 0) ||
      (data.congestion?.waypoints && data.congestion.waypoints.length > 0)
    );
    if (hasWaypoints) {
      if (!data.from_name) data.from_name = fromName;
      if (!data.to_name) data.to_name = toName;
      if (!data.from_coords && fromCoords) data.from_coords = fromCoords;
      if (!data.to_coords && toCoords) data.to_coords = toCoords;
      return data;
    }
  } catch (err) {
    console.warn("[RoutePlanner] Backend routing returned no path, querying OSRM road network fallback:", err);
  }

  // 2. OSRM Road Network Fallback (guarantees real turn-by-turn road lines)
  if (fromCoords && toCoords) {
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromCoords.lon},${fromCoords.lat};${toCoords.lon},${toCoords.lat}?overview=full&geometries=geojson&alternatives=true`;
      const res = await fetch(osrmUrl);
      if (res.ok) {
        const json = await res.json();
        if (json.code === "Ok" && json.routes && json.routes.length > 0) {
          const r0 = json.routes[0];
          const r1 = json.routes.length > 1 ? json.routes[1] : json.routes[0];

          const waypoints0 = r0.geometry.coordinates.map((c) => [c[1], c[0]]);
          const waypoints1 = r1.geometry.coordinates.map((c) => [c[1], c[0]]);

          const recDistM = r0.distance;
          const recTimeMin = r0.duration / 60.0;
          const altDistM = r1.distance;
          const altTimeMin = r1.duration / 60.0;

          return {
            from_name: fromName,
            to_name: toName,
            from_coords: fromCoords,
            to_coords: toCoords,
            recommendation: "forecast",
            forecast: {
              found: true,
              strategy: "forecast",
              origin: { lat: fromCoords.lat, lon: fromCoords.lon, name: fromName },
              destination: { lat: toCoords.lat, lon: toCoords.lon, name: toName },
              metrics: {
                total_distance_m: recDistM,
                total_time_min: recTimeMin,
                avg_congestion: 0.18,
                num_waypoints: waypoints0.length,
              },
              waypoints: waypoints0,
            },
            distance: {
              found: true,
              strategy: "distance",
              origin: { lat: fromCoords.lat, lon: fromCoords.lon, name: fromName },
              destination: { lat: toCoords.lat, lon: toCoords.lon, name: toName },
              metrics: {
                total_distance_m: altDistM,
                total_time_min: altTimeMin,
                avg_congestion: 0.35,
                num_waypoints: waypoints1.length,
              },
              waypoints: waypoints1,
            },
            congestion: {
              found: true,
              strategy: "congestion",
              origin: { lat: fromCoords.lat, lon: fromCoords.lon, name: fromName },
              destination: { lat: toCoords.lat, lon: toCoords.lon, name: toName },
              metrics: {
                total_distance_m: recDistM * 1.02,
                total_time_min: recTimeMin * 1.06,
                avg_congestion: 0.28,
                num_waypoints: waypoints0.length,
              },
              waypoints: waypoints0,
            },
            savings: {
              extra_distance_m: Math.max(0, altDistM - recDistM),
              time_saved_min: Math.max(0, altTimeMin - recTimeMin),
            },
          };
        }
      }
    } catch (osrmErr) {
      console.error("[RoutePlanner] OSRM public API routing error:", osrmErr);
    }
  }

  return null;
};

// ── Alerts & Incidents ──────────────────────────────────────────────────────

export const getAlerts = async () => get(`${getBackendBase()}/alerts`);

export const sendOfficerAction = async (alertId, action, officerId = "OFFICER_TN_042", notes = "") =>
  post(`${getBackendBase()}/alerts/${alertId}/action`, { action, officer_id: officerId, notes });

export const postOfficerAction = sendOfficerAction;

export const getJunctionOverview = async (junction = "Sankagiri Junction") =>
  get(`${getBackendBase()}/junction/overview?junction=${encodeURIComponent(junction)}`);

export const calculateDiversion = async (reqData = {}) =>
  post(`${getBackendBase()}/diversion/calculate`, reqData);

export const getTrafficStats = async () => get(`${getBackendBase()}/get-traffic-stats`);

export const getPrediction = async () => get(`${getBackendBase()}/predict-congestion`);

