import React from "react";
import { DATA_PROVENANCE } from "../services/tamilNaduTrafficData";

export default function SummaryCards({
  telemetry = null,
  cameraStatus = "offline",
  selectedJunction = null,
  areaJunctions = [],
}) {
  const isCameraOnline = cameraStatus === "online";
  const hasLiveTelemetry = isCameraOnline && telemetry && (telemetry.vehicle_count !== undefined || telemetry.total_tracked !== undefined);

  let vehicleCount = null;
  let avgSpeed = null;
  let density = null;
  let occupancy = null;
  let flow = null;
  let provenance = DATA_PROVENANCE.UNAVAILABLE;

  if (hasLiveTelemetry) {
    // 1. Live camera telemetry has top priority if currently streaming
    vehicleCount = telemetry.vehicle_count ?? telemetry.total_tracked ?? 0;
    avgSpeed = telemetry.average_speed_kmh != null ? `${telemetry.average_speed_kmh.toFixed(1)} km/h` : "--";
    density = telemetry.vehicle_density != null ? `${telemetry.vehicle_density.toFixed(1)} veh/km` : "--";
    occupancy = telemetry.road_occupancy != null ? `${(telemetry.road_occupancy * 100).toFixed(0)}%` : "--";
    flow = (telemetry.traffic_flow_vpm != null || telemetry.flow_per_minute != null)
      ? `${(telemetry.traffic_flow_vpm ?? telemetry.flow_per_minute).toFixed(1)} veh/min`
      : "--";
    provenance = DATA_PROVENANCE.LIVE;
  } else if (selectedJunction && selectedJunction.metrics) {
    // 2. Selected junction metrics
    const m = selectedJunction.metrics;
    vehicleCount = m.vehicleCount != null ? m.vehicleCount : null;
    avgSpeed = m.averageSpeedKmh != null ? `${m.averageSpeedKmh} km/h` : null;
    density = m.density || (m.densityVehKm ? `${m.densityVehKm} veh/km` : null);
    occupancy = m.roadOccupancyPct != null ? `${m.roadOccupancyPct}%` : null;
    flow = m.trafficFlowVpm != null ? `${m.trafficFlowVpm} veh/min` : null;
    provenance = selectedJunction.provenance || DATA_PROVENANCE.SIMULATED;
  } else if (areaJunctions && areaJunctions.length > 0) {
    // 3. Aggregated district values across junctions
    let totalVehicles = 0;
    let speedSum = 0;
    let occupancySum = 0;
    let flowSum = 0;
    let count = 0;

    areaJunctions.forEach((j) => {
      if (j.metrics) {
        totalVehicles += j.metrics.vehicleCount || 0;
        speedSum += j.metrics.averageSpeedKmh || 0;
        occupancySum += j.metrics.roadOccupancyPct || 0;
        flowSum += j.metrics.trafficFlowVpm || 0;
        count++;
      }
    });

    if (count > 0) {
      vehicleCount = totalVehicles;
      avgSpeed = `${(speedSum / count).toFixed(1)} km/h`;
      density = `${(totalVehicles / (count * 2.5)).toFixed(1)} veh/km`;
      occupancy = `${Math.round(occupancySum / count)}%`;
      flow = `${(flowSum / count).toFixed(1)} veh/min`;
      provenance = DATA_PROVENANCE.SIMULATED;
    }
  }

  const badgeColor =
    provenance === DATA_PROVENANCE.LIVE
      ? { bg: "#dcfce7", text: "#15803d", border: "#86efac" }
      : provenance === DATA_PROVENANCE.SIMULATED
      ? { bg: "#fef3c7", text: "#b45309", border: "#fde68a" }
      : { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0" };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xs)",
        padding: "0.625rem 1.25rem",
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "1.25rem",
        alignItems: "center",
      }}
    >
      {/* 1. Vehicles */}
      <div style={{ borderRight: "1px solid var(--border-light)", paddingRight: "1rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          Vehicles Detected
        </div>
        <div style={{ fontSize: "1.625rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1, marginTop: "0.25rem" }}>
          {vehicleCount != null ? vehicleCount : <span style={{ color: "#94a3b8" }}>--</span>}
        </div>
      </div>

      {/* 2. Average Speed */}
      <div style={{ borderRight: "1px solid var(--border-light)", paddingRight: "1rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          Average Speed
        </div>
        <div style={{ fontSize: "1.625rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1, marginTop: "0.25rem" }}>
          {avgSpeed != null ? avgSpeed : <span style={{ color: "#94a3b8" }}>--</span>}
        </div>
      </div>

      {/* 3. Traffic Density */}
      <div style={{ borderRight: "1px solid var(--border-light)", paddingRight: "1rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          Traffic Density
        </div>
        <div style={{ fontSize: "1.625rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1, marginTop: "0.25rem" }}>
          {density != null ? density : <span style={{ color: "#94a3b8" }}>--</span>}
        </div>
      </div>

      {/* 4. Road Occupancy */}
      <div style={{ borderRight: "1px solid var(--border-light)", paddingRight: "1rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          Road Occupancy
        </div>
        <div style={{ fontSize: "1.625rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1, marginTop: "0.25rem" }}>
          {occupancy != null ? occupancy : <span style={{ color: "#94a3b8" }}>--</span>}
        </div>
      </div>

      {/* 5. Traffic Flow */}
      <div>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          Traffic Flow
        </div>
        <div style={{ fontSize: "1.625rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1, marginTop: "0.25rem" }}>
          {flow != null ? flow : <span style={{ color: "#94a3b8" }}>--</span>}
        </div>
      </div>
    </div>
  );
}
