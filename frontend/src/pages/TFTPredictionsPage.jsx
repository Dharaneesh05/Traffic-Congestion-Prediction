import React, { useState, useEffect, useMemo } from "react";
import { useSettings } from "../context/SettingsContext";

function getSeverity(scoreOrLevel) {
  if (typeof scoreOrLevel === "string") {
    const s = scoreOrLevel.toUpperCase();
    if (s.includes("CRIT") || s.includes("SEVER")) return "CRITICAL";
    if (s.includes("HIGH") || s.includes("HEAVY")) return "HIGH";
    if (s.includes("MOD")) return "MODERATE";
    if (s.includes("NORM") || s.includes("FREE") || s.includes("LIGHT")) return "NORMAL";
    return "NORMAL";
  }
  if (scoreOrLevel == null || isNaN(scoreOrLevel)) return "NORMAL";
  const s = scoreOrLevel > 1.0 ? scoreOrLevel / 100 : scoreOrLevel;
  if (s >= 0.80) return "CRITICAL";
  if (s >= 0.60) return "HIGH";
  if (s >= 0.35) return "MODERATE";
  return "NORMAL";
}

const SEVERITY_COLORS = {
  CRITICAL: "var(--status-critical, #EF4444)",
  HIGH: "var(--status-high, #F59E0B)",
  MODERATE: "var(--status-moderate, #C2BB91)",
  NORMAL: "var(--status-normal, #22C55E)",
};

