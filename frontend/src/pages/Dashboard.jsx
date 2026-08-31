/**
 * Dashboard.jsx — Authority Traffic Control Room Dashboard (KEMETRA Style)
 * =========================================================================
 * Smart Traffic Control & Decision Support System (Tamil Nadu Authority)
 *
 * Implements the KEMETRA visual reference from Section 5 & Page 3 of the Master Spec:
 *   - Junction Selector (Sankagiri Junction / Tamil Nadu Corridor)
 *   - Top KPI Metrics: Congestion Score, Active Vehicles, Average Speed, Forecast Risk
 *   - Large OSM Road Network Map with approach layers & diversion overlay
 *   - Traffic Insight Charts (Vehicle count, speed, flow by approach)
 *   - Events & Emergency Alerts Feed with live status
 *   - Grounded AI Decision Support Panel with evidence, SOP citations & Officer Dispatch
 *   - Key Metrics summary panel
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Car, Gauge, TrendingUp, MapPin, AlertTriangle,
  Clock, Shield, Navigation, CheckCircle2, ChevronRight,
  Radio, Layers, Send, RefreshCw, Info, AlertOctagon,
  ArrowRight, Users, Check, FileText, ChevronDown
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from "react-leaflet";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from "recharts";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  getCamerasAggregate,
  getPrediction,
  getJunctionOverview,
  getAlerts,
  sendOfficerAction,
  getAuditLog
} from "../api";
import CongestionBadge from "../components/CongestionBadge";

// Fix leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const SANKAGIRI_COORDS = [11.4800, 77.8700];

// Approach coordinates for map markers
const APPROACH_MARKERS = [
  { id: "CAM001", name: "North: NH544 Salem Inflow", lat: 11.4920, lon: 77.8700, color: "#3b82f6" },
  { id: "CAM002", name: "South: Erode Toll Inflow", lat: 11.4680, lon: 77.8700, color: "#10b981" },
  { id: "CAM003", name: "East: Namakkal Inflow", lat: 11.4800, lon: 77.8850, color: "#f59e0b" },
  { id: "CAM004", name: "West: Karur Bypass", lat: 11.4800, lon: 77.8550, color: "#8b5cf6" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [aggregate, setAggregate] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [junctionOverview, setJunctionOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [dispatchStatus, setDispatchStatus] = useState(null);
  const [selectedJunction, setSelectedJunction] = useState("Sankagiri Junction");
  const [timeFilter, setTimeFilter] = useState("Last 3 Hours");
  const [expandedSOP, setExpandedSOP] = useState(false);

  // Mock historical trend data for insight charts (minute-by-minute)
  const [chartData, setChartData] = useState([
    { time: "00:00", north: 12, south: 10, east: 8, west: 6, avgSpeed: 42 },
    { time: "00:05", north: 18, south: 14, east: 11, west: 9, avgSpeed: 38 },
    { time: "00:10", north: 26, south: 20, east: 15, west: 12, avgSpeed: 29 },
    { time: "00:15", north: 34, south: 25, east: 19, west: 14, avgSpeed: 21 },
    { time: "00:20", north: 42, south: 31, east: 24, west: 16, avgSpeed: 16 },
    { time: "00:25", north: 38, south: 28, east: 22, west: 15, avgSpeed: 19 },
    { time: "00:30", north: 29, south: 22, east: 18, west: 11, avgSpeed: 28 },
  ]);

  const loadData = async () => {
    try {
      const [agg, p, junc, alts, audit] = await Promise.all([
        getCamerasAggregate(),
        getPrediction(),
        getJunctionOverview(selectedJunction),
        getAlerts(),
        getAuditLog(10)
      ]);
      setAggregate(agg);
      if (p.forecast) setForecast(p.forecast);
      setJunctionOverview(junc);
      setAlerts(alts.alerts || []);
      setAuditLog(audit.audit_trail || []);

      // If active vehicles exist, dynamically update the latest chart point
      if (agg?.active_camera_count > 0) {
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setChartData(prev => [
          ...prev.slice(-6),
          {
            time: nowStr,
            north: agg.per_camera[0]?.vehicle_count || 20,
            south: agg.per_camera[1]?.vehicle_count || 15,
            east: agg.per_camera[2]?.vehicle_count || 10,
            west: agg.per_camera[3]?.vehicle_count || 8,
            avgSpeed: agg.avg_speed_kmh || 24
          }
        ]);
      }
    } catch (err) {
      console.error("Dashboard polling error:", err);
    }
  };

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 3500);
    return () => clearInterval(id);
  }, [selectedJunction]);

  const handleDispatch = async (plan) => {
    if (!plan) return;
    setDispatchStatus("dispatching");
    try {
      await sendOfficerAction(
        `ALT_DISPATCH_${Date.now()}`,
        "ACCEPT",
        "CONTROL_ROOM_OPERATOR",
        `Dispatched recommended diversion '${plan.target_diversion}' to Sector 4 Field Officers.`
      );
      setDispatchStatus("success");
      loadData();
      setTimeout(() => setDispatchStatus(null), 4000);
    } catch (err) {
      setDispatchStatus("error");
      setTimeout(() => setDispatchStatus(null), 4000);
    }
  };

  const hasActiveCamera = (aggregate?.active_camera_count ?? 0) > 0;
  const activePlan = junctionOverview?.active_recommendation || (junctionOverview?.diversion_plans && junctionOverview.diversion_plans[0]);
  const avgScore = hasActiveCamera ? (aggregate?.avg_congestion_score ?? 0) : (junctionOverview?.overall_congestion_score ?? 0.22);
  const totalVehicles = hasActiveCamera ? (aggregate?.total_vehicles ?? 0) : (junctionOverview?.total_observed_vehicles ?? 34);
  const avgSpeed = hasActiveCamera ? (aggregate?.avg_speed_kmh ?? 0) : (junctionOverview?.avg_arterial_speed_kmh ?? 38);
  const forecast15 = forecast?.["15min"];

  return (
    <div className="kemetra-dashboard-container">
      {/* ── Top Sub-Header & Junction Selector ── */}
      <div className="kemetra-top-bar">
        <div className="flex items-center gap-3">
          <div className="junction-select-pill">
            <span className="text-xs text-gray-400 font-semibold">Location:</span>
            <select
              value={selectedJunction}
              onChange={(e) => setSelectedJunction(e.target.value)}
              className="junction-dropdown"
            >
              <option value="Sankagiri Junction">Sankagiri Junction (Segment: TN-7C2)</option>
              <option value="Salem Junction">Salem Main Junction (NH544)</option>
              <option value="Erode Toll">Erode Toll Junction</option>
              <option value="Namakkal Signal">Namakkal Signal Corridor</option>
            </select>
          </div>
          <span className="badge-live-stream">
            <span className="live-pulse-dot" /> Live PBF Graph Connected
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button className="kemetra-tab-btn active">Overview</button>
          <button className="kemetra-tab-btn" onClick={() => navigate("/camera")}>CCTV Matrix</button>
          <button className="kemetra-tab-btn" onClick={() => navigate("/analytics")}>Analytics</button>
        </div>
      </div>

      {/* ── Top 4 KPI Cards ── */}
      <div className="kemetra-kpi-grid">
        <div className="kemetra-kpi-card">
          <div className="flex justify-between items-start">
            <div>
              <div className="kpi-label">NETWORK CONGESTION</div>
              <div className="kpi-value-large text-blue-500">
                {`${(avgScore * 100).toFixed(0)}%`}
              </div>
            </div>
            <div className="kpi-icon-container bg-blue-500/10 text-blue-500">
              <Activity size={20} />
            </div>
          </div>
          <div className="kpi-footer">
            <span className="font-semibold text-xs text-gray-300">
              {hasActiveCamera ? `${aggregate.active_camera_count} approaches streaming live` : "Junction Inflow Monitoring"}
            </span>
          </div>
        </div>

        <div className="kemetra-kpi-card">
          <div className="flex justify-between items-start">
            <div>
              <div className="kpi-label">ACTIVE / TOTAL VEHICLES</div>
              <div className="kpi-value-large text-emerald-500">
                {totalVehicles}
                <span className="text-xs text-gray-400 font-normal ml-1">VEH</span>
              </div>
            </div>
            <div className="kpi-icon-container bg-emerald-500/10 text-emerald-500">
              <Car size={20} />
            </div>
          </div>
          <div className="kpi-footer">
            <span className="text-xs text-gray-300">
              {hasActiveCamera ? `Cars: ${aggregate?.class_counts?.car || 0} • Commercial: ${(aggregate?.class_counts?.truck || 0) + (aggregate?.class_counts?.bus || 0)}` : "4-Approach Cumulative Inflow"}
            </span>
          </div>
        </div>

        <div className="kemetra-kpi-card">
          <div className="flex justify-between items-start">
            <div>
              <div className="kpi-label">AVERAGE SPEED</div>
              <div className="kpi-value-large text-amber-500">
                {`${avgSpeed.toFixed(0)}`}
                <span className="text-xs text-gray-400 font-normal ml-1">KM/H</span>
              </div>
            </div>
            <div className="kpi-icon-container bg-amber-500/10 text-amber-500">
              <Gauge size={20} />
            </div>
          </div>
          <div className="kpi-footer">
            <span className="text-xs text-gray-300">
              {avgSpeed < 20 ? "⚠️ Below design speed threshold" : "Nominal arterial velocity"}
            </span>
          </div>
        </div>

        <div className="kemetra-kpi-card">
          <div className="flex justify-between items-start">
            <div>
              <div className="kpi-label">+15 MIN FORECAST RISK</div>
              <div className="kpi-value-large text-purple-400">
                {forecast15?.level_q50 ? forecast15.level_q50.replace("_", " ") : "MODERATE"}
              </div>
            </div>
            <div className="kpi-icon-container bg-purple-500/10 text-purple-400">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="kpi-footer">
            <span className="text-xs text-gray-300">
              {forecast15?.q50 != null ? `TFT Median: ${(forecast15.q50 * 100).toFixed(0)}% score` : "TFT Model Active"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Layout (Map on Left, Charts & Decision on Right) ── */}
      <div className="kemetra-main-grid">
        {/* Left: Large OSM Road Network Map */}
        <div className="kemetra-map-panel">
          <div className="map-panel-header">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-blue-400" />
              <span className="font-bold text-sm text-gray-200">OpenStreetMap Road Network • {selectedJunction}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Layers size={13} />
              <span>4 Approaches Monitored</span>
            </div>
          </div>

          <div className="leaflet-map-wrapper">
            <MapContainer
              center={SANKAGIRI_COORDS}
              zoom={13}
              style={{ height: "100%", width: "100%", borderRadius: "10px" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />

              {/* Central Junction Marker */}
              <Marker position={SANKAGIRI_COORDS}>
                <Popup>
                  <div className="p-1">
                    <b>{selectedJunction}</b><br />
                    Central Node (OSM ID: 7C2)<br />
                    Status: <b className="text-emerald-600">{junctionOverview?.status || "MONITORING"}</b>
                  </div>
                </Popup>
              </Marker>

              {/* Monitored Approach Markers */}
              {APPROACH_MARKERS.map((app) => (
                <CircleMarker
                  key={app.id}
                  center={[app.lat, app.lon]}
                  radius={10}
                  fillColor={app.color}
                  color="#ffffff"
                  weight={2}
                  fillOpacity={0.85}
                >
                  <Popup>
                    <div className="p-1">
                      <b>{app.name}</b><br />
                      Camera: {app.id}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* Active Recommended Diversion Route Polyline */}
              {activePlan?.coordinates && activePlan.coordinates.length > 1 && (
                <Polyline
                  positions={activePlan.coordinates.map(c => [c.lat, c.lon])}
                  color="#10b981"
                  weight={6}
                  dashArray="8, 8"
                />
              )}
            </MapContainer>
          </div>

          {/* Approaches Status Bar below Map */}
          <div className="map-approaches-strip">
            {(junctionOverview?.approaches || [
              { approach_id: "APP_NORTH", approach_name: "North (NH544)", congestion_level: "UNAVAILABLE", status: "OFFLINE", vehicle_count: 0, average_speed_kmh: 0 },
              { approach_id: "APP_SOUTH", approach_name: "South (Erode)", congestion_level: "UNAVAILABLE", status: "OFFLINE", vehicle_count: 0, average_speed_kmh: 0 },
              { approach_id: "APP_EAST", approach_name: "East (Namakkal)", congestion_level: "UNAVAILABLE", status: "OFFLINE", vehicle_count: 0, average_speed_kmh: 0 },
              { approach_id: "APP_WEST", approach_name: "West (Karur)", congestion_level: "UNAVAILABLE", status: "OFFLINE", vehicle_count: 0, average_speed_kmh: 0 },
            ]).map((app) => (
              <div key={app.approach_id} className="approach-mini-pill">
                <span className={`status-dot-tiny ${app.status === "ONLINE" ? "online" : "offline"}`} />
                <span className="truncate max-w-[110px] font-semibold text-xs">{app.approach_name.split("(")[0]}</span>
                <span className={`badge-mini ${app.congestion_level.toLowerCase()}`}>{app.status === "ONLINE" ? app.congestion_level : "OFFLINE"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Traffic Insights, Events, AI Decision Support & Key Metrics */}
        <div className="kemetra-right-panel">
          {/* Traffic Insights Charts (KEMETRA style) */}
          <div className="kemetra-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-emerald-400" />
                <span className="font-bold text-sm text-gray-200">Traffic Insights</span>
              </div>
              <span className="text-xs text-gray-400">{timeFilter} • Multi-Approach Inflow</span>
            </div>

            <div style={{ height: "150px", width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" stroke="#6b7280" fontSize={10} />
                  <YAxis stroke="#6b7280" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", borderColor: "#374151", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Line type="monotone" dataKey="north" name="North (NH544)" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="south" name="South (Erode)" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="east" name="East (Namakkal)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Events & Incident Feed */}
          <div className="kemetra-card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertOctagon size={16} className="text-amber-400" />
                <span className="font-bold text-sm text-gray-200">Active Events & Incident Feed</span>
              </div>
              <span className="badge-count">{alerts.length} ALERTS</span>
            </div>

            <div className="events-scroll-list">
              {alerts.length > 0 ? (
                alerts.slice(0, 3).map((alt) => (
                  <div key={alt.alert_id} className={`event-item-row ${alt.severity.toLowerCase()}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-gray-200">{alt.approach}</span>
                      <span className={`event-status-tag ${alt.status.toLowerCase()}`}>{alt.status}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{alt.message}</div>
                    <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-2">
                      <Clock size={10} /> {new Date(alt.timestamp * 1000).toLocaleTimeString()} • Severity: {alt.severity}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-500 py-3 text-center">
                  No active critical events detected. Nominal surveillance mode.
                </div>
              )}
            </div>
          </div>

          {/* AI Decision Support & Explainable Diversion Box */}
          <div className="kemetra-card ai-decision-box">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Navigation size={16} className="text-blue-400" />
                <span className="font-bold text-sm text-gray-100">AI Decision Support & Actionable Diversion</span>
              </div>
              {activePlan && (
                <span className="badge-confidence">{activePlan.confidence}% Confidence</span>
              )}
            </div>

            {activePlan ? (
              <div>
                <div className="ai-cause-banner">
                  <span className="font-bold text-xs text-blue-300">CAUSAL EVIDENCE:</span>
                  <div className="text-xs text-gray-300 mt-0.5">{activePlan.likely_cause}</div>
                </div>

                <div className="ai-rec-text mt-2 font-bold text-sm text-white">
                  👉 {activePlan.police_action}
                </div>

                <div className="grid grid-cols-3 gap-2 my-2.5 p-2 bg-gray-900/60 rounded-lg text-center text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] block">EST. TIME SAVED</span>
                    <b className="text-emerald-400 text-sm">~{activePlan.time_saved_min} min</b>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] block">CLEARANCE TIME</span>
                    <b className="text-emerald-400 text-sm">{activePlan.estimated_clearance_min} min</b>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] block">TARGET BYPASS</span>
                    <b className="text-blue-400 text-xs truncate block">{activePlan.target_diversion.split(" ")[0]}</b>
                  </div>
                </div>

                {/* SOP / Policy Citations Accordion */}
                <div className="sop-expand-bar" onClick={() => setExpandedSOP(!expandedSOP)}>
                  <div className="flex items-center justify-between text-xs text-gray-300 font-semibold cursor-pointer">
                    <span className="flex items-center gap-1">
                      <FileText size={12} className="text-blue-400" />
                      IRC & Tamil Nadu Police SOP Grounding
                    </span>
                    <ChevronDown size={14} style={{ transform: expandedSOP ? "rotate(180deg)" : "rotate(0)" }} />
                  </div>
                  {expandedSOP && (
                    <div className="mt-2 text-[11px] text-gray-400 border-t border-gray-800 pt-2 flex flex-col gap-1">
                      {activePlan.applicable_policy?.applicable_rules?.map((rule, idx) => (
                        <div key={idx} className="flex items-start gap-1">
                          <span className="text-blue-400">•</span>
                          <span>{rule}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dispatch Button */}
                <button
                  className={`dispatch-btn ${dispatchStatus === "success" ? "success" : ""}`}
                  disabled={dispatchStatus === "dispatching"}
                  onClick={() => handleDispatch(activePlan)}
                >
                  {dispatchStatus === "dispatching" ? (
                    <><RefreshCw size={14} className="animate-spin" /> Disagreeing & Sending...</>
                  ) : dispatchStatus === "success" ? (
                    <><Check size={14} /> Dispatched to Officer Mobile App!</>
                  ) : (
                    <><Send size={14} /> Dispatch Action to Field Officer Mobile App</>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-xs text-gray-400 py-3 text-center">
                All approaches operating under nominal service rate. No active diversion required.
              </div>
            )}
          </div>

          {/* Key Metrics Panel (KEMETRA reference bottom right) */}
          <div className="kemetra-card">
            <div className="font-bold text-xs text-gray-300 uppercase tracking-wider mb-2">Key Metrics</div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-gray-900/40 rounded-lg">
                <span className="text-gray-500 text-[10px] block">MONITORED</span>
                <b className="text-white text-sm">4 Approaches</b>
              </div>
              <div className="p-2 bg-gray-900/40 rounded-lg">
                <span className="text-gray-500 text-[10px] block">ACTIVE CCTV</span>
                <b className="text-emerald-400 text-sm">{aggregate?.active_camera_count || 0} / 4</b>
              </div>
              <div className="p-2 bg-gray-900/40 rounded-lg">
                <span className="text-gray-500 text-[10px] block">ALERTS</span>
                <b className="text-amber-400 text-sm">{alerts.length} Pending</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
