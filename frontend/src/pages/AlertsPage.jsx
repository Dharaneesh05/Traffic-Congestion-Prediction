import React, { useState, useEffect, useMemo } from "react";
import { MapPin } from "lucide-react";
import { sendOfficerAction } from "../api";
import { useSettings } from "../context/SettingsContext";

/**
 * Format and resolve location string to preferred officer format:
 * Camera ID · Junction OR Junction · Area OR Road · Location
 */
function getCleanLocation(alertItem) {
  let cam = (alertItem.camera_id || "").trim();
  let jnc = (alertItem.junction || "").trim();
  let loc = (alertItem.location || "").trim();
  let approach = (alertItem.approach || "").trim();

  // Remove any legacy "Highway Corridor" labels
  if (loc.toLowerCase().includes("highway corridor")) {
    loc = jnc ? `${jnc} · NH544` : "NH544 · Sankagiri";
  }

  // Camera ID · Junction preferred
  if (cam && jnc) {
    if (jnc.startsWith(cam)) return jnc.replace(/\s*•\s*/g, " · ");
    return `${cam} · ${jnc}`;
  }

  if (cam && loc) {
    if (loc.startsWith(cam)) return loc.replace(/\s*•\s*/g, " · ");
    return `${cam} · ${loc.replace(/\s*•\s*/g, " · ")}`;
  }

  if (jnc && approach) {
    const cleanApproach = approach.replace(/^(North|South|East|West):\s*/i, "");
    if (cam) return `${cam} · ${jnc}`;
    return `${cleanApproach} · ${jnc}`;
  }

  if (loc) {
    return loc.replace(/\s*•\s*/g, " · ");
  }

  if (jnc) return jnc;

  return "Sankagiri Junction";
}

/**
 * Standardize severity to operational level
 */
function getOperationalSeverity(sev) {
  const s = String(sev || "WARNING").toUpperCase();
  if (s.includes("CRIT") || s.includes("SEVER")) return "CRITICAL";
  if (s.includes("HIGH") || s.includes("HEAVY")) return "HIGH";
  if (s.includes("RESOLV") || s.includes("CLEAR")) return "RESOLVED";
  return "WARNING";
}

/**
 * Operational severity text colors (zero neon, zero gradients)
 */
const SEVERITY_COLORS = {
  CRITICAL: "var(--status-critical, #F45E70)",
  HIGH: "var(--status-high, #F59E0B)",
  WARNING: "var(--status-moderate, #C2BB91)",
  RESOLVED: "var(--status-normal, #22C55E)",
};

/**
 * Standardize status to simple officer-readable format:
 * NEW, ACKNOWLEDGED, ACTION ACCEPTED, ACTION REJECTED, ACTION OVERRIDDEN, RESOLVED
 */
function getOperationalStatus(status) {
  if (!status) return "NEW";
  const s = String(status).toUpperCase().trim();
  if (
    s === "NEW" ||
    s === "ACTIVE" ||
    s === "PENDING" ||
    s === "OPEN" ||
    s === "SYSTEM_GENERATED" ||
    s === "DISPATCH_EVENT"
  ) {
    return "NEW";
  }
  if (s === "ACKNOWLEDGED" || s === "ACK") {
    return "ACKNOWLEDGED";
  }
  if (
    s === "ACTION ACCEPTED" ||
    s === "ACCEPTED" ||
    s === "ACCEPT_DIVERSION" ||
    s === "APPROVE" ||
    s === "APPROVED"
  ) {
    return "ACTION ACCEPTED";
  }
  if (
    s === "ACTION REJECTED" ||
    s === "REJECTED" ||
    s === "REJECT_ACTION" ||
    s === "REJECT_DIVERSION"
  ) {
    return "ACTION REJECTED";
  }
  if (
    s === "ACTION OVERRIDDEN" ||
    s === "OVERRIDDEN" ||
    s === "OVERRIDE" ||
    s === "MANUAL_CONTROL" ||
    s === "MANUAL CONTROL ACTIVE" ||
    s === "OFFICER_ACTION_LOGGED"
  ) {
    return "MANUAL CONTROL ACTIVE";
  }
  if (
    s === "RESOLVED" ||
    s === "CONGESTION_CLEARED" ||
    s === "CLEARED" ||
    s === "CLOSED" ||
    s === "INCIDENT RESOLVED"
  ) {
    return "RESOLVED";
  }
  return "NEW";
}

