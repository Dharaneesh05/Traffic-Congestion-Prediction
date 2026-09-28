import React, { useState, useEffect } from "react";
import { sendOfficerAction } from "../api";

export const formatIncidentLabel = (a) => {
  const status = (a?.status || "").toUpperCase();
  const reason = (a?.reason || a?.message || a?.condition || "").toUpperCase();
  const sev = (a?.severity || "").toUpperCase();

  // 1. Normalized / Resolved
  if (status === "RESOLVED" || status === "INCIDENT RESOLVED") {
    return "TRAFFIC NORMALIZED";
  }

  // 2. Diversion Active / Accepted
  if (
    status === "ACTION ACCEPTED" ||
    status === "DIVERSION ACTIVE" ||
    reason.includes("DIVERSION ACCEPTED") ||
    reason.includes("ALTERNATE ROUTE ACTIVE")
  ) {
    return "DIVERSION ACTIVE";
  }

  // 3. Diversion Rejected
  if (status === "ACTION REJECTED" || reason.includes("DIVERSION REJECTED")) {
    return "DIVERSION REJECTED";
  }

  // 4. Camera Offline
  if (
    reason.includes("CAMERA OFFLINE") ||
    reason.includes("FEED LOST") ||
    reason.includes("OFFLINE") ||
    (a?.camera_id && reason.includes("DISCONNECTED"))
  ) {
    return "CAMERA OFFLINE";
  }

  // 5. Manual control / inspection
  if (
    status === "MANUAL CONTROL ACTIVE" ||
    status === "OVERRIDDEN" ||
    reason.includes("MANUAL") ||
    reason.includes("CHECK REQUIRED") ||
    reason.includes("INSPECTION")
  ) {
    return "TRAFFIC CHECK REQUIRED";
  }

  // 6. Critical congestion / standstill
  if (
    sev === "CRITICAL" ||
    reason.includes("STANDSTILL") ||
    reason.includes("SEVERE") ||
    reason.includes("CRITICAL")
  ) {
    return "CRITICAL CONGESTION";
  }

  // 7. High congestion (default active incident)
  return "HIGH CONGESTION";
};

export const getIncidentLabelColor = (label) => {
  switch (label) {
    case "CRITICAL CONGESTION":
    case "CAMERA OFFLINE":
    case "DIVERSION REJECTED":
      return "var(--status-critical, #F45E70)";
    case "HIGH CONGESTION":
    case "TRAFFIC CHECK REQUIRED":
      return "var(--status-high, #F59E0B)";
    case "TRAFFIC NORMALIZED":
      return "var(--status-normal, #22C55E)";
    case "DIVERSION ACTIVE":
      return "var(--accent-soft-blue, #60A5FA)";
    default:
      return "var(--text-primary, #F4F5F7)";
  }
};

