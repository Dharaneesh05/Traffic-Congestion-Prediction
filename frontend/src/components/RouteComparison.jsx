import React, { useMemo, useState } from "react";
import { getRiskLevel } from "../services/tamilNaduTrafficData";
import { trafficService } from "../services/trafficService";
import { useSettings } from "../context/SettingsContext";

function getHaversineDistKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getMonitoredLocationsAlongRoute(waypoints, junctionsList, maxDistKm = 4.5) {
  if (!waypoints || waypoints.length === 0 || !junctionsList || junctionsList.length === 0) {
    return [];
  }

  // 1. Deduplicate the incoming junctionsList by normalized name and proximity (< 0.6km)
  const dedupedList = [];
  const seenKeys = new Set();

  (junctionsList || []).forEach((jnc) => {
    if (!jnc || !jnc.name || !jnc.coords || jnc.coords.length < 2) return;
    const normName = jnc.name.trim().toLowerCase();
    if (seenKeys.has(normName) || (jnc.id && seenKeys.has(jnc.id))) return;

    // Check if within 600m of an already registered junction (same physical location)
    const isDuplicate = dedupedList.some((existing) => {
      const dist = getHaversineDistKm(jnc.coords[1], jnc.coords[0], existing.coords[1], existing.coords[0]);
      return dist < 0.6;
    });

    if (!isDuplicate) {
      seenKeys.add(normName);
      if (jnc.id) seenKeys.add(jnc.id);
      dedupedList.push(jnc);
    }
  });

  const results = [];
  const matchedKeys = new Set();

  dedupedList.forEach((jnc) => {
    const [jLon, jLat] = jnc.coords;
    let minDist = Infinity;
    let closestIndex = -1;

    for (let i = 0; i < waypoints.length; i++) {
      const pt = waypoints[i];
      const wLat = pt[0] > 70 ? pt[1] : pt[0];
      const wLon = pt[0] > 70 ? pt[0] : pt[1];
      const d = getHaversineDistKm(jLat, jLon, wLat, wLon);
      if (d < minDist) {
        minDist = d;
        closestIndex = i;
      }
    }

    if (minDist <= maxDistKm) {
      const normName = jnc.name.trim().toLowerCase();
      if (!matchedKeys.has(normName)) {
        matchedKeys.add(normName);
        results.push({
          junction: jnc,
          minDist,
          routeIndex: closestIndex,
        });
      }
    }
  });

  results.sort((a, b) => a.routeIndex - b.routeIndex);
  return results.map((r) => r.junction);
}

// Small status color helper
function statusColor(jnc) {
  const s = (jnc.status || "").toUpperCase();
  const score = jnc.congestionScore ?? 0;
  if (s === "CRITICAL" || score >= 0.8) return "#FF5B6E";
  if (s === "HIGH" || score >= 0.6) return "#F59E0B";
  if (s === "MODERATE" || score >= 0.35) return "#C2BB91";
  return "#22C55E";
}

function statusLabel(jnc) {
  const s = (jnc.status || "").toUpperCase();
  const score = jnc.congestionScore ?? 0;
  if (s === "CRITICAL" || score >= 0.8) return "Critical";
  if (s === "HIGH" || score >= 0.6) return "High";
  if (s === "MODERATE" || score >= 0.35) return "Moderate";
  return "Normal";
}

function trafficConditionColor(condition) {
  if (!condition) return "#22C55E";
  const c = condition.toLowerCase();
  if (c.includes("heavy") || c.includes("critical")) return "#FF5B6E";
  if (c.includes("moderate")) return "#C2BB91";
  return "#22C55E";
}