/**
 * Format timestamp into clean uppercase string (e.g. JUST NOW, 02:25 PM)
 */
function formatIncidentTime(ts) {
  if (!ts) return "JUST NOW";
  if (typeof ts === "number") {
    const d = new Date(ts > 1e11 ? ts : ts * 1000);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  if (typeof ts === "string") {
    const trimmed = ts.trim();
    if (/^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(trimmed)) {
      return trimmed;
    }
    return trimmed;
  }
  return "JUST NOW";
}

/**
 * Localized severity to operational level
 */
function getLocalizedSeverity(sev, t) {
  const s = String(sev || "WARNING").toUpperCase();
  if (s.includes("CRIT") || s.includes("SEVER")) return (t ? t("status.critical", "CRITICAL") : "CRITICAL").toUpperCase();
  if (s.includes("HIGH") || s.includes("HEAVY")) return (t ? t("status.high", "HIGH") : "HIGH").toUpperCase();
  if (s.includes("RESOLV") || s.includes("CLEAR")) return (t ? t("status.resolved", "RESOLVED") : "RESOLVED").toUpperCase();
  return (t ? t("alerts.filterWarning", "WARNING") : "WARNING").toUpperCase();
}

/**
 * Localized operational status
 */
function getLocalizedStatus(status, t) {
  const opStatus = getOperationalStatus(status);
  if (!t) return opStatus;
  switch (opStatus) {
    case "NEW":
      return t("alerts.new", "NEW");
    case "ACKNOWLEDGED":
      return t("alerts.acknowledged", "ACKNOWLEDGED");
    case "ACTION ACCEPTED":
      return t("alerts.actionAccepted", "ACTION ACCEPTED");
    case "ACTION REJECTED":
      return t("alerts.actionRejected", "ACTION REJECTED");
    case "MANUAL CONTROL ACTIVE":
      return t("alerts.manualControlActive", "MANUAL CONTROL ACTIVE");
    case "RESOLVED":
      return t("alerts.resolved", "RESOLVED");
    default:
      return opStatus;
  }
}

/**
 * Concise real traffic condition description
 */
function getConditionText(alertItem, status, t) {
  if (status === "ACTION ACCEPTED") return t ? t("alerts.diversionActiveDesc", "Diversion active · Alternate route deployed") : "Diversion accepted · Alternate route active";
  if (status === "ACTION REJECTED") return t ? t("alerts.diversionNotActivated", "Diversion not activated") : "Diversion not activated";
  if (status === "MANUAL CONTROL ACTIVE" || status === "ACTION OVERRIDDEN") return t ? t("alerts.manualControlActive", "Manual control active") : "Manual control active";
  if (status === "RESOLVED") return t ? t("alerts.trafficFlowNormalized", "Traffic flow normalized") : "Traffic flow normalized";

  // Check evidence array if provided by backend telemetry
  if (Array.isArray(alertItem.evidence) && alertItem.evidence.length > 0) {
    const vMatch = alertItem.evidence.find((e) => /vehicle/i.test(e));
    const sMatch = alertItem.evidence.find((e) => /speed/i.test(e));
    if (vMatch && sMatch) {
      const vNum = (vMatch.match(/\d+/) || [""])[0];
      const sNum = (sMatch.match(/\d+(\.\d+)?/) || [""])[0];
      if (vNum && sNum) {
        return t
          ? t("alerts.vehiclesCountAndSpeed", "{vehicles} vehicles · Average speed {speed} km/h", { vehicles: vNum, speed: sNum })
          : `${vNum} vehicles · Average speed ${sNum} km/h`;
      }
    }
  }

  let raw = (alertItem.reason || alertItem.message || "").trim();
  if (!raw) return t ? t("alerts.dataUnavailable", "Data unavailable") : "Data unavailable";

  // Strip technical / AI buzzwords
  let cleaned = raw
    .replace(/Officer field intervention[^\.]*\.?/gi, "")
    .replace(/Advisory:?/gi, "")
    .replace(/Automated intelligence has identified/gi, "")
    .replace(/AI recommends/gi, "")
    .replace(/Camera feed detected/gi, "")
    .replace(/Immediate diversion required\.?/gi, "")
    .replace(/Critical congestion detected at [^\.]*\.\s*/gi, "")
    .replace(/\(Score:\s*[\d\.]+\)\.?/gi, "")
    .trim();

  // Format concise operational metrics
  const vOccMatch = cleaned.match(/(\d+)\s+active vehicles\.\s*Road occupancy\s*(\d+)%/i)
    || cleaned.match(/(\d+)\s+vehicles detected\s*·\s*Road occupancy\s*(\d+)%/i)
    || cleaned.match(/(\d+)\s+vehicles detected\s*\((\d+)%\s*occupancy\)/i);
  if (vOccMatch && t) {
    return t("alerts.vehiclesCountAndOccupancy", "{vehicles} vehicles · Road occupancy {occupancy}%", {
      vehicles: vOccMatch[1],
      occupancy: vOccMatch[2],
    });
  }

  const queueMatch = cleaned.match(/Traffic density exceeded\s*(\d+)%\s*capacity\.\s*Queue extending\s*(\d+m)/i);
  if (queueMatch && t) {
    return t("alerts.occupancyAndQueue", "Road occupancy {occupancy}% · Queue extending {queue}", {
      occupancy: queueMatch[1],
      queue: queueMatch[2],
    });
  }

  cleaned = cleaned.replace(/(\d+)\s+active vehicles\.\s*Road occupancy\s*(\d+)%/i, "$1 vehicles · Road occupancy $2%");
  cleaned = cleaned.replace(/(\d+)\s+vehicles detected\s*·\s*Road occupancy\s*(\d+)%/i, "$1 vehicles · Road occupancy $2%");
  cleaned = cleaned.replace(/(\d+)\s+vehicles detected\s*\((\d+)%\s*occupancy\)/i, "$1 vehicles · Road occupancy $2%");
  cleaned = cleaned.replace(/Traffic density exceeded\s*(\d+)%\s*capacity\.\s*Queue extending\s*(\d+m)/i, "Road occupancy $1% · Queue extending $2");

  if (!cleaned) return t ? t("alerts.trafficQueueIncreasing", "Traffic queue increasing") : "Traffic queue increasing";
  return cleaned;
}

/**
 * Concise operational required action
 */
function getRequiredActionText(alertItem, status, t) {
  if (
    status === "RESOLVED" ||
    status === "ACTION ACCEPTED" ||
    status === "ACTION REJECTED" ||
    status === "ACTION OVERRIDDEN"
  ) {
    return null;
  }

  const act = (alertItem.action || "").trim();
  if (act) {
    if (/Deploy field interceptor and trigger signal extension/i.test(act)) {
      return t ? t("alerts.dispatchFieldUnitAdjustSignal", "Dispatch field unit · Adjust signal") : "Dispatch field unit · Adjust signal";
    }
    if (/Divert vehicles|Activate flyover|Diversion recommended/i.test(act)) {
      return t ? t("alerts.reviewDiversionRoute", "Review diversion route") : "Review diversion route";
    }
  }

  if (alertItem.hasDiversion || alertItem.diversion_plan_id) {
    return t ? t("alerts.reviewDiversionRoute", "Review diversion route") : "Review diversion route";
  }

  const sev = getOperationalSeverity(alertItem.severity);
  if (sev === "CRITICAL") return t ? t("alerts.dispatchFieldUnit", "Dispatch field unit") : "Dispatch field unit";
  if (sev === "HIGH") return t ? t("alerts.monitorTrafficConditions", "Monitor traffic conditions") : "Monitor traffic conditions";
  return t ? t("alerts.monitorTrafficFlow", "Monitor traffic flow") : "Monitor traffic flow";
}

export default function AlertsPage({
  alerts = [],
  onViewAlert,
  onAcknowledgeAlert,
  onOfficerAction,
  onNavigateTab,
}) {
  const { settings, t, tJunction } = useSettings();
  const [filter, setFilter] = useState("ALL"); // ALL | CRITICAL | HIGH | WARNING
  const [localAlerts, setLocalAlerts] = useState(alerts);
  const [latestNotification, setLatestNotification] = useState(null);

  // Synchronize incoming alerts with in-memory state
  useEffect(() => {
    if (!alerts || alerts.length === 0) {
      setLocalAlerts([]);
      return;
    }
    setLocalAlerts(alerts);
  }, [alerts]);

  // Calculate actual unresolved incidents
  const activeCount = useMemo(() => {
    return localAlerts.filter((a) => {
      const s = getOperationalStatus(a.status);
      return s !== "RESOLVED";
    }).length;
  }, [localAlerts]);

  // Filtered incident list
  const filteredAlerts = useMemo(() => {
    return localAlerts.filter((a) => {
      if (filter === "ALL") return true;
      const sev = getOperationalSeverity(a.severity);
      if (filter === "CRITICAL") return sev === "CRITICAL";
      if (filter === "HIGH") return sev === "HIGH";
      if (filter === "WARNING") return sev === "WARNING";
      return true;
    });
  }, [localAlerts, filter]);

  // Officer Action Handler
  const handleAction = async (alertItem, actionType) => {
    const alertId = alertItem.alert_id || alertItem.id;
    const rawLocName = getCleanLocation(alertItem);
    const locName = tJunction ? tJunction(rawLocName) : rawLocName;
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

    let newStatus = "ACKNOWLEDGED";
    let actionUpdateText = t ? t("alerts.acknowledgedTitle", "Acknowledged") : "Acknowledged";
    let newCondition = alertItem.reason;

    if (actionType === "APPROVE" || actionType === "ACCEPT" || actionType === "ACCEPT_DIVERSION") {
      newStatus = "ACTION ACCEPTED";
      actionUpdateText = t ? t("alerts.diversionActiveDesc", "Diversion active · Alternate route deployed") : "Diversion accepted · Alternate route active";
      newCondition = "Diversion accepted · Alternate route active";
    } else if (actionType === "REJECT" || actionType === "REJECT_DIVERSION") {
      newStatus = "ACTION REJECTED";
      actionUpdateText = t ? t("alerts.actionRejected", "Diversion rejected") : "Diversion rejected";
      newCondition = "Diversion not activated";
    } else if (actionType === "OVERRIDE" || actionType === "MANUAL_CONTROL") {
      newStatus = "MANUAL CONTROL ACTIVE";
      actionUpdateText = t ? t("alerts.manualControlRecorded", "Manual control recorded") : "Manual control recorded";
      newCondition = "Manual control recorded";
    } else if (actionType === "RESOLVE") {
      newStatus = "RESOLVED";
      actionUpdateText = t ? t("alerts.trafficNormalizedDesc", "Resolved · Traffic normalized") : "Resolved · Traffic normalized";
      newCondition = "Traffic flow normalized";
    } else if (actionType === "ACKNOWLEDGE") {
      newStatus = "ACKNOWLEDGED";
      actionUpdateText = t ? t("alerts.acknowledgedTitle", "Acknowledged") : "Acknowledged";
    }

    // Zero-latency state update
    setLocalAlerts((prev) =>
      prev.map((a) => {
        const idMatches = (a.alert_id && a.alert_id === alertId) || (a.id && a.id === alertId);
        if (idMatches) {
          return {
            ...a,
            status: newStatus,
            reason: newCondition,
            action: (newStatus === "RESOLVED" || newStatus === "ACTION ACCEPTED" || newStatus === "ACTION REJECTED" || newStatus === "ACTION OVERRIDDEN") ? "" : a.action,
            timestamp: nowTime,
          };
        }
        return a;
      })
    );

    // Concise officer notification
    const notif = `${locName} · ${actionUpdateText} · ${nowTime}`;
    if (settings?.notifications?.diversionUpdates ?? true) {
      setLatestNotification({
        message: notif,
        time: nowTime,
      });
    }

    // Notify backend and parent state
    if (onOfficerAction) {
      await onOfficerAction(alertId, actionType, alertItem);
    } else if (onAcknowledgeAlert && actionType === "ACKNOWLEDGE") {
      onAcknowledgeAlert(alertId, alertItem);
    } else {
      sendOfficerAction(alertId, actionType, "OFFICER_TN_042", notif).catch(() => {});
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
      {/* ── Top Action Notification Banner ── */}
      {latestNotification && (
        <div
          style={{
            background: "var(--bg-surface-elevated, #252936)",
            color: "var(--text-primary, #F4F5F7)",
            padding: "0.55rem 0.875rem",
            borderRadius: "4px",
            fontSize: "0.75rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1px solid var(--border-default, #3D3F4E)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <span style={{ fontWeight: 800, color: "var(--accent-soft-blue, #7B8BC8)", letterSpacing: "0.05em" }}>
              {t("alerts.actionUpdate", "ACTION UPDATE")}
            </span>
            <span style={{ color: "var(--text-primary, #F4F5F7)" }}>{latestNotification.message}</span>
          </div>
          <span style={{ fontSize: "0.6875rem", color: "var(--text-muted, #737987)", fontFamily: "var(--font-mono, monospace)" }}>
            {latestNotification.time}
          </span>
        </div>
      )}

      {/* ── Page Header ── */}
      <div
        style={{
          background: "var(--bg-surface, #1B2028)",
          border: "1px solid var(--border-default, #3D3F4E)",
          borderRadius: "4px",
          padding: "0.875rem 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary, #F4F5F7)", margin: 0, letterSpacing: "-0.01em" }}>
            {t("alerts.title", "TRAFFIC INCIDENTS")}
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted, #737987)", margin: "0.2rem 0 0 0", fontWeight: 500 }}>
            {t("alerts.subtitle", "Active incidents, traffic alerts and officer actions")}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Functional Filters: ALL | CRITICAL | HIGH | WARNING */}
          <div style={{ display: "flex", gap: "0.3rem" }}>
            {[
              { id: "ALL", label: t("alerts.filterAll", "ALL") },
              { id: "CRITICAL", label: t("alerts.filterCritical", "CRITICAL") },
              { id: "HIGH", label: t("alerts.filterHigh", "HIGH") },
              { id: "WARNING", label: t("alerts.filterWarning", "WARNING") },
            ].map(({ id: f, label }) => {
              const isSelected = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  style={{
                    background: isSelected ? "var(--accent-soft-blue, #7B8BC8)" : "var(--bg-surface-secondary, #2C303C)",
                    color: isSelected ? "#111315" : "var(--text-secondary, #A7ACB8)",
                    border: `1px solid ${isSelected ? "var(--accent-soft-blue, #7B8BC8)" : "var(--border-default, #3D3F4E)"}`,
                    borderRadius: "4px",
                    padding: "0.25rem 0.6rem",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Active Count Badge */}
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 800,
              letterSpacing: "0.06em",
              padding: "0.25rem 0.6rem",
              borderRadius: "4px",
              background: activeCount > 0 ? "rgba(244, 94, 112, 0.12)" : "var(--bg-surface-secondary, #2C303C)",
              color: activeCount > 0 ? "var(--status-critical, #F45E70)" : "var(--text-muted, #737987)",
              border: `1px solid ${activeCount > 0 ? "rgba(244, 94, 112, 0.3)" : "var(--border-default, #3D3F4E)"}`,
            }}
          >
            {activeCount} {t("alerts.active", "ACTIVE")}
          </span>
        </div>
      </div>

      {/* ── Continuous Incident Log ── */}
      <div
        style={{
          background: "var(--bg-surface, #1B2028)",
          border: "1px solid var(--border-default, #3D3F4E)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        {filteredAlerts.length === 0 ? (
          <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "var(--text-muted, #737987)", fontSize: "0.8125rem" }}>
            {t("alerts.noIncidentsFound", "No incidents found for the selected filter.")}
          </div>
        ) : (
          filteredAlerts.map((item, idx) => {
            const sev = getOperationalSeverity(item.severity);
            const status = getOperationalStatus(item.status);
            const localizedSev = getLocalizedSeverity(sev, t);
            const localizedStatus = getLocalizedStatus(status, t);
            const sevColor = SEVERITY_COLORS[sev] || SEVERITY_COLORS.WARNING;
            const rawLocation = getCleanLocation(item);
            const location = tJunction ? tJunction(rawLocation) : rawLocation;
            const condition = getConditionText(item, status, t);
            const requiredAction = getRequiredActionText(item, status, t);
            const timeStr = formatIncidentTime(item.timestamp);

            const hasRecommendation = Boolean(
              item.hasDiversion || item.diversion_plan_id || item.action?.toLowerCase().includes("diversion") || item.reason?.toLowerCase().includes("divert")
            );
            const isResolved = status === "RESOLVED";

            let statusColor = "var(--text-primary, #F4F5F7)";
            if (isResolved) statusColor = "var(--status-normal, #22C55E)";
            else if (status === "NEW") statusColor = "var(--status-critical, #F45E70)";
            else if (status === "ACTION ACCEPTED") statusColor = "var(--status-normal, #22C55E)";
            else if (status === "ACTION REJECTED") statusColor = "var(--text-muted, #737987)";
            else if (status === "ACTION OVERRIDDEN" || status === "MANUAL CONTROL ACTIVE") statusColor = "var(--status-high, #F59E0B)";

            return (
              <div
                key={item.alert_id || item.id || idx}
                style={{
                  padding: "1.125rem 1.375rem",
                  borderBottom: idx < filteredAlerts.length - 1 ? "1px solid var(--border-light, #2C303C)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  background: isResolved ? "var(--bg-surface, #1B2028)" : "var(--bg-surface, #1B2028)",
                }}
              >
                {/* 1. SEVERITY · TIME · STATUS */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.75rem", letterSpacing: "0.04em", fontWeight: 700 }}>
                  <span style={{ color: sevColor }}>{localizedSev}</span>
                  <span style={{ color: "var(--border-strong, #4A4E5D)" }}>·</span>
                  <span style={{ color: "var(--text-muted, #737987)", fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>
                    {timeStr.toUpperCase()}
                  </span>
                  <span style={{ color: "var(--border-strong, #4A4E5D)" }}>·</span>
                  <span style={{ color: statusColor }}>{localizedStatus}</span>
                </div>

                {/* 2. LOCATION */}
                <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--text-primary, #F4F5F7)", marginTop: "0.15rem" }}>
                  {location}
                </div>

                {/* 3. CURRENT CONDITION */}
                <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary, #A7ACB8)", fontWeight: 500 }}>
                  {condition}
                </div>

                {/* 4. REQUIRED ACTION (Only on active actionable states) */}
                {requiredAction && (
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-muted, #737987)", fontWeight: 500 }}>
                    {requiredAction}
                  </div>
                )}

                {/* 5. ACTIONS */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.4rem" }}>
                  {/* VIEW MAP: Always present */}
                  <button
                    type="button"
                    onClick={() => onViewAlert && onViewAlert(item)}
                    style={{
                      background: "var(--bg-surface-secondary, #2C303C)",
                      border: "1px solid var(--border-default, #3D3F4E)",
                      color: "var(--text-primary, #F4F5F7)",
                      borderRadius: "4px",
                      padding: "0.325rem 0.65rem",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <MapPin size={11} />
                    {t("actions.viewMap", "VIEW MAP")}
                  </button>

                  {/* State: NEW -> ACKNOWLEDGE and APPROVE/REJECT/MANUAL CONTROL if recommendation exists */}
                  {status === "NEW" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAction(item, "ACKNOWLEDGE")}
                        style={{
                          background: "var(--accent-indigo, #3E4776)",
                          border: "1px solid var(--border-strong, #4A4E5D)",
                          color: "var(--text-primary, #F4F5F7)",
                          borderRadius: "4px",
                          padding: "0.325rem 0.65rem",
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {t("actions.acknowledge", "ACKNOWLEDGE")}
                      </button>

                      {hasRecommendation && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAction(item, "APPROVE")}
                            style={{
                              background: "var(--status-normal, #22C55E)",
                              border: "1px solid var(--status-normal, #22C55E)",
                              color: "#111315",
                              borderRadius: "4px",
                              padding: "0.325rem 0.65rem",
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {t("actions.approve", "APPROVE")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction(item, "REJECT")}
                            style={{
                              background: "var(--bg-surface-secondary, #2C303C)",
                              border: "1px solid var(--status-critical, #F45E70)",
                              color: "var(--status-critical, #F45E70)",
                              borderRadius: "4px",
                              padding: "0.325rem 0.65rem",
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {t("actions.reject", "REJECT")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction(item, "MANUAL_CONTROL")}
                            style={{
                              background: "var(--bg-surface-secondary, #2C303C)",
                              border: "1px solid var(--border-default, #3D3F4E)",
                              color: "var(--text-secondary, #A7ACB8)",
                              borderRadius: "4px",
                              padding: "0.325rem 0.65rem",
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {t("actions.manualControl", "MANUAL CONTROL")}
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {/* State: ACKNOWLEDGED -> APPROVE/REJECT/MANUAL CONTROL if recommendation exists, or RESOLVE */}
                  {status === "ACKNOWLEDGED" && (
                    <>
                      {hasRecommendation && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAction(item, "APPROVE")}
                            style={{
                              background: "var(--status-normal, #22C55E)",
                              border: "1px solid var(--status-normal, #22C55E)",
                              color: "#111315",
                              borderRadius: "4px",
                              padding: "0.325rem 0.65rem",
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {t("actions.approve", "APPROVE")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction(item, "REJECT")}
                            style={{
                              background: "var(--bg-surface-secondary, #2C303C)",
                              border: "1px solid var(--status-critical, #F45E70)",
                              color: "var(--status-critical, #F45E70)",
                              borderRadius: "4px",
                              padding: "0.325rem 0.65rem",
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {t("actions.reject", "REJECT")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction(item, "MANUAL_CONTROL")}
                            style={{
                              background: "var(--bg-surface-secondary, #2C303C)",
                              border: "1px solid var(--border-default, #3D3F4E)",
                              color: "var(--text-secondary, #A7ACB8)",
                              borderRadius: "4px",
                              padding: "0.325rem 0.65rem",
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {t("actions.manualControl", "MANUAL CONTROL")}
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => handleAction(item, "RESOLVE")}
                        style={{
                          background: "var(--bg-surface-secondary, #2C303C)",
                          border: "1px solid var(--border-default, #3D3F4E)",
                          color: "var(--status-normal, #22C55E)",
                          borderRadius: "4px",
                          padding: "0.325rem 0.65rem",
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {t("actions.resolve", "RESOLVE")}
                      </button>
                    </>
                  )}

                  {/* State: ACTION ACCEPTED / REJECTED / OVERRIDDEN -> RESOLVE */}
                  {(status === "ACTION ACCEPTED" || status === "ACTION REJECTED" || status === "ACTION OVERRIDDEN" || status === "MANUAL CONTROL ACTIVE") && (
                    <button
                      type="button"
                      onClick={() => handleAction(item, "RESOLVE")}
                      style={{
                        background: "var(--bg-surface-secondary, #2C303C)",
                        border: "1px solid var(--border-default, #3D3F4E)",
                        color: "var(--status-normal, #22C55E)",
                        borderRadius: "4px",
                        padding: "0.325rem 0.65rem",
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {t("actions.resolve", "RESOLVE")}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Compact Response Guidance Section ── */}
      <div
        style={{
          background: "var(--bg-surface, #1B2028)",
          border: "1px solid var(--border-default, #3D3F4E)",
          borderRadius: "4px",
          padding: "0.875rem 1.25rem",
        }}
      >
        <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: "var(--text-muted, #737987)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.625rem" }}>
          {t("alerts.responseGuidance", "RESPONSE GUIDANCE")}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem", fontSize: "0.75rem" }}>
          <div style={{ borderLeft: "3px solid var(--status-critical, #F45E70)", paddingLeft: "0.625rem" }}>
            <span style={{ fontWeight: 800, color: "var(--status-critical, #F45E70)", display: "block", marginBottom: "0.15rem" }}>
              {t("status.critical", "CRITICAL").toUpperCase()}
            </span>
            <p style={{ color: "var(--text-secondary, #A7ACB8)", margin: 0, lineHeight: 1.45 }}>
              {t("alerts.guidanceCritical", "Immediate officer attention required. Review the recommended action and route conditions.")}
            </p>
          </div>

          <div style={{ borderLeft: "3px solid var(--status-high, #F59E0B)", paddingLeft: "0.625rem" }}>
            <span style={{ fontWeight: 800, color: "var(--status-high, #F59E0B)", display: "block", marginBottom: "0.15rem" }}>
              {t("status.high", "HIGH").toUpperCase()}
            </span>
            <p style={{ color: "var(--text-secondary, #A7ACB8)", margin: 0, lineHeight: 1.45 }}>
              {t("alerts.guidanceHigh", "Monitor the location and review the recommended action.")}
            </p>
          </div>

          <div style={{ borderLeft: "3px solid var(--status-moderate, #C2BB91)", paddingLeft: "0.625rem" }}>
            <span style={{ fontWeight: 800, color: "var(--status-moderate, #C2BB91)", display: "block", marginBottom: "0.15rem" }}>
              {t("alerts.filterWarning", "WARNING")}
            </span>
            <p style={{ color: "var(--text-secondary, #A7ACB8)", margin: 0, lineHeight: 1.45 }}>
              {t("alerts.guidanceWarning", "Continue monitoring traffic conditions.")}
            </p>
          </div>
        </div>

        <div style={{ fontSize: "0.6875rem", color: "var(--text-muted, #737987)", fontStyle: "italic", borderTop: "1px solid var(--border-light, #2C303C)", paddingTop: "0.5rem", marginTop: "0.625rem" }}>
          {t("alerts.guidanceDisclaimer", "Decision support guidance only. Officer remains responsible for the final operational decision.")}
        </div>
      </div>
    </div>
  );
}
