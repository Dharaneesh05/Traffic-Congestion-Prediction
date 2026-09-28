import React from "react";
import { useSettings } from "../context/SettingsContext";

export default function SummaryCards({
  telemetry = null,
  cameraStatus = "offline",
  selectedJunction = null,
  areaJunctions = [],
  activeCameraId = null,
  districtName = "Tamil Nadu",
  selectedLocation = null,
}) {
  const { t } = useSettings();
  const isCameraOnline = cameraStatus === "online";
  const hasLiveTelemetry = isCameraOnline && telemetry && (telemetry.vehicle_count !== undefined || telemetry.total_tracked !== undefined);

  let locationScope = "CURRENT LOCATION";
  if (hasLiveTelemetry) {
    locationScope = activeCameraId ? activeCameraId : "LIVE TELEMETRY";
  } else if (districtName && districtName.toLowerCase() !== "tamil nadu") {
    locationScope = `${districtName.toUpperCase()} AREA STATUS`;
  } else if (selectedLocation?.name && selectedLocation.name.toLowerCase() !== "tamil nadu") {
    locationScope = `${selectedLocation.name.toUpperCase()} AREA STATUS`;
  } else {
    locationScope = "AREA TRAFFIC STATUS";
  }

  let vehicleCount = null;
  let avgSpeed = null;
  let density = null;
  let occupancy = null;
  let flow = null;

  if (hasLiveTelemetry) {
    // 1. Live camera telemetry from active video/RTSP analysis
    vehicleCount = telemetry.vehicle_count ?? telemetry.total_tracked;
    avgSpeed = telemetry.average_speed_kmh != null ? `${telemetry.average_speed_kmh.toFixed(1)} km/h` : null;
    density = telemetry.vehicle_density != null ? `${telemetry.vehicle_density.toFixed(1)} veh/km` : null;
    occupancy = telemetry.road_occupancy != null ? `${(telemetry.road_occupancy * 100).toFixed(0)}%` : null;
    flow = (telemetry.traffic_flow_vpm != null || telemetry.flow_per_minute != null)
      ? `${(telemetry.traffic_flow_vpm ?? telemetry.flow_per_minute).toFixed(1)} veh/min`
      : null;
  } else if (selectedJunction && selectedJunction.metrics) {
    // 2. Exact Selected Junction Metrics (Synchronized when a junction is clicked)
    const m = selectedJunction.metrics;
    vehicleCount = m.vehicleCount != null ? m.vehicleCount : null;
    avgSpeed = m.averageSpeedKmh != null ? `${m.averageSpeedKmh} km/h` : null;
    density = m.densityVehKm != null ? `${m.densityVehKm} veh/km` : (m.density || null);
    occupancy = m.roadOccupancyPct != null ? `${m.roadOccupancyPct}%` : null;
    flow = m.trafficFlowVpm != null ? `${m.trafficFlowVpm} veh/min` : null;
  } else if (areaJunctions && areaJunctions.length > 0) {
    // 3. Area aggregate telemetry when viewing overall area overview
    let totalVehicles = 0;
    let speedSum = 0;
    let densitySum = 0;
    let occupancySum = 0;
    let flowSum = 0;
    let count = 0;

    areaJunctions.forEach((j) => {
      if (j.metrics) {
        totalVehicles += j.metrics.vehicleCount || 0;
        speedSum += j.metrics.averageSpeedKmh || 0;
        densitySum += j.metrics.densityVehKm || 0;
        occupancySum += j.metrics.roadOccupancyPct || 0;
        flowSum += j.metrics.trafficFlowVpm || 0;
        count++;
      }
    });

    if (count > 0) {
      vehicleCount = totalVehicles;
      avgSpeed = `${(speedSum / count).toFixed(1)} km/h`;
      density = `${(densitySum / count).toFixed(1)} veh/km`;
      occupancy = `${Math.round(occupancySum / count)}%`;
      flow = `${(flowSum / count).toFixed(1)} veh/min`;
    }
  }

  // Subtle operational color highlighting
  const isOccupancyHigh = occupancy != null && parseInt(occupancy) >= 70;
  const isSpeedLow = avgSpeed != null && parseFloat(avgSpeed) < 20;

  return (
    <div
      style={{
        background: "var(--bg-surface, #1B2028)",
        border: "1px solid var(--border-default, #3D3F4E)",
        borderRadius: "4px",
        padding: "0.55rem 0.85rem",
        display: "flex",
        alignItems: "center",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Flat Operational Measurements Strip: 5 Bold Metrics Evenly Distributed */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          width: "100%",
          alignItems: "center",
        }}
      >
        {/* 1. Vehicles */}
        <div style={{ padding: "0 0.85rem", borderRight: "1px solid var(--border-light, #2C303C)" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: "var(--text-muted, #737987)", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
            {t("traffic.vehicles", "Vehicles")}
          </div>
          <div style={{ marginTop: "2px" }}>
            {vehicleCount != null ? (
              <span style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary, #F4F5F7)", fontFamily: "var(--font-sans)", lineHeight: 1.1 }}>
                {vehicleCount}
              </span>
            ) : (
              <span style={{ color: "var(--text-muted, #737987)", fontSize: "0.8125rem", fontWeight: 600, fontFamily: "var(--font-sans)" }}>
                {t("common.dataUnavailable", "Data unavailable")}
              </span>
            )}
          </div>
        </div>

        {/* 2. Average Speed */}
        <div style={{ padding: "0 0.85rem", borderRight: "1px solid var(--border-light, #2C303C)" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: "var(--text-muted, #737987)", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
            {t("traffic.averageSpeed", "Average Speed")}
          </div>
          <div style={{ marginTop: "2px" }}>
            {avgSpeed != null ? (
              <span
                style={{
                  fontSize: "1.375rem",
                  fontWeight: 800,
                  color: isSpeedLow ? "var(--status-critical, #F45E70)" : "var(--text-primary, #F4F5F7)",
                  fontFamily: "var(--font-sans)",
                  lineHeight: 1.1,
                }}
              >
                {avgSpeed}
              </span>
            ) : (
              <span style={{ color: "var(--text-muted, #737987)", fontSize: "0.8125rem", fontWeight: 600, fontFamily: "var(--font-sans)" }}>
                {t("common.dataUnavailable", "Data unavailable")}
              </span>
            )}
          </div>
        </div>

        {/* 3. Traffic Density */}
        <div style={{ padding: "0 0.85rem", borderRight: "1px solid var(--border-light, #2C303C)" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: "var(--text-muted, #737987)", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
            {t("traffic.density", "Traffic Density")}
          </div>
          <div style={{ marginTop: "2px" }}>
            {density != null ? (
              <span style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary, #F4F5F7)", fontFamily: "var(--font-sans)", lineHeight: 1.1 }}>
                {density}
              </span>
            ) : (
              <span style={{ color: "var(--text-muted, #737987)", fontSize: "0.8125rem", fontWeight: 600, fontFamily: "var(--font-sans)" }}>
                {t("common.dataUnavailable", "Data unavailable")}
              </span>
            )}
          </div>
        </div>

        {/* 4. Road Occupancy */}
        <div style={{ padding: "0 0.85rem", borderRight: "1px solid var(--border-light, #2C303C)" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: "var(--text-muted, #737987)", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
            {t("traffic.occupancy", "Road Occupancy")}
          </div>
          <div style={{ marginTop: "2px" }}>
            {occupancy != null ? (
              <span
                style={{
                  fontSize: "1.375rem",
                  fontWeight: 800,
                  color: isOccupancyHigh ? "var(--status-critical, #F45E70)" : "var(--text-primary, #F4F5F7)",
                  fontFamily: "var(--font-sans)",
                  lineHeight: 1.1,
                }}
              >
                {occupancy}
              </span>
            ) : (
              <span style={{ color: "var(--text-muted, #737987)", fontSize: "0.8125rem", fontWeight: 600, fontFamily: "var(--font-sans)" }}>
                {t("common.dataUnavailable", "Data unavailable")}
              </span>
            )}
          </div>
        </div>

        {/* 5. Traffic Flow */}
        <div style={{ padding: "0 0.85rem" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: "var(--text-muted, #737987)", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
            {t("traffic.flow", "Traffic Flow")}
          </div>
          <div style={{ marginTop: "2px" }}>
            {flow != null ? (
              <span style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary, #F4F5F7)", fontFamily: "var(--font-sans)", lineHeight: 1.1 }}>
                {flow}
              </span>
            ) : (
              <span style={{ color: "var(--text-muted, #737987)", fontSize: "0.8125rem", fontWeight: 600, fontFamily: "var(--font-sans)" }}>
                {t("common.dataUnavailable", "Data unavailable")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