export default function AlertsPanel({
  alerts = [],
  onViewAlert,
  onAcknowledgeAlert,
  onOfficerAction,
  selectedJunction = null,
}) {
  const [localAlerts, setLocalAlerts] = useState(alerts);

  // Synchronize localAlerts when prop updates, preserving resolved states
  useEffect(() => {
    if (!alerts || alerts.length === 0) {
      setLocalAlerts([]);
      return;
    }
    setLocalAlerts((prev) => {
      return alerts.map((incoming) => {
        const existing = prev.find((p) => p.alert_id === incoming.alert_id);
        if (existing && existing.status !== "NEW" && existing.status !== "ACTIVE") {
          return {
            ...incoming,
            status: existing.status,
            reason: existing.reason,
            action: existing.action,
            timestamp: existing.timestamp,
          };
        }
        return incoming;
      });
    });
  }, [alerts]);

  const getLocationLabel = (alertItem) => {
    const loc = (alertItem.location || alertItem.junction || "").trim();
    if (!loc || loc.toLowerCase().includes("highway corridor")) {
      if (selectedJunction?.name) {
        return selectedJunction.name;
      }
      return "Perundurai Junction";
    }
    // Remove camera ID prefix like "CCTV-PRD-01 · " or "CAM001 · "
    const cleaned = loc.replace(/^(CCTV|CAM)[^·•\-]*[·•\-]\s*/i, "").trim();
    return cleaned || loc;
  };

  const formatAlertTimestamp = (raw) => {
    if (!raw) return "Just now";
    if (typeof raw === "string") {
      if (
        raw.includes("AM") ||
        raw.includes("PM") ||
        raw.includes("ago") ||
        raw.includes("Just") ||
        raw.includes("Active")
      ) {
        return raw;
      }
    }
    const num = Number(raw);
    if (!isNaN(num) && num > 0) {
      const ms = num < 1e11 ? num * 1000 : num;
      const date = new Date(ms);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      }
    }
    return String(raw);
  };

  const handleResolve = (alertItem) => {
    const alertId = alertItem.alert_id;
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

    // Mark locally as RESOLVED
    setLocalAlerts((prev) =>
      prev.map((a) =>
        a.alert_id === alertId
          ? {
              ...a,
              status: "RESOLVED",
              reason: "Traffic flow normalized",
              timestamp: nowTime,
            }
          : a
      )
    );

    const updatedItem = {
      ...alertItem,
      status: "RESOLVED",
      reason: "Traffic flow normalized",
      timestamp: nowTime,
    };

    if (onOfficerAction) {
      onOfficerAction(alertId, "RESOLVE", updatedItem);
    } else if (onAcknowledgeAlert) {
      onAcknowledgeAlert(alertId, updatedItem);
    } else {
      sendOfficerAction(alertId, "RESOLVE", "OFFICER_TN_042", "Traffic flow normalized").catch(() => {});
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-surface, #1B2028)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* INCIDENT LIST (CLEAN OPERATIONAL INBOX) */}
      {localAlerts.length > 0 ? (
        <div style={{ maxHeight: "420px", overflowY: "auto" }}>
          {localAlerts.map((a, i) => {
            const alertId = a.alert_id || `ALT-${i}`;
            const incidentLabel = formatIncidentLabel(a);
            const labelColor = getIncidentLabelColor(incidentLabel);
            const isResolved = incidentLabel === "TRAFFIC NORMALIZED";
            const locName = getLocationLabel(a);
            const displayTime = formatAlertTimestamp(a.timestamp);

            return (
              <div
                key={alertId}
                style={{
                  padding: "0.85rem 1rem",
                  borderBottom: "1px solid var(--border-light, #2C303C)",
                  background: "transparent",
                  opacity: isResolved ? 0.65 : 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  transition: "opacity 0.2s ease",
                }}
              >
                {/* 1. Top row: Location on left, Time on right */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      color: "var(--text-primary, #F4F5F7)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {locName}
                  </span>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--text-muted, #737987)",
                      flexShrink: 0,
                    }}
                  >
                    {displayTime}
                  </span>
                </div>

                {/* 2. Middle row: Standardized uppercase incident label */}
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    color: labelColor,
                    marginTop: "1px",
                  }}
                >
                  {incidentLabel}
                </div>

                {/* 3. Bottom row: Curved action buttons */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginTop: "0.3rem",
                  }}
                >
                  {!isResolved && (
                    <button
                      type="button"
                      onClick={() => handleResolve(a)}
                      style={{
                        height: "26px",
                        padding: "0 16px",
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        letterSpacing: "0.03em",
                        background: "var(--bg-surface-elevated, #252936)",
                        color: "var(--text-primary, #F4F5F7)",
                        border: "1px solid var(--border-default, #3D3F4E)",
                        borderRadius: "9999px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      RESOLVE
                    </button>
                  )}

                  {onViewAlert && (
                    <button
                      type="button"
                      onClick={() => onViewAlert(a)}
                      style={{
                        height: "26px",
                        padding: "0 16px",
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        letterSpacing: "0.03em",
                        background: "transparent",
                        color: "var(--text-secondary, #A7ACB8)",
                        border: "1px solid var(--border-default, #3D3F4E)",
                        borderRadius: "9999px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      VIEW MAP
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            padding: "1.75rem 1rem",
            textAlign: "center",
            background: "var(--bg-surface, #1B2028)",
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: "0.75rem",
              color: "var(--text-primary, #F4F5F7)",
              letterSpacing: "0.04em",
            }}
          >
            NO ATTENTION REQUIRED ITEMS
          </div>
          <div
            style={{
              fontSize: "0.6875rem",
              color: "var(--text-muted, #737987)",
              marginTop: "0.25rem",
            }}
          >
            All Tamil Nadu highway corridors and junction approaches operating nominally.
          </div>
        </div>
      )}
    </div>
  );
}
