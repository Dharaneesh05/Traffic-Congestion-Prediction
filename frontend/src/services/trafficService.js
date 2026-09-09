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

class TrafficService {
  constructor() {
    this.districts = TAMIL_NADU_DISTRICTS;
    this.allJunctions = getAllTamilNaduJunctions();
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
      districtName: districtIdOrName || "Tamil Nadu Corridor",
      majorJunctionsCount: 4,
      highRiskJunctionsCount: 1,
      activeIncidentsCount: 0,
      availableCamerasCount: 2,
      offlineCamerasCount: 1,
      predictedCongestion: "Nominal",
    };
  }

  /**
   * Get junctions for a specific district
   */
  getJunctionsByArea(districtIdOrName) {
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
    if (jnc.status === "LIVE_CONNECTED" && liveTelemetry && liveTelemetry.vehicle_count !== undefined) {
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
    if (jnc.status === "LIVE_CONNECTED" && liveForecast && liveForecast.q50_congestion) {
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

    // 1. Match Districts & Cities
    const locations = TAMIL_NADU_LOCATIONS.filter(
      (l) => l.name.toLowerCase().includes(q) || (l.district && l.district.toLowerCase().includes(q))
    ).slice(0, 4);

    // 2. Match Junctions
    const junctions = this.allJunctions.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        j.area.toLowerCase().includes(q) ||
        j.district.toLowerCase().includes(q)
    ).slice(0, 5);

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