export default function TFTPredictionsPage({
  forecast = null,
  telemetry = null,
  selectedLocation = null,
  selectedJunction = null,
  districtName = "Tamil Nadu",
  alerts = [],
  onNavigateTab = null,
  onSelectJunction = null,
}) {
  const { t, tJunction } = useSettings();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [trendView, setTrendView] = useState("chart"); // "chart" | "table"
  const [hoveredPointIndex, setHoveredPointIndex] = useState(null);
  const [selectedHorizonKey, setSelectedHorizonKey] = useState("15min");

  // Keep live time ticking every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const updatedTime = useMemo(() => {
    return currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  }, [currentTime]);

  // Dynamically calculate actual clock times (+5m, +15m, +30m) from current time
  const clockTimes = useMemo(() => {
    const formatTimeOffset = (mins) => {
      const d = new Date(currentTime.getTime() + mins * 60000);
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    };

    return {
      now: currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
      f5: formatTimeOffset(5),
      f15: formatTimeOffset(15),
      f30: formatTimeOffset(30),
    };
  }, [currentTime]);

  // 1. Resolve Active Location Name & Region
  const locationName = useMemo(() => {
    const raw = (
      selectedJunction?.name ||
      selectedLocation?.name ||
      "AVR Roundana Junction"
    );
    return tJunction ? tJunction(raw) : raw;
  }, [selectedJunction, selectedLocation, tJunction]);

  const regionName = useMemo(() => {
    const raw = (
      selectedJunction?.district ||
      selectedJunction?.area ||
      districtName ||
      "Salem"
    );
    return tJunction ? tJunction(raw) : raw;
  }, [selectedJunction, districtName, tJunction]);

  // 2. Multi-Horizon Forecast with dynamic clock times
  const forecastHorizons = useMemo(() => {
    if (forecast && forecast["5min"] && forecast["5min"].q50 != null) {
      const curScore = selectedJunction?.congestionScore ?? (forecast["5min"].q50 * 0.95);
      const curPct = Math.round(curScore * 100);
      const f5Pct = Math.round((forecast["5min"].q50 || 0) * 100);
      const f15Pct = Math.round((forecast["15min"]?.q50 ?? (forecast["5min"].q50 * 1.06)) * 100);
      const f30Pct = Math.round((forecast["30min"]?.q50 ?? (forecast["15min"]?.q50 ? forecast["15min"].q50 * 1.1 : forecast["5min"].q50 * 1.15)) * 100);

      const qInterval = (forecast["5min"].q90 || 0.6) - (forecast["5min"].q10 || 0.3);
      const conf = Math.round(Math.max(72, Math.min(96, (1 - qInterval) * 100)));

      return {
        confidence: `${conf}%`,
        horizons: [
          { key: "now", label: "NOW", clockTime: clockTimes.now, pct: curPct, level: getSeverity(curPct / 100) },
          { key: "5min", label: "+5 MIN", clockTime: clockTimes.f5, pct: f5Pct, level: getSeverity(f5Pct / 100) },
          { key: "15min", label: "+15 MIN", clockTime: clockTimes.f15, pct: f15Pct, level: getSeverity(f15Pct / 100) },
          { key: "30min", label: "+30 MIN", clockTime: clockTimes.f30, pct: f30Pct, level: getSeverity(f30Pct / 100) },
        ],
      };
    }

    if (selectedJunction?.prediction) {
      const pred = selectedJunction.prediction;
      const curScore = selectedJunction.congestionScore ?? 0.18;
      const curPct = Math.round(curScore * 100);

      const levelToPct = (lvl) => {
        const s = getSeverity(lvl);
        if (s === "CRITICAL") return Math.max(82, curPct + 16);
        if (s === "HIGH") return Math.max(64, curPct + 10);
        if (s === "MODERATE") return Math.max(48, curPct + 6);
        return Math.max(18, curPct);
      };

      const f15Pct = pred.next15Min ? levelToPct(pred.next15Min) : Math.min(100, Math.round(curPct * 1.08));
      const f30Pct = pred.next30Min ? levelToPct(pred.next30Min) : Math.min(100, Math.round(f15Pct * 1.06));
      const f5Pct = Math.round((curPct + f15Pct) / 2);

      return {
        confidence: pred.confidence ? `${pred.confidence}%` : "86%",
        horizons: [
          { key: "now", label: "NOW", clockTime: clockTimes.now, pct: curPct, level: getSeverity(curPct / 100) },
          { key: "5min", label: "+5 MIN", clockTime: clockTimes.f5, pct: f5Pct, level: getSeverity(f5Pct / 100) },
          { key: "15min", label: "+15 MIN", clockTime: clockTimes.f15, pct: f15Pct, level: getSeverity(f15Pct / 100) },
          { key: "30min", label: "+30 MIN", clockTime: clockTimes.f30, pct: f30Pct, level: getSeverity(f30Pct / 100) },
        ],
      };
    }

    const curScore = selectedJunction?.congestionScore ?? 0.18;
    const curPct = Math.round(curScore * 100);
    const f5Pct = Math.min(100, curPct + 30);
    const f15Pct = Math.min(100, curPct + 35);
    const f30Pct = Math.min(100, curPct + 39);

    return {
      confidence: "86%",
      horizons: [
        { key: "now", label: "NOW", clockTime: clockTimes.now, pct: curPct, level: getSeverity(curPct / 100) },
        { key: "5min", label: "+5 MIN", clockTime: clockTimes.f5, pct: f5Pct, level: getSeverity(f5Pct / 100) },
        { key: "15min", label: "+15 MIN", clockTime: clockTimes.f15, pct: f15Pct, level: getSeverity(f15Pct / 100) },
        { key: "30min", label: "+30 MIN", clockTime: clockTimes.f30, pct: f30Pct, level: getSeverity(f30Pct / 100) },
      ],
    };
  }, [forecast, selectedJunction, clockTimes]);

  // 3. Dynamic Warning & Header Status
  const warningInfo = useMemo(() => {
    const hasAmbulance = (alerts || []).some(
      (a) =>
        (a.type === "AMBULANCE" ||
          a.title?.toLowerCase().includes("ambulance") ||
          a.reason?.toLowerCase().includes("ambulance")) &&
        a.status !== "RESOLVED"
    );
    if (hasAmbulance) {
      return {
        headerStatus: "EMERGENCY",
        headerColor: "var(--status-critical, #EF4444)",
        warningTitle: "EMERGENCY",
        warningColor: "var(--status-critical, #EF4444)",
        mainText: `Ambulance approaching ${locationName}.`,
        subText: "Priority corridor clearance active on approach.",
        buttonText: "VIEW LOCATION",
        buttonAction: "map",
      };
    }

    const hasAccident = (alerts || []).some(
      (a) =>
        (a.type === "ACCIDENT" ||
          a.title?.toLowerCase().includes("accident") ||
          a.reason?.toLowerCase().includes("accident")) &&
        a.status !== "RESOLVED"
    );
    if (hasAccident) {
      return {
        headerStatus: "INCIDENT: ACCIDENT",
        headerColor: "var(--status-critical, #EF4444)",
        warningTitle: "TRAFFIC INCIDENT",
        warningColor: "var(--status-critical, #EF4444)",
        mainText: `Accident reported near ${locationName}.`,
        subText: "Traffic flow disrupted. Emergency response dispatched.",
        buttonText: "VIEW CCTV",
        buttonAction: "cctv",
      };
    }

    const curLevel = forecastHorizons.horizons[0].level;
    const f15Level = forecastHorizons.horizons[2].level;
    const f30Level = forecastHorizons.horizons[3].level;
    const roadStr = selectedJunction?.roads?.[0] || "Commercial Core Junction";

    const localizedRoad = tJunction ? tJunction(roadStr) : roadStr;

    if (curLevel === "CRITICAL" || f15Level === "CRITICAL" || f30Level === "CRITICAL") {
      return {
        headerStatus: `WARNING: ${t("status.critical", "CRITICAL")}`,
        headerColor: "var(--status-critical, #EF4444)",
        warningTitle: t("cctv.trafficIncident", "TRAFFIC WARNING"),
        warningColor: "var(--status-critical, #EF4444)",
        mainText: t("forecast.criticalCongestion", "Critical congestion expected within 15 minutes."),
        subText: t("forecast.queueMayExtend", "Queue may extend toward {location}.", { location: localizedRoad }),
        buttonText: t("actions.viewLocation", "VIEW LOCATION"),
        buttonAction: "map",
      };
    }

    if (f15Level === "HIGH" || curLevel === "HIGH") {
      return {
        headerStatus: `WARNING: ${t("status.high", "HEAVY CONGESTION")}`,
        headerColor: "var(--status-high, #F59E0B)",
        warningTitle: t("cctv.trafficIncident", "TRAFFIC WARNING"),
        warningColor: "var(--status-high, #F59E0B)",
        mainText: t("forecast.highCongestionExpected", "High congestion expected within 15 minutes.", { minutes: 15 }),
        subText: t("forecast.queueMayExtend", "Queue may extend toward {location}.", { location: localizedRoad }),
        buttonText: t("actions.viewLocation", "VIEW LOCATION"),
        buttonAction: "map",
      };
    }

    if (f15Level === "MODERATE" || forecastHorizons.horizons[1].pct >= 35 || curLevel === "MODERATE") {
      return {
        headerStatus: `WARNING: ${t("status.moderate", "CONGESTION")}`,
        headerColor: "var(--status-high, #F59E0B)",
        warningTitle: t("cctv.trafficIncident", "TRAFFIC WARNING"),
        warningColor: "var(--status-high, #F59E0B)",
        mainText: t("forecast.highCongestionExpected", "High congestion expected within 15 minutes.", { minutes: 15 }),
        subText: t("forecast.queueMayExtend", "Queue may extend toward {location}.", { location: localizedRoad }),
        buttonText: t("actions.viewLocation", "VIEW LOCATION"),
        buttonAction: "map",
      };
    }

    return {
      headerStatus: `STATUS: ${t("status.normal", "NORMAL")}`,
      headerColor: "var(--status-normal, #22C55E)",
      warningTitle: t("traffic.status", "TRAFFIC STATUS"),
      warningColor: "var(--status-normal, #22C55E)",
      mainText: t("forecast.freeFlow", "Free flow traffic conditions observed."),
      subText: t("forecast.capacityNominal", "All approaches operating within nominal capacity."),
      buttonText: t("actions.viewLocation", "VIEW LOCATION"),
      buttonAction: "map",
    };
  }, [alerts, forecastHorizons, locationName, selectedJunction, t, tJunction]);

  // 4. Current Traffic Measurements (Live YOLO11/ByteTrack or Backend Data)
  const currentMetrics = useMemo(() => {
    if (telemetry) {
      const vCount = telemetry.total_tracked ?? telemetry.vehicle_count ?? telemetry.active_tracks ?? telemetry.total;
      const cars = telemetry.cars ?? telemetry.vehicles?.car ?? telemetry.vehicle_breakdown?.car ?? telemetry.class_counts?.car;
      const trucks = telemetry.trucks ?? telemetry.vehicles?.truck ?? telemetry.vehicle_breakdown?.truck ?? telemetry.class_counts?.truck;
      const buses = telemetry.buses ?? telemetry.vehicles?.bus ?? telemetry.vehicle_breakdown?.bus ?? telemetry.class_counts?.bus;
      const bikes = telemetry.bikes ?? telemetry.vehicles?.bike ?? telemetry.vehicles?.motorcycle ?? telemetry.vehicle_breakdown?.bike ?? telemetry.class_counts?.bike ?? telemetry.class_counts?.motorcycle;
      const spd = telemetry.average_speed ?? telemetry.average_speed_kmh ?? telemetry.speed;
      const occ = telemetry.road_occupancy != null ? Math.round(telemetry.road_occupancy * 100) : (telemetry.road_occupancy_pct ?? telemetry.occupancy);
      const flw = telemetry.flow_per_minute ?? telemetry.traffic_flow_vpm;

      return {
        vehicles: vCount != null ? vCount : (selectedJunction?.metrics?.vehicleCount ?? "—"),
        cars: cars != null ? cars : (selectedJunction?.metrics?.cars ?? "—"),
        trucks: trucks != null ? trucks : (selectedJunction?.metrics?.trucks ?? "—"),
        buses: buses != null ? buses : (selectedJunction?.metrics?.buses ?? "—"),
        bikes: bikes != null ? bikes : (selectedJunction?.metrics?.bikes ?? "—"),
        speed: spd != null ? `${Number(spd).toFixed(1)} km/h` : (selectedJunction?.metrics?.averageSpeedKmh != null ? `${selectedJunction.metrics.averageSpeedKmh} km/h` : "—"),
        occupancy: occ != null ? `${Math.round(Number(occ))}%` : (selectedJunction?.metrics?.roadOccupancyPct != null ? `${selectedJunction.metrics.roadOccupancyPct}%` : "—"),
        flow: flw != null ? `${Math.round(Number(flw))} veh/min` : (selectedJunction?.metrics?.trafficFlowVpm != null ? `${selectedJunction.metrics.trafficFlowVpm} veh/min` : "—"),
        rawVehicles: vCount || selectedJunction?.metrics?.vehicleCount || 10,
        rawSpeed: spd || selectedJunction?.metrics?.averageSpeedKmh || 40,
      };
    }

    if (selectedJunction?.metrics) {
      const m = selectedJunction.metrics;
      return {
        vehicles: m.vehicleCount != null ? m.vehicleCount : "—",
        cars: m.cars != null ? m.cars : (m.vehicle_breakdown?.car ?? "—"),
        trucks: m.trucks != null ? m.trucks : (m.vehicle_breakdown?.truck ?? "—"),
        buses: m.buses != null ? m.buses : (m.vehicle_breakdown?.bus ?? "—"),
        bikes: m.bikes != null ? m.bikes : (m.vehicle_breakdown?.bike ?? "—"),
        speed: m.averageSpeedKmh != null ? `${m.averageSpeedKmh} km/h` : "—",
        occupancy: m.roadOccupancyPct != null ? `${m.roadOccupancyPct}%` : "—",
        flow: m.trafficFlowVpm != null ? `${m.trafficFlowVpm} veh/min` : "—",
        rawVehicles: m.vehicleCount || 10,
        rawSpeed: m.averageSpeedKmh || 40,
      };
    }

    return {
      vehicles: "7",
      cars: "6",
      trucks: "0",
      buses: "1",
      bikes: "0",
      speed: "39.7 km/h",
      occupancy: "7%",
      flow: "4 veh/min",
      rawVehicles: 7,
      rawSpeed: 39.7,
    };
  }, [telemetry, selectedJunction]);

  // 5. Rich SVG Chart Coordinates & Math (Spacious 800x160 viewBox)
  const chartPoints = useMemo(() => {
    const xs = [90, 290, 490, 690];
    const baseVeh = Number(currentMetrics.rawVehicles) || 12;
    const baseSpd = Number(currentMetrics.rawSpeed) || 38;

    const pts = forecastHorizons.horizons.map((h, i) => {
      const pct = h.pct != null ? h.pct : 20;
      // Map 0% to y=150, 100% to y=30 (120px dynamic vertical curve range)
      const y = 150 - (Math.max(0, Math.min(100, pct)) / 100) * 120;
      const projVehicles = Math.round(baseVeh * (1 + (pct - 20) / 100));
      const projSpeed = Math.max(12, Math.round(baseSpd * (1 - (pct - 20) / 160)));

      return {
        x: xs[i],
        y,
        pct,
        label: h.label,
        clockTime: h.clockTime,
        level: h.level,
        key: h.key,
        projVehicles,
        projSpeed,
      };
    });

    const pathD = pts.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y.toFixed(1)}`, "");
    const areaD = `${pathD} L ${pts[pts.length - 1].x} 150 L ${pts[0].x} 150 Z`;
    return { pts, pathD, areaD };
  }, [forecastHorizons, currentMetrics]);

  // Action Button Handler
  const handleWarningAction = (action) => {
    if (action === "cctv") {
      if (onNavigateTab) onNavigateTab("cctv");
    } else {
      if (onNavigateTab) onNavigateTab("map");
      if (onSelectJunction && selectedJunction) onSelectJunction(selectedJunction);
    }
  };

  return (
    <div
      className="hide-scrollbar"
      style={{
        width: "100%",
        minHeight: "100%",
        boxSizing: "border-box",
        background: "var(--bg-surface, #1B2028)",
        border: "1px solid var(--border-default, #3D3F4E)",
        borderRadius: "4px",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* 1. HEADER: Location, Confidence, Timestamp, Warning Status */}
      <div
        style={{
          padding: "0.65rem 1.25rem",
          borderBottom: "1px solid var(--border-light, #2C303C)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: "1.1875rem",
              fontWeight: 800,
              color: "var(--text-primary, #F4F5F7)",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            {locationName} · {regionName}
          </div>
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 900,
              color: warningInfo.headerColor,
              letterSpacing: "0.04em",
              marginTop: "4px",
              textTransform: "uppercase",
            }}
          >
            {warningInfo.headerStatus}
          </div>
        </div>

        {/* Big Bold Confidence Score & Update Time */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", textAlign: "right" }}>
          <div>
            <div
              style={{
                fontSize: "0.625rem",
                fontWeight: 800,
                color: "var(--text-secondary, #A0A5B5)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {t("forecast.confidence", "CONFIDENCE")}
            </div>
            <div
              style={{
                fontSize: "1.375rem",
                fontWeight: 900,
                color: "var(--text-primary, #F4F5F7)",
                fontFamily: "var(--font-mono, monospace)",
                lineHeight: 1.1,
              }}
            >
              {forecastHorizons.confidence}
            </div>
          </div>

          <div style={{ borderLeft: "1px solid var(--border-default, #3D3F4E)", paddingLeft: "1.25rem" }}>
            <div
              style={{
                fontSize: "0.625rem",
                fontWeight: 800,
                color: "var(--text-secondary, #A0A5B5)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {t("common.updated", "UPDATED")}
            </div>
            <div
              style={{
                fontSize: "1.0625rem",
                fontWeight: 800,
                color: "var(--text-secondary, #A0A5B5)",
                fontFamily: "var(--font-mono, monospace)",
                lineHeight: 1.1,
              }}
            >
              {updatedTime}
            </div>
          </div>
        </div>
      </div>

      {/* 2. TRAFFIC STATUS HORIZONS (with Dynamic Clock Times) */}
      <div
        style={{
          padding: "0.55rem 1.25rem 0.65rem 1.25rem",
          borderBottom: "1px solid var(--border-light, #2C303C)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 800,
            color: "var(--accent-soft-blue, #60A5FA)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "0.4rem",
          }}
        >
          TRAFFIC STATUS
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.75rem",
            textAlign: "center",
          }}
        >
          {forecastHorizons.horizons.map((h) => {
            const sevColor = SEVERITY_COLORS[h.level] || "var(--status-normal, #22C55E)";
            return (
              <div
                key={h.key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  padding: "0.25rem 0",
                  borderRadius: "4px",
                  background: selectedHorizonKey === h.key ? "rgba(96, 165, 250, 0.06)" : "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
                onClick={() => setSelectedHorizonKey(h.key)}
                title={`Click to focus ${h.label} forecast`}
              >
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 800,
                    color: "var(--text-secondary, #A0A5B5)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {h.label}
                </span>

                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--accent-soft-blue, #7B8BC8)",
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {h.clockTime}
                </span>

                <span
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: 900,
                    color: "var(--text-primary, #F4F5F7)",
                    lineHeight: 1.1,
                    fontFamily: "var(--font-sans)",
                    margin: "2px 0",
                  }}
                >
                  {h.pct != null ? `${h.pct}%` : "—"}
                </span>

                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 800,
                    color: sevColor,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {h.level}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. CURRENT TRAFFIC (Left) | TRAFFIC WARNING (Right) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          borderBottom: "1px solid var(--border-light, #2C303C)",
          minHeight: "185px",
          flexShrink: 0,
        }}
      >
        {/* Left: CURRENT TRAFFIC */}
        <div
          style={{
            padding: "0.65rem 1.25rem",
            borderRight: "1px solid var(--border-light, #2C303C)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 800,
              color: "var(--status-normal, #38BDF8)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "0.35rem",
            }}
          >
            CURRENT TRAFFIC
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            {[
              { label: t("traffic.vehicles", "Vehicles"), val: currentMetrics.vehicles },
              { label: t("traffic.cars", "Cars"), val: currentMetrics.cars },
              { label: t("traffic.trucks", "Trucks"), val: currentMetrics.trucks },
              { label: t("traffic.buses", "Buses"), val: currentMetrics.buses },
              { label: t("traffic.bikes", "Bikes"), val: currentMetrics.bikes },
              { label: t("traffic.averageSpeed", "Avg. speed"), val: currentMetrics.speed },
              { label: t("traffic.occupancy", "Occupancy"), val: currentMetrics.occupancy },
              { label: t("traffic.flow", "Flow"), val: currentMetrics.flow },
            ].map(({ label, val }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary, #A0A5B5)", fontWeight: 500 }}>
                  {label}
                </span>
                <span
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-primary, #F4F5F7)",
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: TRAFFIC WARNING (Large & Clearly Visible) */}
        <div
          style={{
            padding: "0.75rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 900,
                color: warningInfo.warningColor,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "0.5rem",
              }}
            >
              {warningInfo.warningTitle}
            </div>

            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 800,
                color: "var(--text-primary, #F4F5F7)",
                lineHeight: 1.3,
                marginBottom: "0.5rem",
              }}
            >
              {warningInfo.mainText}
            </div>

            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "var(--text-secondary, #C5C9D3)",
                lineHeight: 1.45,
              }}
            >
              {warningInfo.subText}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.75rem" }}>
            <button
              type="button"
              onClick={() => handleWarningAction(warningInfo.buttonAction)}
              style={{
                height: "32px",
                padding: "0 1rem",
                fontSize: "0.6875rem",
                fontWeight: 800,
                letterSpacing: "0.04em",
                background: "var(--bg-surface-elevated, #252936)",
                color: "var(--accent-soft-blue, #7B8BC8)",
                border: "1px solid var(--border-default, #3D3F4E)",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--accent-indigo, #3E4776)";
                e.currentTarget.style.color = "#FFFFFF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--bg-surface-elevated, #252936)";
                e.currentTarget.style.color = "var(--accent-soft-blue, #7B8BC8)";
              }}
            >
              {warningInfo.buttonText}
            </button>
          </div>
        </div>
      </div>

      {/* 4. CONGESTION TREND: Detailed Interactive CHART | TABLE */}
      <div
        style={{
          padding: "0.75rem 1.25rem 0.85rem 1.25rem",
          display: "flex",
          flexDirection: "column",
          minHeight: "240px",
          flex: "1 0 240px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.5rem",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 800,
              color: "var(--accent-indigo, #A78BFA)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {t("forecast.trend", "CONGESTION TREND")}
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
              background: "var(--bg-surface-elevated, #252936)",
              border: "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "3px",
              padding: "1px",
            }}
          >
            <button
              type="button"
              onClick={() => setTrendView("chart")}
              style={{
                padding: "3px 10px",
                fontSize: "0.6875rem",
                fontWeight: 800,
                letterSpacing: "0.04em",
                border: "none",
                borderRadius: "2px",
                background: trendView === "chart" ? "var(--accent-indigo, #3E4776)" : "transparent",
                color: trendView === "chart" ? "#FFFFFF" : "var(--text-muted, #737987)",
                cursor: "pointer",
              }}
            >
              {t("forecast.chart", "CHART")}
            </button>
            <span style={{ color: "var(--border-default, #3D3F4E)", fontSize: "10px" }}>|</span>
            <button
              type="button"
              onClick={() => setTrendView("table")}
              style={{
                padding: "3px 10px",
                fontSize: "0.6875rem",
                fontWeight: 800,
                letterSpacing: "0.04em",
                border: "none",
                borderRadius: "2px",
                background: trendView === "table" ? "var(--accent-indigo, #3E4776)" : "transparent",
                color: trendView === "table" ? "#FFFFFF" : "var(--text-muted, #737987)",
                cursor: "pointer",
              }}
            >
              {t("forecast.table", "TABLE")}
            </button>
          </div>
        </div>

        {trendView === "chart" ? (
          <div style={{ flex: 1, width: "100%", minHeight: "195px", position: "relative" }}>
            <svg
              viewBox="0 0 800 200"
              preserveAspectRatio="none"
              style={{ width: "100%", height: "100%", minHeight: "195px", display: "block" }}
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.32" />
                  <stop offset="70%" stopColor="#3B82F6" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Reference Gridlines with Y-Axis Percentage Labels */}
              <g opacity="0.45">
                <line x1="60" y1="30" x2="740" y2="30" stroke="#3D3F4E" strokeDasharray="3 3" />
                <text x="50" y="34" textAnchor="end" fill="#9299A8" fontSize="10.5" fontWeight="600">100%</text>

                <line x1="60" y1="60" x2="740" y2="60" stroke="#2C303C" strokeDasharray="2 3" />
                <text x="50" y="64" textAnchor="end" fill="#737987" fontSize="10" fontWeight="500">75%</text>

                <line x1="60" y1="90" x2="740" y2="90" stroke="#3D3F4E" strokeDasharray="3 3" />
                <text x="50" y="94" textAnchor="end" fill="#9299A8" fontSize="10.5" fontWeight="600">50%</text>

                <line x1="60" y1="120" x2="740" y2="120" stroke="#2C303C" strokeDasharray="2 3" />
                <text x="50" y="124" textAnchor="end" fill="#737987" fontSize="10" fontWeight="500">25%</text>

                <line x1="60" y1="150" x2="740" y2="150" stroke="#3D3F4E" />
                <text x="50" y="154" textAnchor="end" fill="#9299A8" fontSize="10.5" fontWeight="600">0%</text>
              </g>

              {/* Shaded Area Below Line */}
              <path d={chartPoints.areaD} fill="url(#trendGradient)" />

              {/* Bold Trend Curve */}
              <path
                d={chartPoints.pathD}
                fill="none"
                stroke="#60A5FA"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interactive Data Nodes */}
              {chartPoints.pts.map((pt, i) => {
                const isHovered = hoveredPointIndex === i;
                const isSelected = selectedHorizonKey === pt.key;
                const dotColor = pt.pct >= 65 ? "#EF4444" : pt.pct >= 40 ? "#F59E0B" : "#22C55E";

                return (
                  <g
                    key={i}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredPointIndex(i)}
                    onMouseLeave={() => setHoveredPointIndex(null)}
                    onClick={() => setSelectedHorizonKey(pt.key)}
                  >
                    {/* Hover Pulse Ring */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered || isSelected ? "15" : "10"}
                      fill={dotColor}
                      fillOpacity={isHovered || isSelected ? 0.35 : 0.15}
                    />

                    {/* Data Node Circle */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered || isSelected ? "7" : "5.5"}
                      fill="#161920"
                      stroke={dotColor}
                      strokeWidth="2.8"
                    />

                    {/* High-Contrast Bold Percentage Badge */}
                    <rect
                      x={pt.x - 22}
                      y={Math.max(6, pt.y - 25)}
                      width="44"
                      height="18"
                      rx="3"
                      fill="#161920"
                      stroke={dotColor}
                      strokeWidth="1.2"
                    />
                    <text
                      x={pt.x}
                      y={Math.max(19, pt.y - 12)}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="11.5"
                      fontWeight="900"
                      fontFamily="var(--font-sans)"
                    >
                      {pt.pct}%
                    </text>

                    {/* Realtime Clock Timestamp Alone */}
                    <text
                      x={pt.x}
                      y="178"
                      textAnchor="middle"
                      fill="#93C5FD"
                      fontSize="12.5"
                      fontWeight="800"
                      fontFamily="var(--font-mono, monospace)"
                    >
                      {pt.clockTime}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Interactive Tooltip on Point Hover */}
            {hoveredPointIndex != null && (() => {
              const pt = chartPoints.pts[hoveredPointIndex];
              const leftPct = (pt.x / 800) * 100;
              return (
                <div
                  style={{
                    position: "absolute",
                    top: "4px",
                    left: `clamp(12px, calc(${leftPct}% - 75px), calc(100% - 160px))`,
                    background: "rgba(22, 25, 32, 0.95)",
                    border: "1px solid var(--border-default, #3D3F4E)",
                    borderRadius: "4px",
                    padding: "4px 8px",
                    fontSize: "0.6875rem",
                    color: "#F4F5F7",
                    pointerEvents: "none",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
                    zIndex: 10,
                  }}
                >
                  <div style={{ fontWeight: 800, color: "var(--accent-soft-blue, #7B8BC8)" }}>
                    {pt.label} · {pt.clockTime}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                    <span style={{ color: "#9299A8" }}>Congestion:</span>
                    <strong>{pt.pct}% ({pt.level})</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                    <span style={{ color: "#9299A8" }}>Est. Load:</span>
                    <span>~{pt.projVehicles} veh</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                    <span style={{ color: "#9299A8" }}>Est. Speed:</span>
                    <span>~{pt.projSpeed} km/h</span>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div style={{ flex: 1, width: "100%", overflowY: "auto" }}>
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
                    borderBottom: "1px solid var(--border-default, #3D3F4E)",
                    color: "var(--text-secondary, #A0A5B5)",
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  <th style={{ padding: "0.35rem 0.5rem" }}>HORIZON</th>
                  <th style={{ padding: "0.35rem 0.5rem" }}>CLOCK TIME</th>
                  <th style={{ padding: "0.35rem 0.5rem", textAlign: "right" }}>CONGESTION LEVEL</th>
                  <th style={{ padding: "0.35rem 0.5rem", textAlign: "right" }}>EST. VEHICLES</th>
                  <th style={{ padding: "0.35rem 0.5rem", textAlign: "right" }}>EST. SPEED</th>
                  <th style={{ padding: "0.35rem 0.5rem", textAlign: "right" }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {chartPoints.pts.map((pt) => {
                  const sColor = SEVERITY_COLORS[pt.level] || "var(--status-normal, #22C55E)";
                  const isSelected = selectedHorizonKey === pt.key;
                  return (
                    <tr
                      key={pt.key}
                      onClick={() => setSelectedHorizonKey(pt.key)}
                      style={{
                        borderBottom: "1px solid var(--border-light, #2C303C)",
                        background: isSelected ? "rgba(96, 165, 250, 0.08)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <td style={{ padding: "0.35rem 0.5rem", fontWeight: 700, color: "var(--text-primary, #F4F5F7)" }}>
                        {pt.label}
                      </td>
                      <td style={{ padding: "0.35rem 0.5rem", fontFamily: "var(--font-mono)", color: "var(--accent-soft-blue, #7B8BC8)" }}>
                        {pt.clockTime}
                      </td>
                      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontWeight: 800, color: "var(--text-primary, #F4F5F7)" }}>
                        {pt.pct != null ? `${pt.pct}%` : "—"}
                      </td>
                      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-secondary, #A0A5B5)" }}>
                        ~{pt.projVehicles}
                      </td>
                      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-secondary, #A0A5B5)" }}>
                        ~{pt.projSpeed} km/h
                      </td>
                      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontWeight: 800, color: sColor }}>
                        {pt.level}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