export default function RouteComparison({
  routeResult,
  activeStrategy = "recommended",
  onSelectStrategy,
  areaJunctions = [],
  selectedJunction = null,
  onSelectJunction = null,
  onSelectLocation = null,
  alerts = [],
  forecast = null,
  diversionData = null,
  onEvaluateDiversion = null,
  fromLocation = "",
  toLocation = "",
}) {
  const { t, tJunction } = useSettings();
  const [hoveredJunction, setHoveredJunction] = useState(null); // jnc id or name for congested tag tooltip
  const [hoveredIncident, setHoveredIncident] = useState(false); // incident indicator tooltip
  const [routeListOpen, setRouteListOpen] = useState(false); // ON ROUTE toggle

  const localizeCondition = (cond) => {
    if (!cond) return "";
    const lower = cond.toLowerCase();
    if (lower.includes("heavy congestion")) return t("status.heavyCongestion", "Heavy Congestion");
    if (lower.includes("heavy delay")) return t("traffic.heavyDelay", "Heavy Delay");
    if (lower.includes("moderate delay")) return cond;
    if (lower.includes("moderate")) return t("traffic.moderateTraffic", "Moderate Traffic");
    if (lower.includes("free flow")) return t("traffic.freeFlow", "Free Flow");
    return cond;
  };

  // Statewide junctions deduplicated list
  const allStatewideJunctions = useMemo(() => {
    const list = [...(trafficService.allJunctions || []), ...(areaJunctions || [])];
    const unique = new Map();
    list.forEach((j) => {
      if (!j) return;
      const key = (j.name || j.id || "").trim().toLowerCase();
      if (key && !unique.has(key)) {
        unique.set(key, j);
      }
    });
    return Array.from(unique.values());
  }, [areaJunctions]);

  // Derive active waypoints safely before hook
  const recData = routeResult?.recommended || routeResult?.forecast || routeResult?.distance;
  const altData = routeResult?.alternative;
  const cngData = routeResult?.congested;

  const isRecActive = activeStrategy === "recommended" || activeStrategy === "forecast" || (!activeStrategy && true);
  const isAltActive = activeStrategy === "alternative" || activeStrategy === "congestion";
  const isCngActive = activeStrategy === "congested";

  const activeRoute = isAltActive && altData
    ? altData
    : isCngActive && cngData
    ? cngData
    : recData;

  const activeWaypoints = activeRoute?.waypoints || recData?.waypoints || [];

  const routeJunctions = useMemo(() => {
    return getMonitoredLocationsAlongRoute(activeWaypoints, allStatewideJunctions, 4.5);
  }, [activeWaypoints, allStatewideJunctions]);

  // Early return ONLY AFTER all hooks have executed
  if (!routeResult || routeResult.error || (!recData && !altData && !cngData)) {
    return null;
  }

  // 1. Resolve Route Models
  const originName = routeResult.from_name || fromLocation || "Origin";
  const destName = routeResult.to_name || toLocation || "Destination";

  const recDist = recData?.distance_km != null
    ? recData.distance_km
    : recData?.metrics?.total_distance_m
    ? (recData.metrics.total_distance_m / 1000.0).toFixed(1)
    : "Data unavailable";

  const recEta = recData?.time_min != null
    ? recData.time_min
    : recData?.metrics?.total_time_min
    ? Math.round(recData.metrics.total_time_min)
    : "Data unavailable";

  const recCondition = recData?.traffic_condition || (
    recData?.metrics?.avg_congestion != null
      ? recData.metrics.avg_congestion > 0.6
        ? "Heavy Congestion"
        : recData.metrics.avg_congestion > 0.35
        ? "Moderate Traffic"
        : "Free Flow"
      : "Free Flow"
  );

  // Check if a genuinely distinct alternative route exists
  const hasAlternative = !!(
    altData &&
    (altData.distance_km || altData.metrics?.total_distance_m) &&
    (altData.distance_km !== recDist || (altData.time_min && altData.time_min !== recEta))
  );

  const altDist = hasAlternative
    ? (altData.distance_km != null
        ? altData.distance_km
        : (altData.metrics.total_distance_m / 1000.0).toFixed(1))
    : null;

  const altEta = hasAlternative
    ? (altData.time_min != null
        ? altData.time_min
        : Math.round(altData.metrics.total_time_min))
    : null;

  const altCondition = altData?.traffic_condition || (
    altData?.metrics?.avg_congestion != null
      ? altData.metrics.avg_congestion > 0.6
        ? "Heavy Delay"
        : altData.metrics.avg_congestion > 0.35
        ? "Moderate Traffic"
        : "Free Flow"
      : hasAlternative && altEta && recEta && Number(altEta) > Number(recEta)
      ? `Moderate Delay (+${Number(altEta) - Number(recEta)} min)`
      : "Free Flow"
  );

  // Check if a congested route exists
  const hasCongested = !!(
    cngData &&
    (cngData.distance_km || cngData.metrics?.total_distance_m) &&
    (cngData.distance_km !== recDist || (cngData.time_min && cngData.time_min !== recEta))
  );

  const cngDist = hasCongested
    ? (cngData.distance_km != null
        ? cngData.distance_km
        : (cngData.metrics.total_distance_m / 1000.0).toFixed(1))
    : null;

  const cngEta = hasCongested
    ? (cngData.time_min != null
        ? cngData.time_min
        : Math.round(cngData.metrics.total_time_min))
    : null;

  const cngCondition = cngData?.traffic_condition || "Heavy Congestion";

  // Congested junctions along route
  const congestedJunctions = routeJunctions.filter(
    (j) => (j.congestionScore >= 0.6) || j.status === "HIGH" || j.status === "CRITICAL"
  );

  // Active incidents along route
  const activeIncidents = (alerts || []).filter((a) =>
    routeJunctions.some((j) => a.junctionId === j.id || (a.location && j.name && a.location.toLowerCase().includes(j.name.toLowerCase())))
  );

  // Alternative route contextual reason (uses real congested junction names)
  const altReason = hasAlternative && congestedJunctions.length > 0
    ? t("routes.altReasonAvoidCongestion", "Available to avoid congestion near {location}.", {
        location: tJunction(congestedJunctions[0].name.replace(/ Junction$/, "")),
      })
    : null;

  // Handle junction click: zoom map + select junction
  const handleJunctionClick = (jnc) => {
    if (onSelectJunction) {
      onSelectJunction(jnc);
    }
    if (onSelectLocation && jnc.coords) {
      onSelectLocation({ lon: jnc.coords[0], lat: jnc.coords[1], name: jnc.name, searchCategory: "junction", zoom: 14.5, _ts: Date.now() });
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-surface, #1B2028)",
        border: "1px solid var(--border-default, #3D3F4E)",
        borderRadius: "4px",
        padding: "0.75rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {/* Route Origin → Destination summary */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "4px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-primary, #F4F5F7)" }}>
          {tJunction(originName)}
        </span>
        <span style={{ fontSize: "0.6875rem", color: "var(--text-muted, #737987)" }}>{t("routes.to", "to")}</span>
        <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-primary, #F4F5F7)" }}>
          {tJunction(destName)}
        </span>
      </div>

      {/* Route Choices: RECOMMENDED, ALTERNATIVE, CONGESTED */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>

        {/* 1. RECOMMENDED */}
        <div
          onClick={() => onSelectStrategy && onSelectStrategy("recommended")}
          style={{
            cursor: "pointer",
            background: isRecActive ? "var(--bg-surface-elevated, #252936)" : "var(--bg-surface, #1B2028)",
            border: isRecActive ? "1px solid var(--accent-soft-blue, #7B8BC8)" : "1px solid var(--border-default, #3D3F4E)",
            borderRadius: "4px",
            padding: "0.5rem 0.65rem",
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            transition: "all 0.1s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "var(--accent-soft-blue, #7B8BC8)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              {t("routes.recommended", "RECOMMENDED")}{isRecActive ? ` · ${t("routes.active", "ACTIVE")}` : ""}
            </span>
          </div>

          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-primary, #F4F5F7)" }}>
            {tJunction(recData?.name || "Main Highway Corridor")}
          </div>

          {/* Metrics row: wraps cleanly without breaking values into two lines */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.35rem 0.85rem",
              alignItems: "center",
              fontSize: "0.6875rem",
              borderTop: "1px solid var(--border-light, #2C303C)",
              paddingTop: "4px",
              marginTop: "2px",
            }}
          >
            <span style={{ color: "var(--text-muted, #737987)", fontWeight: 600, whiteSpace: "nowrap" }}>
              {t("routes.distance", "Distance")}: <strong style={{ color: "var(--text-primary, #F4F5F7)", fontFamily: "var(--font-mono)" }}>{recDist} {t("common.km", "km")}</strong>
            </span>
            <span style={{ color: "var(--text-muted, #737987)", fontWeight: 600, whiteSpace: "nowrap" }}>
              {t("routes.travelTime", "Travel time")}: <strong style={{ color: "var(--text-primary, #F4F5F7)", fontFamily: "var(--font-mono)" }}>{recEta} {t("common.min", "min")}</strong>
            </span>
            <span style={{ color: "var(--text-muted, #737987)", fontWeight: 600, whiteSpace: "nowrap" }}>
              {t("routes.traffic", "Traffic")}: <strong style={{ color: trafficConditionColor(recCondition) }}>{localizeCondition(recCondition)}</strong>
            </span>
          </div>

          {/* Congested junction inline tags */}
          {isRecActive && congestedJunctions.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "4px", alignItems: "center" }}>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #737987)", fontWeight: 600 }}>
                {t("routes.trafficIssues", "Traffic issues:")}
              </span>
              {congestedJunctions.map((jnc) => {
                const isHovered = hoveredJunction === (jnc.id || jnc.name);
                const sColor = statusColor(jnc);
                const sLabel = statusLabel(jnc);
                return (
                  <div
                    key={jnc.id || jnc.name}
                    style={{ position: "relative", display: "inline-block" }}
                  >
                    <span
                      onClick={(e) => { e.stopPropagation(); handleJunctionClick(jnc); }}
                      onMouseEnter={() => setHoveredJunction(jnc.id || jnc.name)}
                      onMouseLeave={() => setHoveredJunction(null)}
                      style={{
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        color: sColor,
                        cursor: "pointer",
                        borderBottom: `1px dotted ${sColor}`,
                        paddingBottom: "1px",
                      }}
                    >
                      {tJunction(jnc.name.replace(/ Junction$/, ""))}
                    </span>

                    {/* Junction hover tooltip */}
                    {isHovered && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "calc(100% + 5px)",
                          left: 0,
                          zIndex: 300,
                          background: "#1B2028",
                          border: `1px solid ${sColor}50`,
                          borderLeft: `2px solid ${sColor}`,
                          borderRadius: "3px",
                          padding: "0.4rem 0.55rem",
                          minWidth: "150px",
                          maxWidth: "220px",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
                          pointerEvents: "auto",
                        }}
                      >
                        <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#F4F5F7", marginBottom: "0.15rem" }}>
                          {tJunction(jnc.name)}
                        </div>
                        <div style={{ fontSize: "0.625rem", fontWeight: 700, color: sColor, marginBottom: "0.2rem" }}>
                          {t(`status.${sLabel.toLowerCase()}`, sLabel)}
                        </div>
                        {jnc.metrics?.vehicleCount != null && (
                          <div style={{ fontSize: "0.625rem", color: "#9299A8" }}>
                            {t("traffic.vehicles", "Vehicles")}: <span style={{ color: "#F4F5F7" }}>{jnc.metrics.vehicleCount}</span>
                          </div>
                        )}
                        {jnc.metrics?.averageSpeedKmh != null && (
                          <div style={{ fontSize: "0.625rem", color: "#9299A8" }}>
                            {t("traffic.averageSpeed", "Average Speed")}: <span style={{ color: "#F4F5F7" }}>{jnc.metrics.averageSpeedKmh} {t("common.kmh", "km/h")}</span>
                          </div>
                        )}
                        <div style={{ fontSize: "0.5625rem", color: "#7C8FD8", marginTop: "0.25rem" }}>
                          {t("actions.clickToViewMap", "Click to view on map")}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Active incidents indicator */}
          {isRecActive && activeIncidents.length > 0 && (
            <div style={{ position: "relative", marginTop: "3px", display: "inline-block" }}>
              <span
                onMouseEnter={() => setHoveredIncident(true)}
                onMouseLeave={() => setHoveredIncident(false)}
                onClick={(e) => {
                  e.stopPropagation();
                  // Navigate to first incident's junction
                  const firstInc = activeIncidents[0];
                  const jncName = (firstInc.junction || firstInc.location || "").toLowerCase();
                  const matchedJnc = routeJunctions.find((j) =>
                    jncName.includes(j.name.toLowerCase()) || j.name.toLowerCase().includes(jncName)
                  );
                  if (matchedJnc) handleJunctionClick(matchedJnc);
                }}
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  color: "#F59E0B",
                  cursor: "pointer",
                  borderBottom: "1px dotted #F59E0B",
                }}
              >
                {t("routes.incidentsCount", `${activeIncidents.length} incident${activeIncidents.length > 1 ? "s" : ""}`, {
                  count: activeIncidents.length,
                  plural: activeIncidents.length > 1 ? "s" : "",
                })}
              </span>

              {/* Incident hover tooltip */}
              {hoveredIncident && activeIncidents[0] && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 5px)",
                    left: 0,
                    zIndex: 300,
                    background: "#1B2028",
                    border: "1px solid #F59E0B40",
                    borderLeft: "2px solid #F59E0B",
                    borderRadius: "3px",
                    padding: "0.4rem 0.55rem",
                    minWidth: "160px",
                    maxWidth: "220px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
                    pointerEvents: "auto",
                  }}
                >
                  <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#F59E0B", marginBottom: "0.15rem" }}>
                    {tJunction(activeIncidents[0].junction || activeIncidents[0].location)}
                  </div>
                  {activeIncidents[0].reason && (
                    <div style={{ fontSize: "0.625rem", color: "#C5C9D3", marginBottom: "0.15rem" }}>
                      {activeIncidents[0].reason}
                    </div>
                  )}
                  {activeIncidents.length > 1 && (
                    <div style={{ fontSize: "0.5625rem", color: "#9299A8" }}>
                      +{activeIncidents.length - 1} {t("routes.moreAlongRoute", "more along route")}
                    </div>
                  )}
                  <div style={{ fontSize: "0.5625rem", color: "#7C8FD8", marginTop: "0.2rem" }}>
                    {t("actions.clickToViewJunction", "Click to view junction")}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. ALTERNATIVE (only when available) */}
        {hasAlternative && (
          <div
            onClick={() => onSelectStrategy && onSelectStrategy("alternative")}
            style={{
              cursor: "pointer",
              background: isAltActive ? "var(--bg-surface-elevated, #252936)" : "var(--bg-surface, #1B2028)",
              border: isAltActive ? "1px solid var(--status-normal, #22C55E)" : "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "4px",
              padding: "0.5rem 0.65rem",
              display: "flex",
              flexDirection: "column",
              gap: "3px",
              transition: "all 0.1s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "var(--status-normal, #22C55E)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {t("routes.alternative", "ALTERNATIVE")}{isAltActive ? ` · ${t("routes.active", "ACTIVE")}` : ""}
              </span>
            </div>

            <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-primary, #F4F5F7)" }}>
              {tJunction(altData?.name || "Bypass Arterial Corridor")}
            </div>

            {/* Metrics row */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.35rem 0.85rem",
                alignItems: "center",
                fontSize: "0.6875rem",
                borderTop: "1px solid var(--border-light, #2C303C)",
                paddingTop: "4px",
                marginTop: "2px",
              }}
            >
              <span style={{ color: "var(--text-muted, #737987)", fontWeight: 600, whiteSpace: "nowrap" }}>
                {t("routes.distance", "Distance")}: <strong style={{ color: "var(--text-primary, #F4F5F7)", fontFamily: "var(--font-mono)" }}>{altDist} {t("common.km", "km")}</strong>
              </span>
              <span style={{ color: "var(--text-muted, #737987)", fontWeight: 600, whiteSpace: "nowrap" }}>
                {t("routes.travelTime", "Travel time")}: <strong style={{ color: "var(--text-primary, #F4F5F7)", fontFamily: "var(--font-mono)" }}>{altEta} {t("common.min", "min")}</strong>
              </span>
              <span style={{ color: "var(--text-muted, #737987)", fontWeight: 600, whiteSpace: "nowrap" }}>
                {t("routes.traffic", "Traffic")}: <strong style={{ color: trafficConditionColor(altCondition) }}>{localizeCondition(altCondition)}</strong>
              </span>
            </div>

            {/* Delta vs recommended */}
            {recDist != null && altDist != null && recEta != null && altEta != null && (
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted, #737987)", marginTop: "2px" }}>
                {(Number(altDist) - Number(recDist)) > 0 ? `+${(Number(altDist) - Number(recDist)).toFixed(1)} ${t("common.km", "km")}` : ""}{(Number(altDist) - Number(recDist)) > 0 && (Number(altEta) - Number(recEta)) > 0 ? " · " : ""}{(Number(altEta) - Number(recEta)) > 0 ? `+${Number(altEta) - Number(recEta)} ${t("common.min", "min")}` : ""}
              </div>
            )}

            {/* Contextual reason line — only when there's a real reason */}
            {altReason && (
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted, #737987)", borderTop: "1px solid var(--border-light, #2C303C)", paddingTop: "3px", marginTop: "1px" }}>
                {altReason}
              </div>
            )}
          </div>
        )}

        {/* 3. CONGESTED (only when available) */}
        {hasCongested && (
          <div
            onClick={() => onSelectStrategy && onSelectStrategy("congested")}
            style={{
              cursor: "pointer",
              background: isCngActive ? "var(--bg-surface-elevated, #252936)" : "var(--bg-surface, #1B2028)",
              border: isCngActive ? "1px solid var(--status-critical, #F45E70)" : "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "4px",
              padding: "0.5rem 0.65rem",
              display: "flex",
              flexDirection: "column",
              gap: "3px",
              transition: "all 0.1s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "var(--status-critical, #F45E70)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {t("status.congested", "CONGESTED")}{isCngActive ? ` · ${t("routes.active", "ACTIVE")}` : ""}
              </span>
            </div>

            <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-primary, #F4F5F7)" }}>
              {tJunction(cngData?.name || "City Arterial Corridor")}
            </div>

            {/* Metrics row */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.35rem 0.85rem",
                alignItems: "center",
                fontSize: "0.6875rem",
                borderTop: "1px solid var(--border-light, #2C303C)",
                paddingTop: "4px",
                marginTop: "2px",
              }}
            >
              <span style={{ color: "var(--text-muted, #737987)", fontWeight: 600, whiteSpace: "nowrap" }}>
                {t("routes.distance", "Distance")}: <strong style={{ color: "var(--text-primary, #F4F5F7)", fontFamily: "var(--font-mono)" }}>{cngDist} {t("common.km", "km")}</strong>
              </span>
              <span style={{ color: "var(--text-muted, #737987)", fontWeight: 600, whiteSpace: "nowrap" }}>
                {t("routes.travelTime", "Travel time")}: <strong style={{ color: "var(--text-primary, #F4F5F7)", fontFamily: "var(--font-mono)" }}>{cngEta} {t("common.min", "min")}</strong>
              </span>
              <span style={{ color: "var(--text-muted, #737987)", fontWeight: 600, whiteSpace: "nowrap" }}>
                {t("routes.traffic", "Traffic")}: <strong style={{ color: "#FF5B6E" }}>{localizeCondition(cngCondition)}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ON ROUTE · N LOCATIONS compact toggle — clear, visible, and bold */}
      {routeJunctions.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border-light, #2C303C)", paddingTop: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setRouteListOpen((prev) => !prev)}
            style={{
              background: "none",
              border: "none",
              padding: "0.2rem 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                color: "#F4F5F7",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {t("routes.onRoute", "ON ROUTE")} · {t("routes.locationsCount", `${routeJunctions.length} LOCATION${routeJunctions.length !== 1 ? "S" : ""}`, {
                count: routeJunctions.length,
                plural: routeJunctions.length !== 1 ? "S" : "",
              })}
            </span>
            <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--accent-soft-blue, #7B8BC8)" }}>
              {routeListOpen ? "▴" : "▾"}
            </span>
          </button>

          {routeListOpen && (
            <div
              style={{
                marginTop: "0.4rem",
                display: "flex",
                flexDirection: "column",
                gap: "1px",
                maxHeight: "220px",
                overflowY: "auto",
                border: "1px solid var(--border-default, #3D3F4E)",
                borderRadius: "3px",
              }}
            >
              {routeJunctions.map((jnc, idx) => {
                const sColor = statusColor(jnc);
                const sLabel = statusLabel(jnc);
                return (
                  <div
                    key={jnc.id || jnc.name}
                    onClick={() => handleJunctionClick(jnc)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.4rem 0.65rem",
                      cursor: "pointer",
                      background: idx % 2 === 0 ? "var(--bg-surface, #1B2028)" : "var(--bg-surface-elevated, #252936)",
                      borderBottom: idx < routeJunctions.length - 1 ? "1px solid var(--border-light, #2C303C)" : "none",
                      transition: "background 0.1s",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", color: "var(--text-primary, #F4F5F7)", fontWeight: 600 }}>
                      {tJunction(jnc.name)}
                    </span>
                    <span style={{ fontSize: "0.625rem", fontWeight: 800, color: sColor, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {t(`status.${sLabel.toLowerCase()}`, sLabel)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { RouteComparison as RouteResults };
