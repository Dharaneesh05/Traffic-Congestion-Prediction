import React from "react";
import { MapPin, AlertTriangle, Video, Activity, TrendingUp, ChevronRight, X } from "lucide-react";

export default function LocationOverviewBanner({
  overview,
  districtName,
  junctions = [],
  selectedJunctionId,
  onSelectJunction,
  onClose,
}) {
  if (!overview && !districtName) return null;

  const majorCount = overview?.majorJunctionsCount || junctions.length || 0;
  const highRiskCount = overview?.highRiskJunctionsCount || junctions.filter(j => j.congestionScore >= 0.61).length || 0;
  const incidentCount = overview?.activeIncidentsCount || junctions.filter(j => j.incident).length || 0;
  const onlineCams = overview?.availableCamerasCount || junctions.reduce((acc, j) => acc + (j.cameras?.filter(c => c.status === "ONLINE").length || 0), 0);
  const offlineCams = overview?.offlineCamerasCount || junctions.reduce((acc, j) => acc + (j.cameras?.filter(c => c.status === "OFFLINE").length || 0), 0);
  const predCongestion = overview?.predictedCongestion || (highRiskCount > 1 ? "High" : "Moderate");

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xs)",
        padding: "0.625rem 0.875rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            {districtName} OPERATIONS
          </span>
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
            title="Dismiss Overview"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Overview Stat Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "0.5rem",
          background: "var(--bg-card-subtle)",
          padding: "0.5rem 0.75rem",
          borderRadius: "2px",
          border: "1px solid var(--border-light)",
        }}
      >
        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Major Junctions
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "1px" }}>
            {majorCount}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            High Risk
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: highRiskCount > 0 ? "#dc2626" : "var(--text-primary)", marginTop: "1px" }}>
            {highRiskCount}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Active Incidents
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: incidentCount > 0 ? "#ea580c" : "var(--text-primary)", marginTop: "1px" }}>
            {incidentCount}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Cameras Online
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#16a34a", marginTop: "1px" }}>
            {onlineCams}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Cameras Offline
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#64748b", marginTop: "1px" }}>
            {offlineCams}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Predicted Trend
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "3px" }}>
            {predCongestion}
          </div>
        </div>
      </div>

      {/* Junction Discovery Operational Table */}
      {junctions.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "0.5rem" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.35rem" }}>
            Monitored Junctions ({junctions.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.5rem" }}>
            {junctions.map((j) => {
              const isSel = selectedJunctionId === j.id;
              const isCrit = j.congestionScore >= 0.81;
              const isHigh = j.congestionScore >= 0.61 && j.congestionScore < 0.81;
              const isMod = j.congestionScore >= 0.31 && j.congestionScore < 0.61;
              const statusColor = isCrit ? "#dc2626" : isHigh ? "#ea580c" : isMod ? "#ca8a04" : "#16a34a";
              const statusBg = isCrit ? "#fef2f2" : isHigh ? "#fff7ed" : isMod ? "#fefce8" : "#f0fdf4";

              return (
                <div
                  key={j.id}
                  onClick={() => onSelectJunction && onSelectJunction(j)}
                  style={{
                    border: isSel ? "1.5px solid #0f172a" : "1px solid var(--border-default)",
                    borderRadius: "2px",
                    padding: "0.4rem 0.6rem",
                    background: isSel ? "#f8fafc" : "#ffffff",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>{j.name}</span>
                      <span style={{ fontSize: "0.5625rem", fontWeight: 800, color: statusColor, background: statusBg, padding: "1px 4px", borderRadius: "2px" }}>
                        {j.status || (isCrit ? "CRITICAL" : isHigh ? "HIGH" : isMod ? "MODERATE" : "NORMAL")}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.625rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Veh: <strong>{j.metrics?.vehicleCount ?? "--"}</strong> • Speed: <strong>{j.metrics?.averageSpeedKmh != null ? `${j.metrics.averageSpeedKmh} km/h` : "--"}</strong> • Occ: <strong>{j.metrics?.roadOccupancyPct != null ? `${j.metrics.roadOccupancyPct}%` : "--"}</strong>
                    </div>
                  </div>
                  <button
                    style={{
                      border: "none",
                      background: isSel ? "#0f172a" : "#f1f5f9",
                      color: isSel ? "#ffffff" : "#334155",
                      fontSize: "0.625rem",
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: "2px",
                      cursor: "pointer",
                    }}
                  >
                    {isSel ? "Active" : "Inspect"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
