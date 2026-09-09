import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, Check } from "lucide-react";

export default function AlertsPanel({
  alerts = [],
  onViewAlert,
  onAcknowledgeAlert,
}) {
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());

  const handleAcknowledge = (alertId) => {
    setAcknowledgedIds((prev) => new Set([...prev, alertId]));
    if (onAcknowledgeAlert) {
      onAcknowledgeAlert(alertId);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">
            <AlertTriangle size={16} color="var(--state-amber)" />
            Incident Alerts
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="status-pill warning">
            <span className="status-dot"></span>
            {alerts.length} Active Notice{alerts.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {alerts.length > 0 ? (
        <div className="flex flex-col gap-2" style={{ maxHeight: "360px", overflowY: "auto" }}>
          {alerts.map((a, i) => {
            const alertId = a.alert_id || `ALT-${i}`;
            const isAck = acknowledgedIds.has(alertId);
            const isCrit = a.severity === "CRITICAL";
            const isHigh = a.severity === "HIGH" || a.severity === "WARNING";

            return (
              <div
                key={alertId}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.375rem",
                  padding: "0.5rem 0.625rem",
                  borderRadius: "var(--radius-xs)",
                  background: isCrit
                    ? "#fef2f2"
                    : isHigh
                    ? "#fff7ed"
                    : "var(--bg-card-subtle)",
                  border: isCrit
                    ? "1px solid #fecaca"
                    : isHigh
                    ? "1px solid #fed7aa"
                    : "1px solid var(--border-default)",
                  opacity: isAck ? 0.6 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <AlertTriangle
                      size={14}
                      color={isCrit ? "#dc2626" : isHigh ? "#ea580c" : "#2563eb"}
                    />
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-primary)" }}>
                      {a.title || a.location || a.alert_type || "Traffic Notice"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <span
                      style={{
                        fontSize: "0.5625rem",
                        fontWeight: 800,
                        padding: "1px 4px",
                        borderRadius: "2px",
                        background: isCrit ? "#fee2e2" : "#fef3c7",
                        color: isCrit ? "#b91c1c" : "#b45309",
                        textTransform: "uppercase",
                      }}
                    >
                      {a.severity || "NOTICE"}
                    </span>
                    <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      {a.timestamp || "Active"}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", lineHeight: 1.3, margin: 0 }}>
                  {a.reason || a.message || a.description || "Traffic corridor anomaly detected."}
                </p>

                {a.action && (
                  <div style={{ fontSize: "0.625rem", color: "#1e3a8a", background: "#eff6ff", padding: "2px 5px", borderRadius: "2px", fontWeight: 600 }}>
                    Rec: {a.action}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.375rem", marginTop: "2px" }}>
                  {onViewAlert && (
                    <button
                      onClick={() => onViewAlert(a)}
                      style={{
                        padding: "2px 6px",
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        background: "#ffffff",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "2px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                      }}
                    >
                      <Eye size={10} />
                      <span>View</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleAcknowledge(alertId)}
                    disabled={isAck}
                    style={{
                      padding: "2px 6px",
                      fontSize: "0.625rem",
                      fontWeight: 700,
                      background: isAck ? "#e2e8f0" : "#0f172a",
                      color: isAck ? "#64748b" : "#ffffff",
                      border: "none",
                      borderRadius: "2px",
                      cursor: isAck ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    <Check size={10} />
                    <span>{isAck ? "Acknowledged" : "Acknowledge"}</span>
                  </button>
                </div>
              </div>
            );
          })}
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
            All monitored approaches and Tamil Nadu highway corridors are operating nominally.
          </p>
        </div>
      )}
    </div>
  );
}
