import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, Filter, Check } from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import { JUNCTION_NAMES } from "../i18n/translations";

function formatJunctionStatus(rawStatus, congestionScore) {
  if (!rawStatus) {
    if (congestionScore >= 0.81) return "CRITICAL";
    if (congestionScore >= 0.61) return "HIGH";
    if (congestionScore >= 0.31) return "MODERATE";
    return "NORMAL";
  }
  const s = String(rawStatus).toUpperCase().trim();
  if (s === "LIVE_CONNECTED" || s === "LIVE" || s === "ONLINE") return "LIVE";
  if (s === "OFFLINE") return "OFFLINE";
  if (s === "UNAVAILABLE" || s === "DISCONNECTED") return "UNAVAILABLE";
  if (s === "ANALYSIS_STOPPED" || s === "ANALYSIS STOPPED") return "ANALYSIS STOPPED";
  return s.replace(/_/g, " ");
}

function getStatusBadgeStyle(status) {
  switch (status) {
    case "LIVE":
      return { color: "var(--status-normal, #22C55E)" };
    case "OFFLINE":
      return { color: "var(--text-muted, #737987)" };
    case "UNAVAILABLE":
      return { color: "var(--text-muted, #737987)" };
    case "ANALYSIS STOPPED":
      return { color: "var(--status-moderate, #C2BB91)" };
    case "CRITICAL":
      return { color: "var(--status-critical, #F45E70)" };
    case "HIGH":
      return { color: "var(--status-high, #F59E0B)" };
    case "MODERATE":
      return { color: "var(--status-moderate, #C2BB91)" };
    case "NORMAL":
    default:
      return { color: "var(--status-normal, #22C55E)" };
  }
}

