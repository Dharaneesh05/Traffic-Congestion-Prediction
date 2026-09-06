import React, { useState } from "react";
import AlertsPanel from "../components/AlertsPanel";
import { AlertTriangle, ShieldAlert, CheckCircle2, Bell, Filter } from "lucide-react";

export default function AlertsPage({ alerts = [] }) {
  const [filter, setFilter] = useState("ALL");

  const filteredAlerts = alerts.filter((a) => {
    if (filter === "ALL") return true;
    if (filter === "CRITICAL") return a.severity === "CRITICAL";
    if (filter === "WARNING") return a.severity === "HIGH" || a.severity === "WARNING";
    return true;
  });

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
                background: "var(--state-amber-subtle)",
                border: "1px solid rgba(245, 158, 11, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--state-amber)",
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                Corridor Safety & Incident Dispatch Center
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                Automated threshold alarms, bottleneck warnings, and highway patrol advisory notices
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.375rem" }}>
            {["ALL", "CRITICAL", "WARNING"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? "var(--state-blue-subtle)" : "var(--bg-card-subtle)",
                  border: `1px solid ${filter === f ? "var(--state-blue)" : "var(--border-default)"}`,
                  color: filter === f ? "var(--state-blue)" : "var(--text-secondary)",
                  borderRadius: "var(--radius-xs)",
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Alerts Feed */}
      <AlertsPanel alerts={filteredAlerts} />

      {/* Operational Response Protocol Card */}
      <div className="card">
        <h3 className="card-title mb-2">
          <ShieldAlert size={14} color="var(--state-blue)" />
          Standard Operational Response Protocols (Tamil Nadu Authority)
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", fontSize: "0.75rem" }}>
          <div style={{ background: "var(--bg-card-subtle)", padding: "0.75rem", borderRadius: "var(--radius-xs)" }}>
            <span className="status-pill danger mb-1" style={{ fontSize: "0.625rem" }}>
              CRITICAL LEVEL (Score &gt; 0.80)
            </span>
            <p style={{ color: "var(--text-secondary)", marginTop: "0.25rem", lineHeight: 1.4 }}>
              Automatic TFT diversion route injection; notify highway patrol for junction clearance at Sankagiri.
            </p>
          </div>

          <div style={{ background: "var(--bg-card-subtle)", padding: "0.75rem", borderRadius: "var(--radius-xs)" }}>
            <span className="status-pill warning mb-1" style={{ fontSize: "0.625rem" }}>
              MODERATE LEVEL (0.40 - 0.79)
            </span>
            <p style={{ color: "var(--text-secondary)", marginTop: "0.25rem", lineHeight: 1.4 }}>
              Monitor vehicle inflow velocities; advisory variable message sign (VMS) recommendations.
            </p>
          </div>

          <div style={{ background: "var(--bg-card-subtle)", padding: "0.75rem", borderRadius: "var(--radius-xs)" }}>
            <span className="status-pill online mb-1" style={{ fontSize: "0.625rem" }}>
              NORMAL LEVEL (&lt; 0.40)
            </span>
            <p style={{ color: "var(--text-secondary)", marginTop: "0.25rem", lineHeight: 1.4 }}>
              Standard algorithmic corridor monitoring; uninterrupted mainline throughput.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
