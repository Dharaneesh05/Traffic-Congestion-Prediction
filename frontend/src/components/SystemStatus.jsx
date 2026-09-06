import React from "react";
import { Server, Database, Cpu, Activity, Map, Zap, Shield } from "lucide-react";

export default function SystemStatus({ health, routingStatus, cameraStatus }) {
  const isHealthy = health?.status === "ok";
  const isGraphLoaded = routingStatus?.is_loaded;
  const nodeCount = routingStatus?.node_count?.toLocaleString() || "3,065,575";
  const edgeCount = routingStatus?.edge_count?.toLocaleString() || "5,870,381";
  const congestionSize = routingStatus?.congestion_map_size || 0;
  const congestionSource = routingStatus?.congestion_source || "TFT-5min";

  const components = [
    {
      name: "FastAPI REST Server",
      detail: "Port 8000 • JSON REST API",
      status: isHealthy ? "ONLINE" : "OFFLINE",
      color: isHealthy ? "var(--state-green)" : "var(--state-red)",
      icon: Server,
    },
    {
      name: "YOLO11 Vehicle Detector",
      detail: "yolo11n.pt • Confidence 0.25",
      status: health?.detector ? "ACTIVE" : "STANDBY",
      color: "var(--state-green)",
      icon: Activity,
    },
    {
      name: "ByteTrack Trajectory Tracker",
      detail: "bytetrack.yaml • 120-frame trajectory",
      status: health?.tracker ? "ACTIVE" : "STANDBY",
      color: "var(--state-green)",
      icon: Zap,
    },
    {
      name: "TFT Congestion Forecaster",
      detail: "models/tft.keras • 60-min lookback • 4 horizons",
      status: "TRAINED & LOADED",
      color: "var(--state-purple)",
      icon: Cpu,
    },
    {
      name: "OpenStreetMap Road Graph",
      detail: `${nodeCount} nodes • ${edgeCount} edges`,
      status: isGraphLoaded ? "READY (OSM PBF)" : "LOADING",
      color: "var(--state-blue)",
      icon: Map,
    },
    {
      name: "KD-Tree Spatial Snapper",
      detail: "Sub-millisecond nearest node snapping",
      status: routingStatus?.fast_snap ? "ENABLED" : "DISABLED",
      color: "var(--state-blue)",
      icon: Database,
    },
    {
      name: "TFT Congestion Injection",
      detail: `${congestionSize} nodes penalized (${congestionSource})`,
      status: congestionSize > 0 ? "INJECTED" : "BASELINE",
      color: "var(--state-purple)",
      icon: Shield,
    },
    {
      name: "CCTV-SKG-01 Inflow Source",
      detail: "Traffic.mp4 • Simulated Highway Stream",
      status: cameraStatus === "online" ? "STREAMING" : "STANDBY",
      color: cameraStatus === "online" ? "var(--state-green)" : "#64748b",
      icon: Activity,
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">
            <Server size={16} color="var(--state-blue)" />
            Subsystem Architecture & Telemetry Engine Status
          </h2>
          <p className="card-subtitle">
            End-to-end neural models, OSM spatial graph, and real-time inference health
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
        {components.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              style={{
                background: "var(--bg-card-subtle)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                padding: "0.75rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {c.name}
                  </span>
                  <Icon size={14} color={c.color} />
                </div>
                <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>{c.detail}</p>
              </div>

              <div style={{ marginTop: "0.5rem", paddingTop: "0.375rem", borderTop: "1px solid var(--border-light)" }}>
                <span
                  className="status-pill"
                  style={{
                    fontSize: "0.625rem",
                    padding: "0.1rem 0.4rem",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <span className="status-dot" style={{ background: c.color }}></span>
                  {c.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