export default function MonitoredJunctionsTable({
  junctions = [],
  selectedJunctionId = null,
  onSelectJunction,
  telemetry = null,
}) {
  const { t, tJunction } = useSettings();
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // "ALL" | "CRITICAL" | "MODERATE" | "NORMAL"
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredJunctions = useMemo(() => {
    return junctions.filter((j) => {
      const status = formatJunctionStatus(j.status, j.congestionScore);

      // Status filter
      if (statusFilter === "CRITICAL" && status !== "CRITICAL" && status !== "HIGH") return false;
      if (statusFilter === "MODERATE" && status !== "MODERATE") return false;
      if (statusFilter === "NORMAL" && status !== "NORMAL" && status !== "LIVE") return false;

      // Text search: matches junction name (English & Tamil), district, area, roads, cameras, and status
      if (!filterText.trim()) return true;
      const q = filterText.toLowerCase().trim();
      const taName = (JUNCTION_NAMES[j.name] || "").toLowerCase();
      const matchesRoads = (j.roads || []).some((r) => r.toLowerCase().includes(q));
      const matchesCameras = (j.cameras || []).some((c) => (c.name || c.id || c.approach || "").toLowerCase().includes(q));
      return (
        (j.name && j.name.toLowerCase().includes(q)) ||
        taName.includes(q) ||
        (j.district && j.district.toLowerCase().includes(q)) ||
        (j.area && j.area.toLowerCase().includes(q)) ||
        matchesRoads ||
        matchesCameras ||
        status.toLowerCase().includes(q)
      );
    });
  }, [junctions, filterText, statusFilter]);

  if (!junctions || junctions.length === 0) return null;

  const filterOptions = [
    { id: "ALL", label: t("alerts.filterAll", "All") },
    { id: "CRITICAL", label: `${t("status.critical", "Critical")} / ${t("status.high", "High")}` },
    { id: "MODERATE", label: t("status.moderate", "Moderate") },
    { id: "NORMAL", label: t("status.normal", "Normal") },
  ];

  const activeFilterLabel = filterOptions.find((f) => f.id === statusFilter)?.label || "All";

  return (
    <div
      style={{
        background: "var(--bg-surface, #1B2028)",
        border: "1px solid var(--border-default, #3D3F4E)",
        borderRadius: "4px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Table Header Bar with Title, Filter Icon Popover and Flexible Search */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.45rem 0.875rem",
          background: "var(--bg-surface-elevated, #252936)",
          borderBottom: "1px solid var(--border-default, #3D3F4E)",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 800, color: "var(--text-primary, #F4F5F7)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {t("traffic.monitoredJunctions", "Monitored Junctions")}
          </span>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              background: "var(--bg-surface-secondary, #2C303C)",
              color: "var(--text-secondary, #A7ACB8)",
              padding: "1px 7px",
              borderRadius: "10px",
            }}
          >
            {filteredJunctions.length} / {junctions.length}
          </span>

          {/* Clean Small Funnel Icon (No visible box/button container) */}
          <div ref={filterDropdownRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px",
                background: "transparent",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                color: statusFilter !== "ALL" ? "var(--accent-soft-blue, #7B8BC8)" : "var(--text-muted, #737987)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary, #F4F5F7)")}
              onMouseLeave={(e) => {
                if (statusFilter === "ALL") e.currentTarget.style.color = "var(--text-muted, #737987)";
              }}
              title="Filter status/severity"
              aria-label="Filter junctions"
            >
              <Filter size={14} strokeWidth={2.2} />
            </button>

            {isFilterDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  background: "var(--bg-surface-elevated, #252936)",
                  border: "1px solid var(--border-default, #3D3F4E)",
                  borderRadius: "4px",
                  padding: "4px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  boxShadow: "0 6px 18px rgba(0, 0, 0, 0.45)",
                  zIndex: 100,
                  minWidth: "140px",
                }}
              >
                {filterOptions.map((opt) => {
                  const active = statusFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setStatusFilter(opt.id);
                        setIsFilterDropdownOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.4rem 0.6rem",
                        background: active ? "var(--bg-surface-secondary, #2C303C)" : "transparent",
                        color: active ? "var(--accent-soft-blue, #7B8BC8)" : "var(--text-primary, #F4F5F7)",
                        border: "none",
                        borderRadius: "3px",
                        fontSize: "0.75rem",
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.12s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = "var(--bg-card-hover, #2C303C)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <span>{opt.label}</span>
                      {active && <Check size={12} color="var(--accent-soft-blue, #7B8BC8)" strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Search Input with Clear Button - Enlarged & Curved Design */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "var(--bg-surface, #1B2028)",
            border: "1px solid var(--border-default, #3D3F4E)",
            borderRadius: "9999px",
            padding: "5px 14px",
            height: "36px",
            minWidth: "260px",
            flex: "1 1 320px",
            maxWidth: "420px",
            boxShadow: "inset 0 1px 2px rgba(15, 27, 51, 0.04)",
            transition: "all 0.15s ease",
          }}
        >
          <Search size={15} color="var(--text-muted, #737987)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder={t("traffic.searchPlaceholder", "Search junction, area, road, camera...")}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              border: "none",
              outline: "none",
              fontSize: "0.8125rem",
              width: "100%",
              color: "var(--text-primary, #F4F5F7)",
              background: "transparent",
              fontFamily: "var(--font-sans)",
            }}
          />
          {filterText && (
            <button
              onClick={() => setFilterText("")}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "0",
                display: "flex",
                alignItems: "center",
                color: "var(--text-muted, #737987)",
              }}
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* High-Density Operational Table */}
      <div className="hide-scrollbar" style={{ overflowX: "auto", maxHeight: "360px", overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.75rem",
            textAlign: "left",
          }}
        >
          <thead>
            <tr
              style={{
                background: "var(--bg-surface-elevated, #252936)",
                borderBottom: "1px solid var(--border-default, #3D3F4E)",
                color: "var(--text-secondary, #A7ACB8)",
                fontSize: "0.625rem",
                fontWeight: 700,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                position: "sticky",
                top: 0,
                zIndex: 2,
              }}
            >
              <th style={{ padding: "0.55rem 0.75rem", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{t("traffic.junction", "Junction")}</th>
              <th style={{ padding: "0.55rem 0.5rem", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{t("traffic.status", "Status")}</th>
              <th style={{ padding: "0.55rem 0.5rem", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{t("traffic.vehicles", "Vehicles")}</th>
              <th style={{ padding: "0.55rem 0.5rem", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{t("traffic.cars", "Cars")}</th>
              <th style={{ padding: "0.55rem 0.5rem", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{t("traffic.trucks", "Trucks")}</th>
              <th style={{ padding: "0.55rem 0.5rem", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{t("traffic.buses", "Buses")}</th>
              <th style={{ padding: "0.55rem 0.5rem", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{t("traffic.bikes", "Bikes")}</th>
              <th style={{ padding: "0.55rem 0.5rem", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{t("traffic.averageSpeed", "Average Speed")}</th>
              <th style={{ padding: "0.55rem 0.5rem", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{t("traffic.occupancy", "Road Occupancy")}</th>
              <th style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{t("traffic.flow", "Traffic Flow")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredJunctions.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted, #737987)", fontSize: "0.75rem" }}>
                  No junctions match the current filter.
                </td>
              </tr>
            ) : (
              filteredJunctions.map((j) => {
                const isSel = selectedJunctionId === j.id;
                const status = formatJunctionStatus(j.status, j.congestionScore);
                const badgeStyle = getStatusBadgeStyle(status);

                const liveTel = isSel ? telemetry : null;

                // Total Vehicles
                const vCount = liveTel && (liveTel.total_tracked != null || liveTel.vehicle_count != null || liveTel.total != null || liveTel.active_tracks != null)
                  ? (liveTel.total_tracked ?? liveTel.vehicle_count ?? liveTel.total ?? liveTel.active_tracks)
                  : (j.metrics?.vehicleCount != null ? j.metrics.vehicleCount : "—");

                // Cars
                const cars = liveTel && (liveTel.cars != null || liveTel.vehicles?.car != null || liveTel.vehicle_breakdown?.car != null || liveTel.class_counts?.car != null)
                  ? (liveTel.cars ?? liveTel.vehicles?.car ?? liveTel.vehicle_breakdown?.car ?? liveTel.class_counts?.car)
                  : (j.metrics?.cars != null ? j.metrics.cars : (j.metrics?.vehicle_breakdown?.car != null ? j.metrics.vehicle_breakdown.car : "—"));

                // Trucks
                const trucks = liveTel && (liveTel.trucks != null || liveTel.vehicles?.truck != null || liveTel.vehicle_breakdown?.truck != null || liveTel.class_counts?.truck != null)
                  ? (liveTel.trucks ?? liveTel.vehicles?.truck ?? liveTel.vehicle_breakdown?.truck ?? liveTel.class_counts?.truck)
                  : (j.metrics?.trucks != null ? j.metrics.trucks : (j.metrics?.vehicle_breakdown?.truck != null ? j.metrics.vehicle_breakdown.truck : "—"));

                // Buses
                const buses = liveTel && (liveTel.buses != null || liveTel.vehicles?.bus != null || liveTel.vehicle_breakdown?.bus != null || liveTel.class_counts?.bus != null)
                  ? (liveTel.buses ?? liveTel.vehicles?.bus ?? liveTel.vehicle_breakdown?.bus ?? liveTel.class_counts?.bus)
                  : (j.metrics?.buses != null ? j.metrics.buses : (j.metrics?.vehicle_breakdown?.bus != null ? j.metrics.vehicle_breakdown.bus : "—"));

                // Bikes
                const bikes = liveTel && (liveTel.bikes != null || liveTel.vehicles?.bike != null || liveTel.vehicles?.motorcycle != null || liveTel.vehicle_breakdown?.bike != null || liveTel.class_counts?.bike != null || liveTel.class_counts?.motorcycle != null)
                  ? (liveTel.bikes ?? liveTel.vehicles?.bike ?? liveTel.vehicles?.motorcycle ?? liveTel.vehicle_breakdown?.bike ?? liveTel.class_counts?.bike ?? liveTel.class_counts?.motorcycle)
                  : (j.metrics?.bikes != null ? j.metrics.bikes : (j.metrics?.vehicle_breakdown?.bike != null ? j.metrics.vehicle_breakdown.bike : "—"));

                // Speed
                const rawSpeed = liveTel && (liveTel.average_speed != null || liveTel.speed != null)
                  ? (liveTel.average_speed ?? liveTel.speed)
                  : (j.metrics?.averageSpeedKmh != null ? j.metrics.averageSpeedKmh : null);
                const spd = rawSpeed != null ? `${Number(rawSpeed).toFixed(0)} km/h` : "—";
                const isSpeedLow = rawSpeed != null && Number(rawSpeed) < 20;

                // Occupancy
                const rawOcc = liveTel && (liveTel.road_occupancy_pct != null || liveTel.occupancy != null)
                  ? (liveTel.road_occupancy_pct ?? liveTel.occupancy)
                  : (j.metrics?.roadOccupancyPct != null ? j.metrics.roadOccupancyPct : null);
                const occ = rawOcc != null ? `${Math.round(Number(rawOcc))}%` : "—";
                const isOccHigh = rawOcc != null && Number(rawOcc) > 70;

                // Flow
                const rawFlow = liveTel && (liveTel.flow_per_minute != null || liveTel.traffic_flow_vpm != null)
                  ? (liveTel.flow_per_minute ?? liveTel.traffic_flow_vpm)
                  : (j.metrics?.trafficFlowVpm != null ? j.metrics.trafficFlowVpm : null);
                const flow = rawFlow != null ? `${Math.round(Number(rawFlow))} v/m` : "—";

                return (
                  <tr
                    key={j.id}
                    onClick={() => onSelectJunction && onSelectJunction(j)}
                    style={{
                      cursor: "pointer",
                      background: isSel ? "var(--bg-surface-elevated, #252936)" : "transparent",
                      borderBottom: "1px solid var(--border-light, #2C303C)",
                      borderLeft: isSel ? "3px solid var(--accent-soft-blue, #7B8BC8)" : "3px solid transparent",
                      transition: "background 0.1s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSel) e.currentTarget.style.background = "var(--bg-surface-secondary, #2C303C)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSel) e.currentTarget.style.background = "transparent";
                    }}
                    title="Click to view intelligence and control options in the right panel"
                  >
                    {/* Junction Name & Subtitle */}
                    <td style={{ padding: "0.55rem 0.75rem" }}>
                      <div style={{ fontWeight: isSel ? 800 : 700, color: "var(--text-primary, #F4F5F7)", fontSize: "0.75rem" }}>
                        {tJunction ? tJunction(j.name) : j.name}
                      </div>
                      <div style={{ fontSize: "0.625rem", color: "var(--text-muted, #737987)", marginTop: "1px" }}>
                        {tJunction ? tJunction(j.area || j.district) : (j.area || j.district)}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: "0.55rem 0.5rem", textAlign: "left" }}>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 800,
                          color: badgeStyle.color,
                          letterSpacing: "0.03em",
                        }}
                      >
                        {status === "NORMAL"
                          ? t("status.normal", "NORMAL")
                          : status === "MODERATE"
                          ? t("status.moderate", "MODERATE")
                          : status === "HIGH"
                          ? t("status.high", "HIGH")
                          : status === "CRITICAL"
                          ? t("status.critical", "CRITICAL")
                          : status === "LIVE"
                          ? t("status.live", "LIVE")
                          : status}
                      </span>
                    </td>

                    {/* Vehicles */}
                    <td
                      style={{
                        padding: "0.55rem 0.5rem",
                        textAlign: "right",
                        fontWeight: 700,
                        color: "var(--text-primary, #F4F5F7)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {vCount}
                    </td>

                    {/* Cars */}
                    <td
                      style={{
                        padding: "0.55rem 0.5rem",
                        textAlign: "right",
                        fontWeight: 600,
                        color: cars !== "—" ? "var(--text-primary, #F4F5F7)" : "var(--text-muted, #737987)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {cars}
                    </td>

                    {/* Trucks */}
                    <td
                      style={{
                        padding: "0.55rem 0.5rem",
                        textAlign: "right",
                        fontWeight: 600,
                        color: trucks !== "—" ? "var(--text-primary, #F4F5F7)" : "var(--text-muted, #737987)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {trucks}
                    </td>

                    {/* Buses */}
                    <td
                      style={{
                        padding: "0.55rem 0.5rem",
                        textAlign: "right",
                        fontWeight: 600,
                        color: buses !== "—" ? "var(--text-primary, #F4F5F7)" : "var(--text-muted, #737987)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {buses}
                    </td>

                    {/* Bikes */}
                    <td
                      style={{
                        padding: "0.55rem 0.5rem",
                        textAlign: "right",
                        fontWeight: 600,
                        color: bikes !== "—" ? "var(--text-primary, #F4F5F7)" : "var(--text-muted, #737987)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {bikes}
                    </td>

                    {/* Average Speed */}
                    <td
                      style={{
                        padding: "0.55rem 0.5rem",
                        textAlign: "right",
                        fontWeight: 600,
                        color: isSpeedLow ? "var(--status-critical, #F45E70)" : "var(--text-primary, #F4F5F7)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {spd}
                    </td>

                    {/* Road Occupancy */}
                    <td
                      style={{
                        padding: "0.55rem 0.5rem",
                        textAlign: "right",
                        fontWeight: 600,
                        color: isOccHigh ? "var(--status-critical, #F45E70)" : "var(--text-primary, #F4F5F7)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {occ}
                    </td>

                    {/* Traffic Flow */}
                    <td
                      style={{
                        padding: "0.55rem 0.75rem",
                        textAlign: "right",
                        fontWeight: 500,
                        color: "var(--text-secondary, #A7ACB8)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {flow}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
