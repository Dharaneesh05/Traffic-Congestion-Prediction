import React from "react";
import SystemStatus from "../components/SystemStatus";
import { Server, Database, Activity, Cpu, HardDrive, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function SystemStatusPage({ health, routingStatus, cameraStatus }) {
  const isHealthy = health?.status === "ok";
  const nodeCount = routingStatus?.node_count?.toLocaleString() || "3,065,575";
  const edgeCount = routingStatus?.edge_count?.toLocaleString() || "5,870,381";
  const cachePath = routingStatus?.graph_cache_path || "datasets/osm/southern_zone_graph.pkl.gz";

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
                background: "var(--state-blue-subtle)",
                border: "1px solid rgba(37, 99, 235, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--state-blue)",
              }}
            >
              <Server size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                Infrastructure Health & Hardware Diagnostic Matrix
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                Real-time microservice status, neural model memory allocation, and OpenStreetMap spatial index
              </p>
            </div>
          </div>

          <span className={`status-pill ${isHealthy ? "online" : "danger"}`}>
            <span className="status-dot"></span>
            {isHealthy ? "ALL SUBSYSTEMS NOMINAL" : "CONNECTIVITY ISSUE"}
          </span>
        </div>
      </div>

      {/* Subsystem Health Grid */}
      <SystemStatus
        health={health}
        routingStatus={routingStatus}
        cameraStatus={cameraStatus}
      />

      {/* Deep Component Breakdown Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        {/* OpenStreetMap Road Topology Engine */}
        <div className="card">
          <h3 className="card-title mb-2">
            <Database size={14} color="var(--state-blue)" />
            OpenStreetMap Road Graph Architecture
          </h3>

          <div className="flex flex-col gap-2" style={{ fontSize: "0.75rem" }}>
            <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Spatial Topology Cache</span>
              <strong style={{ fontFamily: "var(--font-mono)" }}>{cachePath}</strong>
            </div>

            <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Total Road Nodes & Edges</span>
              <strong>{nodeCount} Nodes • {edgeCount} Directed Edges</strong>
            </div>

            <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Spatial Indexing Engine</span>
              <strong>Scipy KD-Tree (Sub-millisecond Euclidean Snapping)</strong>
            </div>

            <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Routing Algorithm</span>
              <strong>A* Shortest Path with On-the-Fly Dynamic Congestion Penalty</strong>
            </div>
          </div>
        </div>

        {/* Neural Network & Computer Vision Stack */}
        <div className="card">
          <h3 className="card-title mb-2">
            <Cpu size={14} color="var(--state-purple)" />
            Neural Inference & Telemetry Engine
          </h3>

          <div className="flex flex-col gap-2" style={{ fontSize: "0.75rem" }}>
            <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Object Detection Engine</span>
              <strong>YOLO11n (CPU/GPU, IoU Threshold 0.45, Conf 0.25)</strong>
            </div>

            <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Multi-Object Tracking</span>
              <strong>ByteTrack (120-frame Trajectory History Buffer)</strong>
            </div>

            <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Time-Series Forecaster</span>
              <strong>Temporal Fusion Transformer (models/tft.keras)</strong>
            </div>

            <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Database & Persistence</span>
              <strong>SQLite Fallback (backend/traffic_system.db)</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
