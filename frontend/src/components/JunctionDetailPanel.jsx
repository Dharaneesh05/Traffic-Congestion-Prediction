import React, { useState } from "react";
import {
  AlertTriangle,
  Camera,
  Navigation,
  CheckCircle2,
  TrendingUp,
  Activity,
  ShieldAlert,
  Send,
  Radio,
  Clock,
  X,
  SlidersHorizontal,
  Bell
} from "lucide-react";
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

  if (!junction) return null;

  const risk = getRiskLevel(junction.congestionScore);
  const m = junction.metrics || {};
  const pred = junction.prediction || {};
  const cameras = junction.cameras || [];

  const handleActionClick = async (actionType) => {
    setActionInProgress(true);
    try {
      if (actionType === "ACCEPT_DIVERSION" && onEvaluateRoute) {
        onEvaluateRoute(junction);
      }
      if (onOfficerAction) {
        await onOfficerAction(junction.id, actionType);
      }
      setDecisionFeedback(`Action "${actionType.replace("_", " ")}" recorded and dispatched.`);
      setTimeout(() => setDecisionFeedback(null), 4000);
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xs)",
        padding: "0.875rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* 1. Header with Junction Name & Status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.625rem",
                fontWeight: 800,
                padding: "2px 6px",
                borderRadius: "2px",
                background: risk.bg,
                color: risk.color,
                border: `1px solid ${risk.border}`,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {junction.status || risk.label} CONGESTION
            </span>
          </div>

          <h3
            style={{
              fontSize: "1.0625rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              marginTop: "0.25rem",
              letterSpacing: "-0.01em",
            }}
          >
            {junction.name}
          </h3>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "1px" }}>
            {junction.area} • {junction.district} District • Roads: {(junction.roads || []).join(", ")}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {/* Congestion Risk Score Badge (e.g. 78 / 100) */}
          <div
            style={{
              textAlign: "right",
              background: "var(--bg-card-subtle)",
              padding: "0.25rem 0.625rem",
              borderRadius: "2px",
              border: "1px solid var(--border-light)",
            }}
          >
            <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Risk Score
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: risk.color, lineHeight: 1.1 }}>
              {Math.round((junction.congestionScore || 0) * 100)} <span style={{ fontSize: "0.875rem", color: "var(--text-muted)", fontWeight: 600 }}>/ 100</span>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: "2px",
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* High-Risk Diversion Alert Banner with 1-Click Accept */}
      {(junction.congestionScore >= 0.6 || risk.label === "CRITICAL" || risk.label === "HIGH") && (
        <div
          style={{
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            borderRadius: "2px",
            padding: "0.5rem 0.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <AlertTriangle size={15} color="#e11d48" />
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#9f1239" }}>
                DIVERSION RECOMMENDED — Critical Corridor Congestion
              </div>
              <div style={{ fontSize: "0.6875rem", color: "#be123c", marginTop: "1px" }}>
                {junction.recommendedAction || "Heavy volume bottleneck. Reroute corridor flow onto alternate bypass link."}
              </div>
            </div>
          </div>
          <button
            onClick={() => handleActionClick("ACCEPT_DIVERSION")}
            disabled={actionInProgress}
            style={{
              padding: "0.3rem 0.625rem",
              fontSize: "0.6875rem",
              fontWeight: 800,
              background: "#e11d48",
              color: "#ffffff",
              border: "none",
              borderRadius: "2px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <Navigation size={12} />
            Accept Diversion
          </button>
        </div>
      )}

      {/* 2. Traffic Metrics Grid: Inflow rate, Occupancy, Dominant Vehicle */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "0.75rem",
          background: "var(--bg-card-subtle)",
          padding: "0.625rem 0.75rem",
          borderRadius: "2px",
          border: "1px solid var(--border-light)",
        }}
      >
        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Vehicles Detected
          </div>
          <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "1px" }}>
            {m.vehicleCount != null ? m.vehicleCount : "--"}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Avg Speed
          </div>
          <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "1px" }}>
            {m.averageSpeedKmh != null ? `${m.averageSpeedKmh} km/h` : "--"}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Inflow Rate
          </div>
          <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "1px" }}>
            {m.trafficFlowVpm != null ? `${m.trafficFlowVpm} veh/min` : "--"}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Road Occupancy
          </div>
          <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "1px" }}>
            {m.roadOccupancyPct != null ? `${m.roadOccupancyPct}%` : "--"}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Dominant Vehicle
          </div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" }}>
            {junction.dominantVehicle || m.dominantVehicle || (junction.congestionScore > 0.6 ? "Commercial / Bus" : "Passenger Cars")}
          </div>
        </div>
      </div>

      {/* Signal Timing Advisory */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "#f8fafc",
          border: "1px solid var(--border-light)",
          borderRadius: "2px",
          padding: "0.35rem 0.625rem",
          fontSize: "0.6875rem",
          color: "var(--text-secondary)",
        }}
      >
        <SlidersHorizontal size={13} color="#2563eb" />
        <span>
          <strong style={{ color: "var(--text-primary)" }}>Signal Timing Advisory:</strong>{" "}
          {junction.signalAdvisory || (junction.congestionScore > 0.6
            ? `Extend Green phase by +25s on ${(junction.roads && junction.roads[0]) || "main"} approach.`
            : "Standard cyclic timing active on approach corridor.")}
        </span>
      </div>

      {/* 3. Prediction Section & Incident Banner */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "0.625rem" }}>
        {/* Prediction Box */}
        <div
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: "2px",
            padding: "0.5rem 0.75rem",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Congestion Prediction
            </span>
            <span style={{ fontSize: "0.625rem", color: "#64748b", fontWeight: 600 }}>
              Confidence: {pred.confidence || 88}%
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.35rem" }}>
            <div style={{ textAlign: "center", flex: 1, background: "var(--bg-card-subtle)", padding: "0.35rem", borderRadius: "2px" }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", fontWeight: 600 }}>NOW</div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {pred.current || "MODERATE"}
              </div>
            </div>
            <span style={{ color: "#94a3b8", fontWeight: 700 }}>→</span>
            <div style={{ textAlign: "center", flex: 1, background: "#fff7ed", padding: "0.35rem", borderRadius: "2px", border: "1px solid #fed7aa" }}>
              <div style={{ fontSize: "0.625rem", color: "#ea580c", fontWeight: 600 }}>+15 MIN</div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#ea580c" }}>
                {pred.next15Min || "HIGH"}
              </div>
            </div>
            <span style={{ color: "#94a3b8", fontWeight: 700 }}>→</span>
            <div style={{ textAlign: "center", flex: 1, background: "#fef2f2", padding: "0.35rem", borderRadius: "2px", border: "1px solid #fecaca" }}>
              <div style={{ fontSize: "0.625rem", color: "#dc2626", fontWeight: 600 }}>+30 MIN</div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#dc2626" }}>
                {pred.next30Min || "CRITICAL"}
              </div>
            </div>
          </div>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
            Trend: <strong>{pred.trend || "Stable traffic pattern"}</strong>
          </div>
        </div>

        {/* Incident Box */}
        <div
          style={{
            border: "1px solid #fed7aa",
            borderRadius: "2px",
            padding: "0.5rem 0.75rem",
            background: "#fff7ed",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#c2410c", fontWeight: 700, fontSize: "0.6875rem" }}>
              <AlertTriangle size={12} />
              <span>{junction.incident?.title || "Active Traffic Incident"}</span>
            </div>
            <p style={{ fontSize: "0.625rem", color: "#7c2d12", marginTop: "0.125rem", lineHeight: 1.3 }}>
              {junction.incident?.description || "Traffic corridor anomaly detected under active surveillance."}
            </p>
          </div>
          <div style={{ fontSize: "0.5625rem", color: "#9a3412", fontWeight: 600, marginTop: "0.25rem" }}>
            Reported: {junction.incident?.time || "Active now"}
          </div>
        </div>
      </div>

      {/* 4. Nearby Cameras & Recommended Action */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "0.625rem" }}>
        {/* Nearby Cameras List */}
        <div style={{ border: "1px solid var(--border-default)", borderRadius: "2px", padding: "0.5rem 0.75rem" }}>
          <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.25rem" }}>
            Nearby Cameras ({cameras.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {cameras.map((c) => {
              const isOnline = c.status === "ONLINE";
              const isSelected = activeCameraId === c.id;

              return (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.25rem 0.375rem",
                    borderRadius: "2px",
                    background: isSelected ? "#e2e8f0" : "var(--bg-card-subtle)",
                    border: isSelected ? "1px solid #94a3b8" : "1px solid var(--border-light)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <Camera size={12} color={isOnline ? "#16a34a" : "#94a3b8"} />
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {c.name}
                    </span>
                    <span style={{ fontSize: "0.5625rem", color: "var(--text-muted)" }}>
                      ({c.approach})
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <span
                      style={{
                        fontSize: "0.5625rem",
                        fontWeight: 700,
                        color: isOnline ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {c.status}
                    </span>
                    <button
                      onClick={() => onViewCamera && onViewCamera(c.id)}
                      disabled={!isOnline}
                      style={{
                        padding: "1px 5px",
                        fontSize: "0.5625rem",
                        fontWeight: 700,
                        background: isOnline ? "#0f172a" : "#cbd5e1",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "2px",
                        cursor: isOnline ? "pointer" : "not-allowed",
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommended Action & Evaluation */}
        <div
          style={{
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            borderRadius: "2px",
            padding: "0.5rem 0.75rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "#1e40af", textTransform: "uppercase" }}>
              Recommended Traffic-Management Action
            </div>
            <p style={{ fontSize: "0.6875rem", color: "#1e3a8a", fontWeight: 600, marginTop: "0.25rem", lineHeight: 1.4 }}>
              "{junction.recommendedAction || "Monitor approach corridor and coordinate signal timing."}"
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.5rem" }}>
            <button
              onClick={() => onEvaluateRoute && onEvaluateRoute(junction)}
              style={{
                flex: 1,
                padding: "0.3rem 0.5rem",
                fontSize: "0.6875rem",
                fontWeight: 700,
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "2px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.25rem",
              }}
            >
              <Navigation size={12} />
              Evaluate Route Diversion
            </button>
          </div>
        </div>
      </div>

      {/* 5. Human-in-the-Loop Decision Buttons */}
      <div
        style={{
          borderTop: "1px solid var(--border-light)",
          paddingTop: "0.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.375rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Officer Action:
          </span>

          <button
            onClick={() => handleActionClick("ACKNOWLEDGE")}
            disabled={actionInProgress}
            style={{
              padding: "0.25rem 0.5rem",
              fontSize: "0.6875rem",
              fontWeight: 700,
              background: "#f1f5f9",
              color: "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: "2px",
              cursor: "pointer",
            }}
          >
            Acknowledge
          </button>

          <button
            onClick={() => handleActionClick("ACCEPT_DIVERSION")}
            disabled={actionInProgress}
            style={{
              padding: "0.25rem 0.5rem",
              fontSize: "0.6875rem",
              fontWeight: 700,
              background: "#16a34a",
              color: "#ffffff",
              border: "none",
              borderRadius: "2px",
              cursor: "pointer",
            }}
          >
            Accept Diversion
          </button>

          <button
            onClick={() => handleActionClick("OVERRIDE")}
            disabled={actionInProgress}
            style={{
              padding: "0.25rem 0.5rem",
              fontSize: "0.6875rem",
              fontWeight: 700,
              background: "#d97706",
              color: "#ffffff",
              border: "none",
              borderRadius: "2px",
              cursor: "pointer",
            }}
          >
            Override
          </button>

          <button
            onClick={() => handleActionClick("REJECT")}
            disabled={actionInProgress}
            style={{
              padding: "0.25rem 0.5rem",
              fontSize: "0.6875rem",
              fontWeight: 700,
              background: "#dc2626",
              color: "#ffffff",
              border: "none",
              borderRadius: "2px",
              cursor: "pointer",
            }}
          >
            Reject
          </button>

          <button
            onClick={() => handleActionClick("NOTIFY_UNIT")}
            disabled={actionInProgress}
            style={{
              padding: "0.25rem 0.5rem",
              fontSize: "0.6875rem",
              fontWeight: 700,
              background: "#475569",
              color: "#ffffff",
              border: "none",
              borderRadius: "2px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <Radio size={11} />
            Notify Unit
          </button>
        </div>

        {decisionFeedback && (
          <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#16a34a" }}>
            {decisionFeedback}
          </span>
        )}
      </div>
    </div>
  );
}
