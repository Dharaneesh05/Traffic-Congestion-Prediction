/**
 * api.js — Frontend API Client
 * ==============================
 * Smart Traffic Congestion Prediction & Route Planning System
 * Automatically connects to the backend host (localhost or LAN IP).
 */

import { TAMIL_NADU_LOCATIONS, searchTamilNaduLocations } from "./locations";
import { getAllTamilNaduJunctions } from "./services/tamilNaduTrafficData";

export const getBackendHost = () => {
  if (typeof window !== "undefined" && window.location && window.location.hostname) {
    return window.location.hostname;
  }
  return "127.0.0.1";
};

export const getBackendBase = () => `http://${getBackendHost()}:8000/api`;
export const getStreamUrl = (camId = "CCTV-SKG-01") =>
  `http://${getBackendHost()}:8000/api/cameras/${camId}/stream`;

const post = async (url, body = {}, options = {}) => {
  const { timeoutMs, signal, ...rest } = options;
  let timerId = null;
  let effectiveSignal = signal;

  if (timeoutMs) {
    const controller = new AbortController();
    timerId = setTimeout(() => controller.abort(), timeoutMs);
    effectiveSignal = controller.signal;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: effectiveSignal,
      ...rest,
    });
    if (timerId) clearTimeout(timerId);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || res.statusText);
    }
    return res.json();
  } catch (err) {
    if (timerId) clearTimeout(timerId);
    throw err;
  }
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

export const startCameraAnalysis = async (camId = "CCTV-SKG-01") =>
  post(`${getBackendBase()}/cameras/${camId}/start-analysis`, {});

export const stopCameraAnalysis = async (camId = "CCTV-SKG-01") =>
  post(`${getBackendBase()}/cameras/${camId}/stop-analysis`, {});

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

export const getRouteByName = async (fromName, toName, fromCoords = null, toCoords = null, options = {}) => {
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
  return post(`${getBackendBase()}/get-route-by-name`, payload, { timeoutMs: 1800, ...options });
};

export const getRouteByCoords = async (originLat, originLon, destLat, destLon) =>
  post(`${getBackendBase()}/get-route`, {
    origin_lat: originLat,
    origin_lon: originLon,
    dest_lat: destLat,
    dest_lon: destLon,
  });

function getHaversineDistKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findAlternativeCorridorWaypoint(fromCoords, toCoords) {
  const directD = getHaversineDistKm(fromCoords.lat, fromCoords.lon, toCoords.lat, toCoords.lon);
  const catalog = TAMIL_NADU_LOCATIONS || [];
  let bestLoc = null;
  let bestScore = 999999;

  for (const loc of catalog) {
    if (!loc.lat || !loc.lon) continue;
    const d1 = getHaversineDistKm(fromCoords.lat, fromCoords.lon, loc.lat, loc.lon);
    const d2 = getHaversineDistKm(loc.lat, loc.lon, toCoords.lat, toCoords.lon);
    if (d1 < 4 || d2 < 4) continue;

    const total = d1 + d2;
    const ratio = total / (directD || 1);

    const s = (d1 + d2 + directD) / 2;
    const areaSq = Math.max(0, s * (s - d1) * (s - d2) * (s - directD));
    const perpDist = (2 * Math.sqrt(areaSq)) / (directD || 1);

    if (ratio >= 1.02 && ratio <= 1.38 && perpDist >= 8) {
      const balance = Math.abs(d1 - d2) / (directD || 1);
      const score = Math.abs(ratio - 1.08) + balance * 0.15;
      if (score < bestScore) {
        bestScore = score;
        bestLoc = loc;
      }
    }
  }

  if (bestLoc) return { lat: bestLoc.lat, lon: bestLoc.lon, name: bestLoc.name };

  const midLat = (fromCoords.lat + toCoords.lat) / 2;
  const midLon = (fromCoords.lon + toCoords.lon) / 2;
  const dLat = toCoords.lat - fromCoords.lat;
  const dLon = toCoords.lon - fromCoords.lon;
  const len = Math.sqrt(dLat * dLat + dLon * dLon) || 1;
  const offsetKm = Math.min(25, Math.max(4, directD * 0.12));
  const offsetDeg = offsetKm / 111.0;
  return {
    lat: midLat - (dLon / len) * offsetDeg,
    lon: midLon + (dLat / len) * offsetDeg,
    name: "Parallel Corridor Link",
  };
}

