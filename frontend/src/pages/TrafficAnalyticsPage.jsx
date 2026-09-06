import React from "react";
import TrafficCharts from "../components/TrafficCharts";
import { BarChart2, TrendingUp, Activity, Gauge, Car, Shield } from "lucide-react";

export default function TrafficAnalyticsPage({ telemetryHistory = [], telemetry, cameraStatus }) {
  const isOnline = cameraStatus === "online";
  const hasHistory = telemetryHistory && telemetryHistory.length >= 2;

  const currentVehicles = isOnline && telemetry?.vehicle_count != null ? telemetry.vehicle_count : "--";
  const currentSpeed = isOnline && telemetry?.average_speed_kmh != null ? `${telemetry.average_speed_kmh.toFixed(1)} km/h` : "--";
  const currentFlow = isOnline && telemetry?.traffic_flow_vpm != null ? `${telemetry.traffic_flow_vpm.toFixed(1)} vpm` : "--";
  const currentDensity = isOnline && telemetry?.vehicle_density != null ? `${telemetry.vehicle_density.toFixed(1)} veh/100m` : "--";

  return (
    <div className="flex flex-col gap-4">
      {/* Overview Banner */}
      <div className="card" style={{ padding: "0.875rem 1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-xs)",
                background: "var(--state-green-subtle)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--state-green)",
              }}
            >
              <BarChart2 size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                Traffic Telemetry Analytics & Velocity Dynamics
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                High-frequency rolling telemetry buffers generated from ByteTrack trajectory vectors
              </p>
            </div>
          </div>

          <span className={`status-pill ${isOnline ? "online" : "offline"}`}>
            <span className="status-dot"></span>
            {isOnline ? "SAMPLING ACTIVE (3s)" : "STANDBY"}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
        <div className="metric-card">
          <span className="metric-label">Current Vehicle Load</span>
          <div className="metric-value">{currentVehicles}</div>
        </div>

        <div className="metric-card">
          <span className="metric-label">Instantaneous Velocity</span>
          <div className="metric-value">{currentSpeed}</div>
        </div>

        <div className="metric-card">
          <span className="metric-label">Corridor Flow Rate</span>
          <div className="metric-value">{currentFlow}</div>
        </div>

        <div className="metric-card">
          <span className="metric-label">Linear Density</span>
          <div className="metric-value">{currentDensity}</div>
        </div>
      </div>

      {/* Real-time Time Series Charts */}
      <TrafficCharts telemetryHistory={telemetryHistory} />

      {/* Historical Buffer Summary Table */}
      <div className="card">
        <h3 className="card-title mb-2">
          <Activity size={14} color="var(--state-blue)" />
          Recent Inflow Sampling Records (Last 15 Cycles)
        </h3>

        {hasHistory ? (
          <table className="route-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Detected Vehicles</th>
                <th>Velocity (km/h)</th>
                <th>Congestion Index</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {telemetryHistory.map((rec, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{rec.time}</td>
                  <td style={{ fontWeight: 700 }}>{rec.vehicles} VEH</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{rec.speed.toFixed(1)} km/h</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{(rec.congestion * 100).toFixed(0)} / 100</td>
                  <td>
                    <span className="status-pill online" style={{ fontSize: "0.625rem", padding: "0.1rem 0.35rem" }}>
                      NOMINAL
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.75rem" }}>
            Awaiting active camera telemetry cycles to populate historical buffer log.
          </div>
        )}
      </div>
    </div>
  );
}
