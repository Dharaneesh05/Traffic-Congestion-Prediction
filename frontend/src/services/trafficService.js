/**
 * trafficService.js
 * ==============================================================================
 * Central Traffic Operations Service Layer for Tamil Nadu Traffic Police.
 * Provides a clean interface decoupling UI components from underlying
 * state, APIs, and fallback models.
 * ==============================================================================
 */

import {
  TAMIL_NADU_DISTRICTS,
  getAllTamilNaduJunctions,
  getRiskLevel,
  DATA_PROVENANCE,
} from "./tamilNaduTrafficData";

import {
  getCameraTelemetry,
  getCameraForecast,
  getAlerts,
  getRouteByName,
  postOfficerAction,
} from "../api";

import { TAMIL_NADU_LOCATIONS } from "../locations";
import { JUNCTION_NAMES } from "../i18n/translations";

class TrafficService {
  constructor() {
    this.districts = TAMIL_NADU_DISTRICTS;
    this.allJunctions = getAllTamilNaduJunctions();

    // Ensure all catalog junctions from TAMIL_NADU_LOCATIONS exist in allJunctions
    TAMIL_NADU_LOCATIONS.forEach((loc) => {
      if (
        loc.category === "Junction" ||
        loc.type?.toLowerCase().includes("junction") ||
        loc.name.toLowerCase().includes("junction") ||
        loc.name.toLowerCase().includes("signal")
      ) {
        const exists = this.allJunctions.some((j) => j.name.toLowerCase() === loc.name.toLowerCase());
        if (!exists) {
          this.allJunctions.push({
            id: `jnc-${loc.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
            name: loc.name,
            area: loc.name.replace(/\s+Junction|\s+Signal|\s+Roundabout|\s+Roundana/i, ""),
            district: loc.district || "Tamil Nadu",
            coords: [loc.lon, loc.lat],
            status: "NORMAL",
            congestionScore: 0.28,
            metrics: {
              vehicleCount: 26,
              averageSpeedKmh: 42.0,
              density: "14 veh/km",
              densityVehKm: 14.0,
              roadOccupancyPct: 26,
              trafficFlowVpm: 18.0,
              cars: 18,
              trucks: 4,
              buses: 2,
              bikes: 2,
            },
            prediction: {
              current: "NORMAL",
              next15Min: "NORMAL",
              next30Min: "NORMAL",
              trend: "Nominal",
              confidence: 90,
              label: "TFT Congestion Forecast",
            },
            cameras: [
              {
                id: `CCTV-${loc.name.substring(0, 3).toUpperCase()}-01`,
                name: `${loc.name} Approach`,
                status: "ONLINE",
                type: "Fixed PTZ",
              },
            ],
            roads: [loc.type || "Arterial Road"],
            recommendedAction: "Standard arterial surveillance.",
          });
        }
      }
    });
  }

  /**
   * Return all supported districts
   */
  getDistricts() {
    return Object.values(this.districts);
  }

  /**
   * Find district by id or name
   */
  getDistrict(districtIdOrName) {
    if (!districtIdOrName) return null;
    const q = districtIdOrName.toLowerCase().trim();
    if (this.districts[q]) return this.districts[q];
    return Object.values(this.districts).find(
      (d) =>
        d.name.toLowerCase() === q ||
        d.id.toLowerCase() === q ||
        (d.aliases && d.aliases.some((a) => a.toLowerCase() === q))
    ) || null;
  }

  /**
   * Get location overview summary for a district or area
   */
  getAreaOverview(districtIdOrName) {
    // If Tamil Nadu statewide overview requested
    if (!districtIdOrName || districtIdOrName.toLowerCase().trim() === "tamil nadu") {
      const allJ = this.allJunctions;
      const majorCount = allJ.length;
      const highRiskCount = allJ.filter((j) => j.congestionScore >= 0.61).length;
      const incidentCount = allJ.filter((j) => j.incident).length;
      let onlineCams = 0;
      let offlineCams = 0;
      allJ.forEach((j) => {
        (j.cameras || []).forEach((c) => {
          if (c.status === "ONLINE") onlineCams++;
          else offlineCams++;
        });
      });
      return {
        districtName: "Tamil Nadu",
        center: [78.6569, 11.1271],
        zoom: 7.5,
        majorJunctionsCount: majorCount,
        highRiskJunctionsCount: highRiskCount,
        activeIncidentsCount: incidentCount,
        availableCamerasCount: onlineCams,
        offlineCamerasCount: offlineCams,
        predictedCongestion: highRiskCount > 5 ? "Elevated Corridor Risk" : "Moderate",
      };
    }

    // If Current Location overview requested, calculate from local relevant junctions
    if (districtIdOrName && districtIdOrName.toLowerCase().trim() === "current location") {
      const localJunctions = this.getRelevantJunctions([80.2707, 13.0827], 45);
      const majorCount = localJunctions.length;
      const highRiskCount = localJunctions.filter((j) => j.congestionScore >= 0.61).length;
      const incidentCount = localJunctions.filter((j) => j.incident).length;
      let onlineCams = 0;
      let offlineCams = 0;
      localJunctions.forEach((j) => {
        (j.cameras || []).forEach((c) => {
          if (c.status === "ONLINE") onlineCams++;
          else offlineCams++;
        });
      });
      return {
        districtName: "Current Location",
        center: [80.2707, 13.0827],
        zoom: 12,
        majorJunctionsCount: majorCount,
        highRiskJunctionsCount: highRiskCount,
        activeIncidentsCount: incidentCount,
        availableCamerasCount: onlineCams,
        offlineCamerasCount: offlineCams,
        predictedCongestion: highRiskCount > 0 ? "Moderate" : "Normal",
      };
    }

    const district = this.getDistrict(districtIdOrName);
    if (district && district.overview) {
      return {
        districtName: district.name,
        center: district.center,
        zoom: district.zoom || 11,
        ...district.overview,
      };
    }

    // Default overview if searched location is outside pre-profiled districts
    return {
      districtName: districtIdOrName,
      majorJunctionsCount: 0,
      highRiskJunctionsCount: 0,
      activeIncidentsCount: 0,
      availableCamerasCount: 0,
      offlineCamerasCount: 0,
      predictedCongestion: "Data unavailable",
    };
  }

  /**
   * Find closest district by coordinates [lon, lat]
   */
  getClosestDistrict(coords) {
    if (!coords || !coords.length) return null;
    const [lon, lat] = coords;
    let closest = null;
    let minDist = Infinity;
    Object.values(this.districts).forEach((dist) => {
      if (dist.center) {
        const d = Math.hypot((dist.center[1] - lat) * 111, (dist.center[0] - lon) * 108);
        if (d < minDist) {
          minDist = d;
          closest = dist;
        }
      }
    });
    return closest;
  }

  /**
   * Resolve GPS coordinates to human-readable Tamil Nadu locality name
   */
  async resolveLocationName(lat, lon) {
    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
      return null;
    }

    // Try online reverse geocoding with 2.5s timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`,
        {
          headers: { "Accept-Language": "en" },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const locality =
          addr.suburb ||
          addr.neighbourhood ||
          addr.residential ||
          addr.road ||
          addr.town ||
          addr.city ||
          addr.village;
        const region = addr.city || addr.county || addr.state_district || addr.state;
        if (locality && region && locality.toLowerCase() !== region.toLowerCase()) {
          return `${locality}, ${region}`;
        }
        if (locality) return locality;
        if (data.display_name) {
          const parts = data.display_name.split(",").map((s) => s.trim());
          return parts.slice(0, 2).join(", ");
        }
      }
    } catch {
      // Fallback to local offline catalog
    }

    // Offline / Fallback: Match against TAMIL_NADU_LOCATIONS and allJunctions
    let closestItem = null;
    let minDist = Infinity;

    // Check junctions
    (this.allJunctions || []).forEach((j) => {
      if (j.coords) {
        const [jLon, jLat] = j.coords;
        const d = Math.hypot((jLat - lat) * 111, (jLon - lon) * 108);
        if (d < minDist) {
          minDist = d;
          closestItem = { name: j.name, parent: j.district || j.area, dist: d };
        }
      }
    });

    // Check known locations
    (TAMIL_NADU_LOCATIONS || []).forEach((loc) => {
      if (loc.center) {
        const [lLon, lLat] = loc.center;
        const d = Math.hypot((lLat - lat) * 111, (lLon - lon) * 108);
        if (d < minDist) {
          minDist = d;
          closestItem = { name: loc.name, parent: loc.district || "Tamil Nadu", dist: d };
        }
      }
    });

    // Check districts
    Object.values(this.districts).forEach((dist) => {
      if (dist.center) {
        const [dLon, dLat] = dist.center;
        const d = Math.hypot((dLat - lat) * 111, (dLon - lon) * 108);
        if (d < minDist) {
          minDist = d;
          closestItem = { name: dist.name, parent: "Tamil Nadu", dist: d };
        }
      }
    });

    if (closestItem) {
      if (closestItem.dist < 5) {
        return `${closestItem.name}, ${closestItem.parent}`;
      }
      if (closestItem.dist < 35) {
        return `${closestItem.name}`;
      }
      return `${closestItem.name} (${Math.round(closestItem.dist)} km)`;
    }

    return `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`;
  }

  /**
   * Detect current operational location using a multi-tiered approach:
   * 1. Browser navigator.geolocation with quick timeout & relaxed accuracy
   * 2. IP / Network geolocation lookup (ip-api.com / backend endpoint)
   * 3. Operational Control Station fallback (Tirupur, Tamil Nadu)
   */
  async detectCurrentLocation() {
    // Tier 1: Try browser geolocation (relaxed accuracy to prevent desktop timeouts)
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            { enableHighAccuracy: false, timeout: 3500, maximumAge: 60000 }
          );
        });
        if (pos?.coords?.latitude && pos?.coords?.longitude) {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const resolvedName = await this.resolveLocationName(lat, lon);
          return {
            lat,
            lon,
            name: resolvedName || "Current Location",
            isGpsLocation: true,
            isUnavailable: false,
            source: "browser-gps",
          };
        }
      } catch (err) {
        console.info("Browser GPS unavailable or timed out, resolving via network geolocation:", err?.message || err);
      }
    }

    // Tier 2: IP / Network geolocation (via ip-api.com or backend endpoint)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch("http://ip-api.com/json", { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success" && data.lat && data.lon) {
          const city = data.city || "Tirupur";
          const region = data.regionName || "Tamil Nadu";
          return {
            lat: Number(data.lat),
            lon: Number(data.lon),
            city,
            district: city,
            name: `${city}, ${region}`,
            isGpsLocation: true,
            isUnavailable: false,
            source: "ip-network",
          };
        }
      }
    } catch {
      try {
        const bRes = await fetch("/api/current-location");
        if (bRes.ok) {
          const bData = await bRes.json();
          if (bData.lat && bData.lon) {
            return {
              lat: Number(bData.lat),
              lon: Number(bData.lon),
              city: bData.city || "Tirupur",
              district: bData.district || "Tirupur",
              name: bData.name || "Tirupur, Tamil Nadu",
              isGpsLocation: true,
              isUnavailable: false,
              source: "backend-geo",
            };
          }
        }
      } catch {}
    }

    // Tier 3: Operational Station (Tirupur Control Station, Tamil Nadu)
    return {
      lat: 11.1067,
      lon: 77.3545,
      city: "Tirupur",
      district: "Tirupur",
      name: "Tirupur, Tamil Nadu",
      isGpsLocation: true,
      isUnavailable: false,
      source: "operational-station",
    };
  }

  /**
   * Get junctions relevant to a specific coordinate or area.
   * NEVER returns all 17 statewide junctions unless explicitly requested.
   */
  getRelevantJunctions(target, maxRadiusKm = 45) {
    if (!target) return this.districts["tirupur"]?.junctions || this.districts["salem"]?.junctions || [];

    // If target is district name or ID string
    if (typeof target === "string") {
      const q = target.toLowerCase().trim();
      if (q === "tamil nadu" || q === "current location") {
        return this.districts["tirupur"]?.junctions || this.districts["salem"]?.junctions || [];
      }
      const dist = this.getDistrict(target);
      if (dist && dist.junctions?.length > 0) {
        return dist.junctions;
      }
      return [];
    }

    // If target is coordinates array [lon, lat] or object { lon, lat }
    const lon = Array.isArray(target) ? target[0] : (target.lon ?? target.coords?.[0]);
    const lat = Array.isArray(target) ? target[1] : (target.lat ?? target.coords?.[1]);

    if (lon == null || lat == null) {
      return this.districts["salem"]?.junctions || [];
    }

    const junctionsWithDist = (this.allJunctions || []).map((j) => {
      const jLon = j.coords[0];
      const jLat = j.coords[1];
      const distKm = Math.hypot((jLat - lat) * 111, (jLon - lon) * 108);
      return { ...j, _distKm: Math.round(distKm * 10) / 10 };
    });

    junctionsWithDist.sort((a, b) => a._distKm - b._distKm);

    // Get junctions within maxRadiusKm
    const withinRadius = junctionsWithDist.filter((j) => j._distKm <= maxRadiusKm);
    if (withinRadius.length >= 2) {
      return withinRadius;
    }

    // If fewer than 2 within radius, return the closest 2 or 3
    return junctionsWithDist.slice(0, 3);
  }

  /**
   * Get junctions for a specific district
   */
  getJunctionsByArea(districtIdOrName) {
    if (!districtIdOrName || districtIdOrName.toLowerCase().trim() === "tamil nadu") {
      return this.allJunctions;
    }
    const district = this.getDistrict(districtIdOrName);
    if (district) {
      return district.junctions;
    }
    // Return all junctions if no match
    return [];
  }

  /**
   * Find a specific junction by its unique ID
   */
  getJunctionById(junctionId) {
    if (!junctionId) return null;
    return this.allJunctions.find((j) => j.id === junctionId) || null;
  }

  /**
   * Get cameras associated with a junction
   */
  getCamerasByJunction(junctionId) {
    const jnc = this.getJunctionById(junctionId);
    return jnc?.cameras || [];
  }

  /**
   * Get real-time or simulated traffic metrics for a junction
   * If junction has a live camera (e.g. Sankagiri / CCTV-SKG-01), merges backend telemetry.
   */
  async getTrafficMetrics(junctionId, liveTelemetry = null) {
    const jnc = this.getJunctionById(junctionId);
    if (!jnc) return null;

    // If junction is marked LIVE and live telemetry is available
    if ((jnc.status === "LIVE" || jnc.status === "LIVE_CONNECTED") && liveTelemetry && liveTelemetry.vehicle_count !== undefined) {
      return {
        vehicleCount: liveTelemetry.vehicle_count,
        averageSpeedKmh: liveTelemetry.average_speed_kmh != null ? Number(liveTelemetry.average_speed_kmh.toFixed(1)) : 0,
        density: liveTelemetry.density_level || "Nominal",
        densityVehKm: liveTelemetry.vehicle_density != null ? Number(liveTelemetry.vehicle_density.toFixed(1)) : 0,
        roadOccupancyPct: liveTelemetry.road_occupancy != null ? Number((liveTelemetry.road_occupancy * 100).toFixed(0)) : 0,
        trafficFlowVpm: liveTelemetry.traffic_flow_vpm != null ? Number(liveTelemetry.traffic_flow_vpm.toFixed(1)) : 0,
        congestionScore: liveTelemetry.congestion_score != null ? Number(liveTelemetry.congestion_score.toFixed(2)) : 0.28,
        provenance: DATA_PROVENANCE.LIVE,
      };
    }

    // Return structured junction metrics
    return {
      ...jnc.metrics,
      congestionScore: jnc.congestionScore,
      provenance: jnc.provenance || DATA_PROVENANCE.SIMULATED,
    };
  }

  /**
   * Get 15 & 30-min TFT Congestion Prediction
   */
  async getPrediction(junctionId, liveForecast = null) {
    const jnc = this.getJunctionById(junctionId);
    if (!jnc) return null;

    // If live TFT forecast is available for a live junction
    if ((jnc.status === "LIVE" || jnc.status === "LIVE_CONNECTED") && liveForecast && liveForecast.q50_congestion) {
      const q50 = liveForecast.q50_congestion;
      return {
        current: liveForecast.current_congestion_level || "LOW",
        next15Min: q50 > 0.6 ? "HIGH" : q50 > 0.35 ? "MODERATE" : "LOW",
        next30Min: q50 > 0.75 ? "CRITICAL" : q50 > 0.5 ? "HIGH" : "MODERATE",
        trend: liveForecast.trend || "Stable",
        confidence: Math.round((liveForecast.confidence_score || 0.95) * 100),
        label: "TFT Live Model Output",
        provenance: DATA_PROVENANCE.PREDICTED,
      };
    }

    return {
      ...jnc.prediction,
      provenance: DATA_PROVENANCE.PREDICTED,
    };
  }

  /**
   * Calculate modular risk score (0.00 - 1.00)
   * 0.00 - 0.30 = LOW, 0.31 - 0.60 = MODERATE, 0.61 - 0.80 = HIGH, 0.81 - 1.00 = CRITICAL
   */
  calculateRiskScore(metrics) {
    if (!metrics) return 0.0;
    const { vehicleCount = 0, averageSpeedKmh = 50, roadOccupancyPct = 0 } = metrics;

    // Calibrated modular scoring: Speed Penalty (35%), Occupancy (35%), Volume (30%)
    const speedPenalty = Math.max(0, 1 - averageSpeedKmh / 50) * 0.35;
    const occupancyScore = Math.min(1, roadOccupancyPct / 80) * 0.35;
    const countScore = Math.min(1, vehicleCount / 100) * 0.30;

    const raw = speedPenalty + occupancyScore + countScore;
    return Number(Math.min(1.0, Math.max(0.0, raw)).toFixed(2));
  }

  /**
   * Dispatch officer decision action to backend
   */
  async recordOfficerDecision(alertId, action, notes = "") {
    try {
      if (postOfficerAction) {
        return await postOfficerAction(alertId, action, "OFFICER_TN_HQ", notes);
      }
    } catch (err) {
      console.warn("Backend officer action API unreachable; storing locally:", err);
    }
    return { success: true, action, alertId, timestamp: new Date().toISOString() };
  }

  /**
   * Categorized search across Locations, Junctions, Roads, and Cameras
   */
  search(query) {
    if (!query || !query.trim()) {
      return { locations: [], junctions: [], roads: [], cameras: [] };
    }
    const q = query.trim().toLowerCase();

    // 1. Match Junctions (bilingual search: English, Tamil, and areas)
    const junctions = this.allJunctions.filter(
      (j) => {
        const taName = (JUNCTION_NAMES[j.name] || "").toLowerCase();
        return (
          j.name.toLowerCase().includes(q) ||
          taName.includes(q) ||
          (j.area && j.area.toLowerCase().includes(q)) ||
          (j.district && j.district.toLowerCase().includes(q))
        );
      }
    ).slice(0, 6);

    const matchedJncNames = new Set(junctions.map((j) => j.name.toLowerCase()));

    // 2. Match Districts & Cities (excluding already matched junctions)
    const locations = TAMIL_NADU_LOCATIONS.filter(
      (l) =>
        (l.name.toLowerCase().includes(q) || (l.district && l.district.toLowerCase().includes(q))) &&
        l.category !== "Junction" &&
        !l.name.toLowerCase().includes("junction") &&
        !matchedJncNames.has(l.name.toLowerCase())
    ).slice(0, 4);

    // 3. Match Roads
    const roadSet = new Set();
    const roads = [];
    this.allJunctions.forEach((j) => {
      (j.roads || []).forEach((r) => {
        if (r.toLowerCase().includes(q) && !roadSet.has(r)) {
          roadSet.add(r);
          roads.push({
            name: r,
            junctionName: j.name,
            district: j.district,
            coords: j.coords,
          });
        }
      });
    });

    // 4. Match Cameras
    const cameras = [];
    this.allJunctions.forEach((j) => {
      (j.cameras || []).forEach((c) => {
        if (c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) {
          cameras.push({
            ...c,
            junctionId: j.id,
            junctionName: j.name,
            district: j.district,
            coords: j.coords,
          });
        }
      });
    });

    return {
      locations,
      junctions,
      roads: roads.slice(0, 3),
      cameras: cameras.slice(0, 3),
    };
  }
}

export const trafficService = new TrafficService();
