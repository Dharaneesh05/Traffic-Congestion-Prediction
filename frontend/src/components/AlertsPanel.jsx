import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default function AlertsPanel({ alerts = [] }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">
            <AlertTriangle size={16} color="var(--state-amber)" />
            Corridor Incidents & AI Safety Alerts
          </h2>
          <p className="card-subtitle">
            Automated threshold anomalies and event notifications
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="status-pill warning">
            <span className="status-dot"></span>
            {alerts.length} Active Notice{alerts.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {alerts.length > 0 ? (
        <div className="flex flex-col gap-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.625rem",
                padding: "0.625rem 0.75rem",
                borderRadius: "var(--radius-sm)",
                background:
                  a.severity === "CRITICAL"
                    ? "var(--state-red-subtle)"
                    : a.severity === "HIGH" || a.severity === "WARNING"
                    ? "var(--state-amber-subtle)"
                    : "var(--bg-card-subtle)",
                border: "1px solid var(--border-default)",
              }}
            >
              <AlertTriangle
                size={16}
                color={
                  a.severity === "CRITICAL"
                    ? "var(--state-red)"
                    : a.severity === "HIGH" || a.severity === "WARNING"
                    ? "var(--state-amber)"
                    : "var(--state-blue)"
                }
                style={{ marginTop: "1px", flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {a.title || a.location || a.alert_type || "Traffic Notice"}
                  </span>
                  <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {a.timestamp || "Active"}
                  </span>
                </div>
                <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: "0.125rem" }}>
                  {a.reason || a.message || a.description || "Traffic corridor anomaly detected."}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: "1.25rem 1rem",
            textAlign: "center",
            color: "var(--text-muted)",
            background: "var(--bg-card-subtle)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <CheckCircle2 size={24} color="var(--state-green)" style={{ margin: "0 auto 0.375rem auto" }} />
          <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-primary)" }}>
            No Active Incident Alerts
          </div>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.125rem" }}>
            All Tamil Nadu highway corridors and monitored approaches are operating within nominal thresholds.
          </p>
        </div>
      )}
    </div>
  );
}
