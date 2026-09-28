import React, { useState } from "react";
import { X } from "lucide-react";
import { getRiskLevel } from "../services/tamilNaduTrafficData";

export default function JunctionDetailPanel({
  junction,
  onClose,
  onViewCamera,
  onEvaluateRoute,
  onOfficerAction,
  activeCameraId,
}) {
  const [decisionFeedback, setDecisionFeedback] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [isRouteEvaluated, setIsRouteEvaluated] = useState(false);

  if (!junction) return null;

  const risk = getRiskLevel(junction.congestionScore);
  const m = junction.metrics || {};
  const pred = junction.prediction || {};
  const div = junction.diversion || {};

  const handleActionClick = async (actionType) => {
    setActionInProgress(true);
    try {
      if ((actionType === "ACCEPT_DIVERSION" || actionType === "APPROVE") && onEvaluateRoute) {
        onEvaluateRoute(junction);
        setIsRouteEvaluated(true);
      }
      if (onOfficerAction) {
        await onOfficerAction(junction.id, actionType);
      }
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      if (actionType === "ACCEPT_DIVERSION" || actionType === "APPROVE") {
        setDecisionFeedback({
          type: "DIVERSION",
          route: div.recommendedName || "Flyover Route",
          time: timeStr,
        });
      } else {
        setDecisionFeedback({
          type: "ACTION",
          action: actionType,
          time: timeStr,
        });
      }
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleEvaluateClick = () => {
    if (onEvaluateRoute) {
      onEvaluateRoute(junction);
    }
    setIsRouteEvaluated(true);
  };

  // 1. Header Information
  const isCritical = junction.congestionScore >= 0.81;
  const isHigh = junction.congestionScore >= 0.61 && !isCritical;
  const statusLabel = isCritical ? "CRITICAL" : isHigh ? "HIGH" : junction.status === "LIVE" ? "LIVE" : "MODERATE";
  const statusColor = isCritical ? "#DC2626" : isHigh ? "#EA580C" : "#16A34A";
  const riskScore = Math.round((junction.congestionScore || 0) * 100);

  // 2. Diversion recommendation text
  const recommendedRouteText = div.recommendedName || "the flyover route";
  const diversionWordingClean = `Use ${recommendedRouteText} to reduce congestion at ${junction.name}.`;

  // 3. Traffic Forecast readings
  const nowVal = pred.current || (isCritical ? "HIGH" : "MODERATE");
  const plus15Val = pred.next15Min || (isCritical ? "CRITICAL" : "HIGH");
  const plus30Val = pred.next30Min || (isCritical ? "CRITICAL" : "MODERATE");
  const confidenceVal = pred.confidence ? `${pred.confidence}%` : "90%";
  const expectedTextBold = (isCritical || plus15Val === "CRITICAL" || plus30Val === "CRITICAL")
    ? "Congestion increasing"
    : junction.congestionScore <= 0.35
    ? "Traffic flow stable"
    : "Moderate inflow persisting";

  // Forecast color helper: use neutral palette primarily unless meaningful severity shift occurs
  const getForecastColor = (val) => {
    const v = (val || "").toUpperCase();
    if (v === "CRITICAL") return "var(--status-critical, #F45E70)";
    if (v === "HIGH") return "var(--status-high, #F59E0B)";
    if (v === "NORMAL") return "var(--status-normal, #22C55E)";
    return "var(--text-primary, #F4F5F7)";
  };

  return (
    <div
      style={{
        background: "var(--bg-surface, #1B2028)",
        border: "1px solid var(--border-default, #3D3F4E)",
        borderRadius: "4px",
        padding: "0.875rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* 1. HEADER: STATUS DOT + NAME ON LEFT, TRAFFIC RISK ON RIGHT */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: statusColor,
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 800,
                color: statusColor,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {statusLabel}
            </span>
          </div>

          <h3
            style={{
              fontSize: "1.125rem",
              fontWeight: 800,
              color: "var(--text-primary, #F4F5F7)",
              marginTop: "0.25rem",
              letterSpacing: "0.01em",
              textTransform: "uppercase",
            }}
          >
            {junction.name}
          </h3>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted, #737987)", marginTop: "1px" }}>
            {junction.area || junction.district} • {junction.district}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem", flexShrink: 0 }}>
          {/* TRAFFIC RISK: Dominant score with muted / 100 */}
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "0.5625rem",
                fontWeight: 800,
                color: "var(--text-muted, #737987)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              TRAFFIC RISK
            </div>
            <div
              style={{
                fontSize: "1.625rem",
                fontWeight: 800,
                color: risk.color,
                lineHeight: 1.1,
                fontFamily: "var(--font-sans)",
              }}
            >
              {riskScore}{" "}
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #737987)", fontWeight: 600 }}>/ 100</span>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--text-muted, #737987)",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
              title="Close panel"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 2. OFFICER ACTIONS ROW (No surrounding container card) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => handleActionClick("APPROVE")}
            disabled={actionInProgress}
            style={{
              height: "28px",
              padding: "0 0.85rem",
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.02em",
              background: "transparent",
              color: "var(--status-normal, #22C55E)",
              border: "1px solid var(--status-normal, #22C55E)",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Approve
          </button>

          <button
            type="button"
            onClick={() => handleActionClick("REJECT")}
            disabled={actionInProgress}
            style={{
              height: "28px",
              padding: "0 0.85rem",
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.02em",
              background: "transparent",
              color: "var(--status-critical, #F45E70)",
              border: "1px solid var(--status-critical, #F45E70)",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Reject
          </button>

          <button
            type="button"
            onClick={() => handleActionClick("RESOLVE")}
            disabled={actionInProgress}
            style={{
              height: "28px",
              padding: "0 0.85rem",
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.02em",
              background: "var(--bg-surface-elevated, #252936)",
              color: "var(--text-primary, #F4F5F7)",
              border: "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Resolve
          </button>
        </div>

        {decisionFeedback && (
          <div style={{ marginTop: "0.15rem" }}>
            <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--status-normal, #22C55E)" }}>
              {decisionFeedback.type === "DIVERSION"
                ? `Action Approved: ${decisionFeedback.route}`
                : `Dispatched: ${decisionFeedback.action.replace("_", " ")}`}
            </span>
          </div>
        )}
      </div>

      {/* 3. DIVERSION RECOMMENDED (Clean direct statement with centered action button) */}
      <div
        style={{
          borderTop: "1px solid var(--border-light, #2C303C)",
          paddingTop: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.35rem",
        }}
      >
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 800,
            color: "var(--text-primary, #F4F5F7)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          DIVERSION RECOMMENDED
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--text-secondary, #A7ACB8)",
            fontWeight: 500,
            lineHeight: 1.45,
          }}
        >
          {diversionWordingClean}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: "0.4rem" }}>
          <button
            type="button"
            onClick={handleEvaluateClick}
            disabled={actionInProgress}
            style={{
              height: "28px",
              padding: "0 1.25rem",
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.02em",
              background: "var(--bg-surface-elevated, #252936)",
              color: "var(--accent-soft-blue, #7B8BC8)",
              border: "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Review Diversion
          </button>
        </div>
      </div>

      {/* 4. TRAFFIC DATA (2x2 Grid) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.6rem 1rem",
          padding: "0.75rem 0",
          borderTop: "1px solid var(--border-light, #2C303C)",
          borderBottom: "1px solid var(--border-light, #2C303C)",
        }}
      >
        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted, #737987)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            VEHICLES
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary, #F4F5F7)", marginTop: "2px", fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>
            {m.vehicleCount != null ? m.vehicleCount : "Data unavailable"}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted, #737987)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            SPEED
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: m.averageSpeedKmh != null && m.averageSpeedKmh < 20 ? "var(--status-critical, #F45E70)" : "var(--text-primary, #F4F5F7)", marginTop: "2px", fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>
            {m.averageSpeedKmh != null ? `${m.averageSpeedKmh} km/h` : "Data unavailable"}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted, #737987)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            FLOW
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary, #F4F5F7)", marginTop: "2px", fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>
            {m.trafficFlowVpm != null ? `${m.trafficFlowVpm} veh/min` : "Data unavailable"}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted, #737987)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            OCCUPANCY
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: m.roadOccupancyPct != null && m.roadOccupancyPct > 70 ? "var(--status-critical, #F45E70)" : "var(--text-primary, #F4F5F7)", marginTop: "2px", fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>
            {m.roadOccupancyPct != null ? `${m.roadOccupancyPct}%` : "Data unavailable"}
          </div>
        </div>
      </div>

      {/* 5. TRAFFIC FORECAST + CONFIDENCE ON SAME HEADER LINE */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "var(--text-primary, #F4F5F7)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            TRAFFIC FORECAST
          </span>
          <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted, #737987)", letterSpacing: "0.03em" }}>
            CONFIDENCE {confidenceVal}
          </span>
        </div>

        {/* Horizons: NOW / +15 MIN / +30 MIN */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginTop: "0.15rem" }}>
          <div>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted, #737987)", fontWeight: 700 }}>
              NOW
            </div>
            <div style={{ fontSize: "0.875rem", fontWeight: 800, color: getForecastColor(nowVal), marginTop: "3px" }}>
              {nowVal}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted, #737987)", fontWeight: 700 }}>
              +15 MIN
            </div>
            <div style={{ fontSize: "0.875rem", fontWeight: 800, color: getForecastColor(plus15Val), marginTop: "3px" }}>
              {plus15Val}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted, #737987)", fontWeight: 700 }}>
              +30 MIN
            </div>
            <div style={{ fontSize: "0.875rem", fontWeight: 800, color: getForecastColor(plus30Val), marginTop: "3px" }}>
              {plus30Val}
            </div>
          </div>
        </div>

        {/* Expected line */}
        <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "var(--text-secondary, #A7ACB8)" }}>
          <span style={{ color: "var(--text-muted, #737987)", fontWeight: 600 }}>Expected: </span>
          <span style={{ color: "var(--text-primary, #F4F5F7)", fontWeight: 700 }}>{expectedTextBold}</span>
        </div>
      </div>
    </div>
  );
}
