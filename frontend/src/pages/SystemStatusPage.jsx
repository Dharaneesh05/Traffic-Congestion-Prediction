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
                borderRadius: "3px",
                background: "rgba(123, 139, 200, 0.15)",
                border: "1px solid rgba(123, 139, 200, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-soft-blue, #7B8BC8)",
              }}
            >
              <Server size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary, #F4F5F7)", letterSpacing: "-0.01em" }}>
                Infrastructure Health & Hardware Diagnostic Matrix
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted, #737987)", fontWeight: 500 }}>
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
            <Database size={14} color="var(--accent-soft-blue, #7B8BC8)" />
            OpenStreetMap Road Graph Architecture
          </h3>

          <div className="flex flex-col gap-2" style={{ fontSize: "0.75rem" }}>
            <div style={{ background: "var(--bg-surface-elevated, #252936)", border: "1px solid var(--border-default, #3D3F4E)", padding: "0.5rem", borderRadius: "3px" }}>
              <span style={{ color: "var(--text-muted, #737987)", fontSize: "0.6875rem", display: "block" }}>Spatial Topology Cache</span>
              <strong style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary, #F4F5F7)" }}>{cachePath}</strong>
            </div>

            <div style={{ background: "var(--bg-surface-elevated, #252936)", border: "1px solid var(--border-default, #3D3F4E)", padding: "0.5rem", borderRadius: "3px" }}>
              <span style={{ color: "var(--text-muted, #737987)", fontSize: "0.6875rem", display: "block" }}>Total Road Nodes & Edges</span>
              <strong style={{ color: "var(--text-primary, #F4F5F7)" }}>{nodeCount} Nodes • {edgeCount} Directed Edges</strong>
            </div>

            <div style={{ background: "var(--bg-surface-elevated, #252936)", border: "1px solid var(--border-default, #3D3F4E)", padding: "0.5rem", borderRadius: "3px" }}>
              <span style={{ color: "var(--text-muted, #737987)", fontSize: "0.6875rem", display: "block" }}>Spatial Indexing Engine</span>
              <strong style={{ color: "var(--text-primary, #F4F5F7)" }}>Scipy KD-Tree (Sub-millisecond Euclidean Snapping)</strong>
            </div>

            <div style={{ background: "var(--bg-surface-elevated, #252936)", border: "1px solid var(--border-default, #3D3F4E)", padding: "0.5rem", borderRadius: "3px" }}>
              <span style={{ color: "var(--text-muted, #737987)", fontSize: "0.6875rem", display: "block" }}>Routing Algorithm</span>
              <strong style={{ color: "var(--text-primary, #F4F5F7)" }}>A* Shortest Path with On-the-Fly Dynamic Congestion Penalty</strong>
            </div>
          </div>
        </div>

        {/* Neural Network & Computer Vision Stack */}
        <div className="card">
          <h3 className="card-title mb-2">
            <Cpu size={14} color="var(--accent-soft-blue, #7B8BC8)" />
            Neural Inference & Telemetry Engine
          </h3>

          <div className="flex flex-col gap-2" style={{ fontSize: "0.75rem" }}>
            <div style={{ background: "var(--bg-surface-elevated, #252936)", border: "1px solid var(--border-default, #3D3F4E)", padding: "0.5rem", borderRadius: "3px" }}>
              <span style={{ color: "var(--text-muted, #737987)", fontSize: "0.6875rem", display: "block" }}>Object Detection Engine</span>
              <strong style={{ color: "var(--text-primary, #F4F5F7)" }}>YOLO11n (CPU/GPU, IoU Threshold 0.45, Conf 0.25)</strong>
            </div>

            <div style={{ background: "var(--bg-surface-elevated, #252936)", border: "1px solid var(--border-default, #3D3F4E)", padding: "0.5rem", borderRadius: "3px" }}>
              <span style={{ color: "var(--text-muted, #737987)", fontSize: "0.6875rem", display: "block" }}>Multi-Object Tracking</span>
              <strong style={{ color: "var(--text-primary, #F4F5F7)" }}>ByteTrack (120-frame Trajectory History Buffer)</strong>
            </div>

            <div style={{ background: "var(--bg-surface-elevated, #252936)", border: "1px solid var(--border-default, #3D3F4E)", padding: "0.5rem", borderRadius: "3px" }}>
              <span style={{ color: "var(--text-muted, #737987)", fontSize: "0.6875rem", display: "block" }}>Time-Series Forecaster</span>
              <strong style={{ color: "var(--text-primary, #F4F5F7)" }}>Temporal Fusion Transformer (models/tft.keras)</strong>
            </div>

            <div style={{ background: "var(--bg-surface-elevated, #252936)", border: "1px solid var(--border-default, #3D3F4E)", padding: "0.5rem", borderRadius: "3px" }}>
              <span style={{ color: "var(--text-muted, #737987)", fontSize: "0.6875rem", display: "block" }}>Database & Persistence</span>
              <strong style={{ color: "var(--text-primary, #F4F5F7)" }}>SQLite Fallback (backend/traffic_system.db)</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
