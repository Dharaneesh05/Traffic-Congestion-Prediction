import React from "react";

export default function SummaryCards({ telemetry, cameraStatus }) {
  const isCameraOnline = cameraStatus === "online";
  const hasTelemetry = isCameraOnline && telemetry && telemetry.vehicle_count !== undefined;

  // 1. Vehicles
  const vehicleCount = hasTelemetry && telemetry.vehicle_count != null ? telemetry.vehicle_count : null;

  // 2. Average Speed
  const avgSpeed = hasTelemetry && telemetry.average_speed_kmh != null ? `${telemetry.average_speed_kmh.toFixed(1)} km/h` : null;

  // 3. Density
  const density = hasTelemetry && telemetry.vehicle_density != null ? `${telemetry.vehicle_density.toFixed(1)} veh/km` : null;

  // 4. Occupancy
  const occupancy = hasTelemetry && telemetry.road_occupancy != null ? `${(telemetry.road_occupancy * 100).toFixed(0)}%` : null;

  // 5. Flow
  const flow = hasTelemetry && telemetry.traffic_flow_vpm != null ? `${telemetry.traffic_flow_vpm.toFixed(1)} veh/min` : null;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xs)",
        padding: "0.5rem 1rem",
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "1rem",
        alignItems: "center",
      }}
    >
      {/* 1. Vehicles */}
      <div style={{ borderRight: "1px solid var(--border-light)", paddingRight: "0.75rem" }}>
        <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Vehicles Detected
        </div>
        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
          {vehicleCount != null ? vehicleCount : <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 500 }}>No live data</span>}
        </div>
      </div>

      {/* 2. Average Speed */}
      <div style={{ borderRight: "1px solid var(--border-light)", paddingRight: "0.75rem" }}>
        <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Average Speed
        </div>
        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
          {avgSpeed != null ? avgSpeed : <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 500 }}>No live data</span>}
        </div>
      </div>

      {/* 3. Traffic Density */}
      <div style={{ borderRight: "1px solid var(--border-light)", paddingRight: "0.75rem" }}>
        <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Traffic Density
        </div>
        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
          {density != null ? density : <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 500 }}>No live data</span>}
        </div>
      </div>

      {/* 4. Road Occupancy */}
      <div style={{ borderRight: "1px solid var(--border-light)", paddingRight: "0.75rem" }}>
        <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Road Occupancy
        </div>
        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
          {occupancy != null ? occupancy : <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 500 }}>No live data</span>}
        </div>
      </div>

      {/* 5. Traffic Flow */}
      <div>
        <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Traffic Flow
        </div>
        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
          {flow != null ? flow : <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 500 }}>No live data</span>}
        </div>
      </div>
    </div>
  );
}
