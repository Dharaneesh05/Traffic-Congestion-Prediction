/**
 * api.js — Frontend API Client
 * ==============================
 * Smart Traffic Congestion System
 * All calls to the FastAPI backend are centralized here.
 */

const API_BASE = "http://127.0.0.1:8000/api";

// ── Helper ──────────────────────────────────────────────────────────────────

const post = async (url, body) => {
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

// ── Existing Endpoints (unchanged) ──────────────────────────────────────────

export const uploadVideo = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}/upload-video`, {
    method: "POST",
    body: formData,
  });
  return response.json();
};

export const setDetection = async (enable) =>
  post(`${API_BASE}/start-detection`, { enable });

export const setTracking = async (enable) =>
  post(`${API_BASE}/start-tracking`, { enable });

export const getTrafficStats = async () =>
  get(`${API_BASE}/get-traffic-stats`);

export const getPrediction = async () =>
  get(`${API_BASE}/predict-congestion`);

export const getRoute = async (originLat, originLon, destLat, destLon) =>
  post(`${API_BASE}/get-route`, {
    origin_lat: originLat,
    origin_lon: originLon,
    dest_lat: destLat,
    dest_lon: destLon,
  });

// ── New Endpoints ────────────────────────────────────────────────────────────

/** Return all Tamil Nadu searchable locations */
export const getLocations = async () =>
  get(`${API_BASE}/locations`);

/** Return 4-camera configuration list */
export const getCameras = async () =>
  get(`${API_BASE}/cameras`);

/** Start a specific camera (background YOLO11 + ByteTrack processing) */
export const startCamera = async (camId) =>
  post(`${API_BASE}/camera/${camId}/start`, {});

/** Stop a specific camera */
export const stopCamera = async (camId) =>
  post(`${API_BASE}/camera/${camId}/stop`, {});

/** Get latest YOLO11 stats for a specific camera */
export const getCameraStats = async (camId) =>
  get(`${API_BASE}/camera/${camId}/stats`);

/**
 * Get the status of the routing service (is OSM graph loaded?).
 */
export const getRoutingStatus = async () =>
  get(`${API_BASE}/routing-status`);

/**
 * Route by human-readable name or coordinates.
 * @param {string} fromName
 * @param {string} toName
 * @param {object} fromCoords - {lat, lon}
 * @param {object} toCoords - {lat, lon}
 */
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
  return post(`${API_BASE}/get-route-by-name`, payload);
};

/** AI recommendations from all active cameras */
export const getAgentReport = async () =>
  get(`${API_BASE}/agent-report`);

/**
 * Aggregate real-time metrics across all 4 cameras.
 * Returns total_vehicles, avg_speed_kmh, avg_congestion_score, class_counts, per_camera[].
 */
export const getCamerasAggregate = async () =>
  get(`${API_BASE}/cameras/aggregate`);

/** Get 4-approach junction status overview and active diversion plans */
export const getJunctionOverview = async (junction = "Sankagiri Junction") =>
  get(`${API_BASE}/junction/overview?junction=${encodeURIComponent(junction)}`);

/** Calculate on-demand authority diversion plan */
export const calculateDiversion = async (junctionName = "Sankagiri Junction", approachId = null, cameraId = null) =>
  post(`${API_BASE}/diversion/calculate`, { junction_name: junctionName, approach_id: approachId, camera_id: cameraId });

/** Fetch active & historical alerts */
export const getAlerts = async () =>
  get(`${API_BASE}/alerts`);

/** Execute police officer field action on an urgent alert */
export const sendOfficerAction = async (alertId, action, officerId = "OFFICER_TN_042", notes = "") =>
  post(`${API_BASE}/alerts/${alertId}/action`, { action, officer_id: officerId, notes });

/** Fetch immutable decision audit log */
export const getAuditLog = async (limit = 50) =>
  get(`${API_BASE}/audit-log?limit=${limit}`);

/** Query Traffic Management Knowledge Base for SOPs and regulatory rules */
export const queryRAGKnowledge = async (q, congestionScore = 0.5) =>
  get(`${API_BASE}/rag/query?q=${encodeURIComponent(q)}&congestion_score=${congestionScore}`);

/** Configure a camera source (IP camera stream URL, webcam index, or video) */
export const configureCamera = async (camId, payload) =>
  post(`${API_BASE}/camera/${camId}/configure`, payload);