export const computeOptimalRoute = async (fromName, toName, locations = []) => {
  if (!fromName || !toName) return null;

  // 1. Comprehensive Tamil Nadu locations, junctions, and dynamic geocoding
  const junctions = getAllTamilNaduJunctions().map((j) => ({
    name: j.name,
    lat: j.coords ? j.coords[1] : undefined,
    lon: j.coords ? j.coords[0] : undefined,
    district: j.district,
  }));

  const allLocs = [...locations, ...TAMIL_NADU_LOCATIONS, ...junctions];
  const findLoc = (name) => {
    const q = (name || "").toLowerCase().trim();
    return (
      allLocs.find((l) => l.name?.toLowerCase() === q) ||
      allLocs.find((l) => q.includes(l.name?.toLowerCase()) || l.name?.toLowerCase().includes(q))
    );
  };

  const fromLoc = findLoc(fromName);
  const toLoc = findLoc(toName);

  let fromCoords = fromLoc?.lat != null && fromLoc?.lon != null ? { lat: fromLoc.lat, lon: fromLoc.lon } : null;
  let toCoords = toLoc?.lat != null && toLoc?.lon != null ? { lat: toLoc.lat, lon: toLoc.lon } : null;

  // Dynamic geocoding fallback for any unlisted location in Tamil Nadu
  if (!fromCoords) {
    try {
      const geo = await searchTamilNaduLocations(fromName);
      if (geo && geo.length > 0 && geo[0].lat != null) {
        fromCoords = { lat: geo[0].lat, lon: geo[0].lon };
      }
    } catch (e) {
      console.warn("Geocoding failed for:", fromName);
    }
  }

  if (!toCoords) {
    try {
      const geo = await searchTamilNaduLocations(toName);
      if (geo && geo.length > 0 && geo[0].lat != null) {
        toCoords = { lat: geo[0].lat, lon: geo[0].lon };
      }
    } catch (e) {
      console.warn("Geocoding failed for:", toName);
    }
  }

  if (!fromCoords || !toCoords) {
    return {
      error: "Route could not be calculated. Check the locations and try again.",
      from_name: fromName,
      to_name: toName,
    };
  }

  // Helper to format clear route options and operational traffic condition
  const formatResult = (raw) => {
    const recKey = raw.recommendation || "forecast";
    const rec = raw[recKey] || raw.forecast || raw.congestion || raw.distance;
    const altCandidate = recKey === "distance" ? (raw.congestion || raw.forecast) : (raw.congestion || raw.distance);

    const recDistKm = rec?.metrics?.total_distance_m != null
      ? (rec.metrics.total_distance_m / 1000.0).toFixed(1)
      : rec?.distance_km != null ? rec.distance_km : null;

    const recTimeMin = rec?.metrics?.total_time_min != null
      ? Math.round(rec.metrics.total_time_min)
      : rec?.time_min != null ? rec.time_min : null;

    // Real traffic condition assessment
    let recCondition = "Free Flow";
    const recCongestion = rec?.metrics?.avg_congestion ?? 0.2;
    if (recCongestion > 0.6) {
      recCondition = "Heavy Congestion";
    } else if (recCongestion > 0.35) {
      recCondition = "Moderate Traffic";
    } else {
      recCondition = "Free Flow";
    }

    // Determine if a genuinely different alternative route exists
    let hasGenuineAlt = false;
    let finalAltWaypoints = [];
    let calculatedAltDist = null;
    let calculatedAltTime = null;
    let altCondition = "Moderate Traffic";

    if (altCandidate && altCandidate.found && altCandidate.waypoints && altCandidate.waypoints.length > 0) {
      finalAltWaypoints = altCandidate.waypoints;
      let isSameGeometry = false;
      if (finalAltWaypoints.length === rec?.waypoints?.length && finalAltWaypoints.length > 0) {
        isSameGeometry = finalAltWaypoints.every((p, i) => {
          const rP = rec.waypoints[i];
          return Math.abs(p[0] - rP[0]) < 0.0001 && Math.abs(p[1] - rP[1]) < 0.0001;
        });
      }

      const altDistanceM = altCandidate.metrics?.total_distance_m || 0;
      const recDistanceM = rec?.metrics?.total_distance_m || 0;
      const distDiffM = Math.abs(altDistanceM - recDistanceM);
      const altDurationMin = altCandidate.metrics?.total_time_min != null
        ? Math.round(altCandidate.metrics.total_time_min)
        : (altCandidate.time_min != null ? altCandidate.time_min : null);

      if (!isSameGeometry && (distDiffM > 250 || (altDurationMin != null && Math.abs(altDurationMin - recTimeMin) >= 2))) {
        hasGenuineAlt = true;
        calculatedAltDist = altDistanceM > 0 ? (altDistanceM / 1000.0).toFixed(1) : altCandidate.distance_km;
        calculatedAltTime = altDurationMin != null ? altDurationMin : altCandidate.time_min;
        const altCongestion = altCandidate.metrics?.avg_congestion ?? 0.35;
        if (altCongestion > 0.6) {
          altCondition = "Heavy Delay";
        } else if (altCongestion > 0.35) {
          altCondition = "Moderate Traffic";
        } else {
          altCondition = "Free Flow";
        }
      }
    }

    // Determine if a congested route option exists
    let hasCongested = false;
    let finalCongestedWaypoints = [];
    let calculatedCongestedDist = null;
    let calculatedCongestedTime = null;
    if (raw.congested && raw.congested.found && raw.congested.waypoints && raw.congested.waypoints.length > 0) {
      hasCongested = true;
      finalCongestedWaypoints = raw.congested.waypoints;
      calculatedCongestedDist = raw.congested.metrics?.total_distance_m != null
        ? (raw.congested.metrics.total_distance_m / 1000.0).toFixed(1)
        : raw.congested.distance_km;
      calculatedCongestedTime = raw.congested.metrics?.total_time_min != null
        ? Math.round(raw.congested.metrics.total_time_min)
        : raw.congested.time_min;
    }

    let usefulReason = null;
    if (hasGenuineAlt && calculatedAltTime && calculatedAltTime > recTimeMin) {
      usefulReason = `Shorter travel time (saves ${calculatedAltTime - recTimeMin} min)`;
    } else if (rec?.metrics?.avg_congestion != null && rec.metrics.avg_congestion < 0.3) {
      usefulReason = "Lower congestion corridor";
    } else {
      usefulReason = "Optimal travel corridor";
    }

    return {
      ...raw,
      from_name: fromName,
      to_name: toName,
      from_coords: fromCoords,
      to_coords: toCoords,
      recommendation: "recommended",
      useful_reason: usefulReason,
      recommended: {
        name: rec?.name || "Main Highway Corridor",
        strategy: "recommended",
        distance_km: recDistKm,
        time_min: recTimeMin,
        traffic_condition: recCondition,
        status: "RECOMMENDED",
        waypoints: rec?.waypoints || [],
      },
      alternative: hasGenuineAlt ? {
        name: altCandidate?.name || "Bypass Arterial Corridor",
        strategy: "alternative",
        distance_km: calculatedAltDist,
        time_min: calculatedAltTime,
        traffic_condition: altCondition,
        status: "ALTERNATIVE",
        waypoints: finalAltWaypoints,
      } : null,
      congested: hasCongested ? {
        name: raw.congested?.name || "City Arterial Corridor",
        strategy: "congested",
        distance_km: calculatedCongestedDist,
        time_min: calculatedCongestedTime,
        traffic_condition: "Heavy Congestion",
        status: "CONGESTED",
        waypoints: finalCongestedWaypoints,
      } : null,
      // Legacy fields preserved for backward compatibility
      forecast: rec,
      distance: raw.distance || rec,
      congestion: hasGenuineAlt ? altCandidate : null,
    };
  };

  // 1. Primary: Try backend route planner with A* and traffic graph (with 2.5s timeout)
  try {
    const data = await getRouteByName(fromName, toName, fromCoords, toCoords, { timeoutMs: 2500 });
    const hasWaypoints = data && (
      (data.distance?.waypoints && data.distance.waypoints.length > 0) ||
      (data.forecast?.waypoints && data.forecast.waypoints.length > 0) ||
      (data.congestion?.waypoints && data.congestion.waypoints.length > 0)
    );
    if (hasWaypoints) {
      return formatResult(data);
    }
  } catch (err) {
    console.warn("[RoutePlanner] Backend routing timed out or unavailable, querying OSRM road network fallback:", err);
  }

  // 2. OSRM Road Network (guarantees real turn-by-turn road lines with 5s timeout)
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromCoords.lon},${fromCoords.lat};${toCoords.lon},${toCoords.lat}?overview=full&geometries=geojson&alternatives=true`;
    const controller = new AbortController();
    const osrmTimer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(osrmTimer);
    if (res.ok) {
      const json = await res.json();
      if (json.code === "Ok" && json.routes && json.routes.length > 0) {
        const routes = json.routes;
        const r0 = routes[0];
        const waypoints0 = r0.geometry.coordinates.map((c) => [c[1], c[0]]);

        // Snap endpoints exactly to origin and destination pins
        if (waypoints0.length > 0) {
          waypoints0[0] = [fromCoords.lat, fromCoords.lon];
          waypoints0[waypoints0.length - 1] = [toCoords.lat, toCoords.lon];
        }

        // Check if a distinct alternative route was returned by OSRM
        let r1 = null;
        let waypoints1 = null;
        if (routes.length > 1) {
          const cand = routes[1];
          const distDiff = Math.abs(cand.distance - r0.distance);
          const timeDiff = Math.abs(cand.duration - r0.duration);
          if (distDiff > 200 || timeDiff > 60) {
            r1 = cand;
            waypoints1 = cand.geometry.coordinates.map((c) => [c[1], c[0]]);
            if (waypoints1.length > 0) {
              waypoints1[0] = [fromCoords.lat, fromCoords.lon];
              waypoints1[waypoints1.length - 1] = [toCoords.lat, toCoords.lon];
            }
          }
        }

        // If no distinct alternative was found directly, query via an authentic Tamil Nadu highway waypoint
        if (!r1) {
          const altWp = findAlternativeCorridorWaypoint(fromCoords, toCoords);
          if (altWp) {
            try {
              const altUrl = `https://router.project-osrm.org/route/v1/driving/${fromCoords.lon},${fromCoords.lat};${altWp.lon},${altWp.lat};${toCoords.lon},${toCoords.lat}?overview=full&geometries=geojson`;
              const altCtrl = new AbortController();
              const altTimer = setTimeout(() => altCtrl.abort(), 3500);
              const altRes = await fetch(altUrl, { signal: altCtrl.signal });
              clearTimeout(altTimer);
              if (altRes.ok) {
                const altJson = await altRes.json();
                if (altJson.code === "Ok" && altJson.routes && altJson.routes.length > 0) {
                  r1 = altJson.routes[0];
                  waypoints1 = r1.geometry.coordinates.map((c) => [c[1], c[0]]);
                  if (waypoints1.length > 0) {
                    waypoints1[0] = [fromCoords.lat, fromCoords.lon];
                    waypoints1[waypoints1.length - 1] = [toCoords.lat, toCoords.lon];
                  }
                }
              }
            } catch (viaErr) {
              console.warn("Alternative waypoint routing fallback error:", viaErr);
            }
          }
        }

        // Check for 3rd congested candidate route
        let r_congested = null;
        let waypointsCongested = null;
        if (routes.length > 2) {
          const cand2 = routes[2];
          if (Math.abs(cand2.distance - r0.distance) > 200 || Math.abs(cand2.duration - r0.duration) > 60) {
            r_congested = cand2;
            waypointsCongested = cand2.geometry.coordinates.map((c) => [c[1], c[0]]);
            if (waypointsCongested.length > 0) {
              waypointsCongested[0] = [fromCoords.lat, fromCoords.lon];
              waypointsCongested[waypointsCongested.length - 1] = [toCoords.lat, toCoords.lon];
            }
          }
        }

        // Check for shortest route
        let r_short = r0;
        let waypointsShort = waypoints0;
        if (r1 && r1.distance < r0.distance) {
          r_short = r1;
          waypointsShort = waypoints1;
        }

        const rawData = {
          from_name: fromName,
          to_name: toName,
          from_coords: fromCoords,
          to_coords: toCoords,
          recommendation: "forecast",
          forecast: {
            found: true,
            strategy: "forecast",
            name: "Primary Highway Corridor",
            origin: fromCoords,
            destination: toCoords,
            metrics: {
              total_distance_m: r0.distance,
              total_time_min: r0.duration / 60.0,
              avg_congestion: 0.18,
              num_waypoints: waypoints0.length,
            },
            waypoints: waypoints0,
          },
          distance: {
            found: true,
            strategy: "distance",
            name: "Shortest Road Route",
            origin: fromCoords,
            destination: toCoords,
            metrics: {
              total_distance_m: r_short.distance,
              total_time_min: r_short.duration / 60.0,
              avg_congestion: 0.35,
              num_waypoints: waypointsShort.length,
            },
            waypoints: waypointsShort,
          },
          congestion: r1 ? {
            found: true,
            strategy: "congestion",
            name: "Alternative Bypass Route",
            origin: fromCoords,
            destination: toCoords,
            metrics: {
              total_distance_m: r1.distance,
              total_time_min: r1.duration / 60.0,
              avg_congestion: 0.28,
              num_waypoints: waypoints1.length,
            },
            waypoints: waypoints1,
          } : null,
          congested: r_congested ? {
            found: true,
            strategy: "congested",
            name: "Arterial Corridor",
            origin: fromCoords,
            destination: toCoords,
            metrics: {
              total_distance_m: r_congested.distance,
              total_time_min: r_congested.duration / 60.0,
              avg_congestion: 0.72,
              num_waypoints: waypointsCongested.length,
            },
            waypoints: waypointsCongested,
          } : null,
        };

        return formatResult(rawData);
      }
    }
  } catch (osrmErr) {
    console.error("[RoutePlanner] OSRM public API routing error:", osrmErr);
  }

  // If both backend routing and OSRM failed, return error without fabricating fake straight/arc lines
  return {
    error: "Route could not be calculated. Check the locations and try again.",
    from_name: fromName,
    to_name: toName,
  };
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

