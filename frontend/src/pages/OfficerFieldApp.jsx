/**
 * OfficerFieldApp.jsx — Police Officer Mobile / PWA Field Interface
 * =================================================================
 * Smart Traffic Control & Decision Support System (Tamil Nadu Police)
 *
 * Dedicated mobile interface for field traffic police officers:
 *   - Urgent alerts & time-to-worsen indicators
 *   - 4-approach junction status overview (Approaches A, B, C, D)
 *   - Interactive diversion map with route overlay
 *   - Grounded AI recommendations with policy evidence
 *   - Direct officer action dispatch: Accept, Acknowledge, Reject, Resolve, Notify
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Bell,
  Radio, MapPin, Navigation, ArrowRight, RefreshCw,
  Clock, Activity, Gauge, Users, ChevronRight, Share2,
  Check, PhoneCall, Volume2, Info, ChevronDown, Video
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  getJunctionOverview,
  getAlerts,
  sendOfficerAction,
  calculateDiversion,
  getStreamUrl
} from "../api";

// Fix leaflet marker icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const SANKAGIRI_COORDS = [11.4800, 77.8700];

// Default initial alert if backend is initializing
const DEFAULT_INITIAL_ALERT = {
  alert_id: "ALT_CAM001_SKG_01",
  severity: "CRITICAL",
  alert_type: "CRITICAL_CONGESTION_STANDSTILL",
  junction: "Sankagiri Junction",
  approach: "North: NH544 Salem Inflow",
  camera_id: "CAM001",
  timestamp: Date.now() / 1000,
  message: "Critical congestion on North Inflow (NH544). Standstill conditions. Immediate diversion required.",
  evidence: [
    "Average speed dropped to 9.2 km/h",
    "Active vehicle count: 42 units exceeding design threshold",
    "Queue spillback encroaching central junction box"
  ],
  status: "PENDING",
  diversion_plan_id: "DIV_APP_NORTH"
};

export default function OfficerFieldApp({ onSwitchMode }) {
  const [junctionData, setJunctionData] = useState(null);
  const [alerts, setAlerts] = useState([DEFAULT_INITIAL_ALERT]);
  const [activeAlert, setActiveAlert] = useState(DEFAULT_INITIAL_ALERT);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);
  const [selectedApproach, setSelectedApproach] = useState("APP_NORTH");
  const [expandedPolicy, setExpandedPolicy] = useState(false);
  const [showLiveCamera, setShowLiveCamera] = useState(false);

  // Poll junction & alert status
  const refreshData = async () => {
    try {
      const [jData, aData] = await Promise.all([
        getJunctionOverview("Sankagiri Junction").catch(() => null),
        getAlerts().catch(() => ({ alerts: [] }))
      ]);

      if (jData) setJunctionData(jData);

      const alertList = aData?.alerts || [];
      if (alertList.length > 0) {
        setAlerts(alertList);
        setActiveAlert((prev) => {
          // Keep current alert or select first
          const found = alertList.find(a => a.alert_id === prev?.alert_id);
          return found || alertList[0];
        });
      }
    } catch (err) {
      console.error("Failed to load officer app data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (actionType) => {
    const alertId = activeAlert?.alert_id || `ALT_OFFICER_${Date.now()}`;
    setProcessingAction(true);

    // Optimistic UI updates
    let updatedStatus = activeAlert?.status || "PENDING";
    let toastTitle = "";

    if (actionType === "ACCEPT") {
      updatedStatus = "ACCEPTED";
      toastTitle = "Diversion Plan ACCEPTED: Traffic rerouted onto NH544 Western Loop.";
    } else if (actionType === "ACKNOWLEDGE") {
      updatedStatus = "ACKNOWLEDGED";
      toastTitle = "Alert ACKNOWLEDGED: Field officer on scene managing intersection.";
    } else if (actionType === "REJECT") {
      updatedStatus = "REJECTED";
      toastTitle = "Recommendation REJECTED: Manual officer intervention active.";
    } else if (actionType === "RESOLVE") {
      updatedStatus = "RESOLVED";
      toastTitle = "Clearance REPORTED: Nominal corridor flow restored.";
    } else if (actionType === "NOTIFY") {
      toastTitle = "PATROL / TOW REQUESTED: Nearest highway response units dispatched.";
    }

    if (activeAlert) {
      setActiveAlert({ ...activeAlert, status: updatedStatus });
    }

    try {
      await sendOfficerAction(
        alertId,
        actionType,
        "OFFICER_TN_042",
        `Action '${actionType}' dispatched from Police Officer Mobile App.`
      );
      setActionMessage({
        type: "success",
        text: toastTitle || `Action "${actionType}" dispatched to Control Room.`
      });
      await refreshData();
    } catch (err) {
      setActionMessage({
        type: "error",
        text: `Officer Action Dispatched (Local OK): ${err.message}`
      });
    } finally {
      setProcessingAction(false);
      setTimeout(() => setActionMessage(null), 4500);
    }
  };

  const currentPlan = junctionData?.active_recommendation ||
    (junctionData?.diversion_plans && junctionData.diversion_plans[0]) || {
      affected_approach: "North Approach (NH544 Salem)",
      target_bypass_road: "NH544 Bypass Road (Western Loop)",
      police_action: "Divert heavy transit vehicles onto NH544 Bypass Road. Hold right-turn phase for 90s.",
      reason: "Critical volume surge from Salem Inflow exceeding lane capacity.",
      time_saved_min: 11.4,
      estimated_clearance_min: 28,
      alternate_distance_km: 4.8,
      confidence: 94,
      evidence: [
        "Queue length exceeded 350m threshold (IRC:106)",
        "NH544 Bypass running at 28% spare capacity",
        "Estimated delay reduction: ~11.4 minutes"
      ],
      applicable_policy: {
        applicable_rules: [
          "IRC:106-1990 Capacity Guidelines for Arterial Roads",
          "TN Motor Vehicles Act §115 (Traffic Diversion Powers)"
        ]
      },
      coordinates: [
        { lat: 11.4920, lon: 77.8700 },
        { lat: 11.4880, lon: 77.8620 },
        { lat: 11.4750, lon: 77.8590 },
        { lat: 11.4680, lon: 77.8700 }
      ]
    };

  return (
    <div className="officer-app-wrapper">
      {/* Mobile Device Frame */}
      <div className="officer-mobile-container">
        {/* Officer App Header */}
        <header className="officer-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src="/tn-police-logo.png"
                alt="Tamil Nadu Police"
                style={{
                  width: "28px",
                  height: "28px",
                  objectFit: "contain",
                  display: "block",
                  flexShrink: 0,
                }}
              />
              <div>
                <div className="officer-title">TN TRAFFIC POLICE</div>
                <div className="officer-sub">Field Officer • ID #4208 • Sector 4</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="live-pulse-dot" />
              <span className="text-xs font-bold text-emerald-700">ONLINE</span>
            </div>
          </div>
        </header>

        {/* Action Feedback Banner */}
        <AnimatePresence>
          {actionMessage && (
            <motion.div
              className={`officer-toast ${actionMessage.type}`}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              style={{ zIndex: 999 }}
            >
              <CheckCircle2 size={16} />
              <span>{actionMessage.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scrollable Content */}
        <div className="officer-content">
          {/* Urgent Alert Banner */}
          {activeAlert && activeAlert.status !== "RESOLVED" ? (
            <div className={`urgent-alert-card ${activeAlert.severity?.toLowerCase() || "critical"}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider" style={{ color: "var(--status-critical, #F45E70)" }}>
                  <AlertTriangle size={15} />
                  <span>URGENT TRAFFIC ALERT • {activeAlert.severity}</span>
                </div>
                <span className={`alert-status-pill ${activeAlert.status?.toLowerCase()}`}>
                  {activeAlert.status}
                </span>
              </div>
              <div className="text-sm font-bold mb-1" style={{ color: "var(--text-primary, #F4F5F7)" }}>
                {activeAlert.approach}: {activeAlert.message}
              </div>
              <div className="flex items-center gap-4 text-xs mt-2" style={{ color: "var(--text-secondary, #A7ACB8)" }}>
                <span className="flex items-center gap-1">
                  <Clock size={12} /> Predicted worsening: <b style={{ color: "var(--text-primary, #F4F5F7)" }}>+15 min</b>
                </span>
                <span className="flex items-center gap-1">
                  <Activity size={12} /> Severity: <b style={{ color: "var(--status-critical, #F45E70)" }}>{activeAlert.severity}</b>
                </span>
              </div>
            </div>
          ) : (
            <div className="normal-status-card">
              <CheckCircle2 size={16} style={{ color: "var(--status-normal, #22C55E)" }} />
              <span>No critical emergency alerts active. Nominal flow on all sectors.</span>
            </div>
          )}

          {/* Current Junction Overview */}
          <div className="section-block">
            <div className="flex items-center justify-between mb-2">
              <span className="section-heading">Sankagiri Junction Status</span>
              <span className={`status-badge-mini ${junctionData?.status === "CRITICAL" ? "critical" : junctionData?.status === "ELEVATED" ? "warning" : "nominal"}`}>
                {junctionData?.status || "ELEVATED"}
              </span>
            </div>

            {/* 4 Approaches Grid */}
            <div className="approach-grid">
              {(junctionData?.approaches || [
                { approach_id: "APP_NORTH", approach_name: "North (NH544 Salem)", vehicle_count: 42, average_speed_kmh: 9.2, congestion_level: "CRITICAL", status: "ONLINE" },
                { approach_id: "APP_SOUTH", approach_name: "South (Erode Toll)", vehicle_count: 24, average_speed_kmh: 38.0, congestion_level: "MODERATE", status: "ONLINE" },
                { approach_id: "APP_EAST", approach_name: "East (Namakkal)", vehicle_count: 16, average_speed_kmh: 44.5, congestion_level: "LIGHT", status: "ONLINE" },
                { approach_id: "APP_WEST", approach_name: "West (Karur Bypass)", vehicle_count: 11, average_speed_kmh: 52.0, congestion_level: "FREE_FLOW", status: "ONLINE" },
              ]).map((app) => (
                <div
                  key={app.approach_id}
                  className={`approach-card ${app.congestion_level?.toLowerCase() || "nominal"} ${selectedApproach === app.approach_id ? "selected" : ""}`}
                  onClick={() => setSelectedApproach(app.approach_id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-xs truncate" style={{ color: "var(--text-primary, #F4F5F7)" }} title={app.approach_name}>
                      {app.approach_name.split("(")[0]}
                    </span>
                    <span className={`level-indicator ${app.congestion_level?.toLowerCase()}`}>
                      {app.congestion_level}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs mt-2" style={{ color: "var(--text-secondary, #A7ACB8)" }}>
                    <div>Vehicles: <b style={{ color: "var(--text-primary, #F4F5F7)", fontFamily: "var(--font-mono)" }}>{app.vehicle_count}</b></div>
                    <div>Speed: <b style={{ color: "var(--text-primary, #F4F5F7)", fontFamily: "var(--font-mono)" }}>{app.average_speed_kmh} km/h</b></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Diversion Map Preview */}
          <div className="section-block">
            <div className="flex items-center justify-between mb-2">
              <span className="section-heading">Junction Diversion Network</span>
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                <MapPin size={12} /> OSM Road Graph
              </span>
            </div>
            <div className="officer-map-frame">
              <MapContainer
                center={SANKAGIRI_COORDS}
                zoom={12}
                style={{ height: "180px", width: "100%", borderRadius: "10px" }}
                zoomControl={false}
                attributionControl={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={SANKAGIRI_COORDS}>
                  <Popup>Sankagiri Central Junction</Popup>
                </Marker>
                {currentPlan?.coordinates && currentPlan.coordinates.length > 1 && (
                  <Polyline
                    positions={currentPlan.coordinates.map(c => [c.lat, c.lon])}
                    color="#059669"
                    weight={5}
                    dashArray="6, 6"
                  />
                )}
              </MapContainer>
            </div>
          </div>

          {/* Quick Access to Live Camera Feed */}
          <div className="section-block">
            <div className="flex items-center justify-between mb-2">
              <span className="section-heading">Assigned Corridor Camera</span>
              <button
                onClick={() => setShowLiveCamera(!showLiveCamera)}
                style={{
                  background: showLiveCamera ? "#0f172a" : "#eff6ff",
                  color: showLiveCamera ? "#ffffff" : "#2563eb",
                  border: "1px solid #bfdbfe",
                  borderRadius: "4px",
                  padding: "3px 8px",
                  fontSize: "11px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  cursor: "pointer",
                }}
              >
                <Video size={12} />
                <span>{showLiveCamera ? "Hide Camera" : "View Live Stream"}</span>
              </button>
            </div>
            {showLiveCamera && (
              <div style={{ position: "relative", width: "100%", height: "200px", background: "#000000", borderRadius: "10px", overflow: "hidden" }}>
                <img
                  src={getStreamUrl()}
                  alt="Live Corridor Camera"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", padding: "2px 6px", borderRadius: "3px", color: "#fff", fontSize: "10px", fontWeight: 700 }}>
                  CAM001 • LIVE NH544 APPROACH
                </div>
              </div>
            )}
          </div>

          {/* Diversion Recommendation */}
          {currentPlan ? (
            <div className="ai-rec-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 font-bold text-xs" style={{ color: "var(--accent-soft-blue, #7B8BC8)" }}>
                  <Navigation size={15} />
                  <span>DIVERSION RECOMMENDATION</span>
                </div>
                <span className="confidence-pill" style={{ background: "rgba(123, 139, 200, 0.15)", color: "var(--accent-soft-blue, #7B8BC8)", border: "1px solid rgba(123, 139, 200, 0.35)", borderRadius: "3px", padding: "2px 6px", fontSize: "10px", fontWeight: 700 }}>
                  {currentPlan.confidence}% Confidence
                </span>
              </div>

              <div className="rec-body">
                <div className="rec-action-text font-bold text-sm mb-1" style={{ color: "var(--text-primary, #F4F5F7)" }}>
                  {currentPlan.police_action}
                </div>
                <div className="text-xs mb-2" style={{ color: "var(--text-secondary, #A7ACB8)" }}>
                  <b style={{ color: "var(--text-primary, #F4F5F7)" }}>Reason:</b> {currentPlan.reason}
                </div>

                <div className="grid grid-cols-3 gap-2 p-2.5 rounded text-center text-xs mb-3" style={{ background: "var(--bg-surface-elevated, #252936)", border: "1px solid var(--border-default, #3D3F4E)" }}>
                  <div>
                    <span style={{ color: "var(--text-muted, #737987)", display: "block", fontSize: "10px" }}>TIME SAVED</span>
                    <b style={{ color: "var(--status-normal, #22C55E)", fontSize: "0.875rem", fontFamily: "var(--font-mono)" }}>~{currentPlan.time_saved_min} min</b>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted, #737987)", display: "block", fontSize: "10px" }}>CLEARANCE</span>
                    <b style={{ color: "var(--status-normal, #22C55E)", fontSize: "0.875rem", fontFamily: "var(--font-mono)" }}>{currentPlan.estimated_clearance_min} min</b>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted, #737987)", display: "block", fontSize: "10px" }}>BYPASS DIST</span>
                    <b style={{ color: "var(--accent-soft-blue, #7B8BC8)", fontSize: "0.875rem", fontFamily: "var(--font-mono)" }}>{currentPlan.alternate_distance_km} km</b>
                  </div>
                </div>

                {/* Evidence / RAG SOP block */}
                <div className="evidence-accordion" onClick={() => setExpandedPolicy(!expandedPolicy)} style={{ borderTop: "1px solid var(--border-light, #2C303C)", paddingTop: "0.5rem" }}>
                  <div className="flex items-center justify-between text-xs font-semibold cursor-pointer" style={{ color: "var(--text-primary, #F4F5F7)" }}>
                    <span className="flex items-center gap-1">
                      <Info size={13} style={{ color: "var(--accent-soft-blue, #7B8BC8)" }} />
                      Legal Grounding & SOP Rules ({currentPlan.evidence?.length || 0} points)
                    </span>
                    <ChevronDown size={14} style={{ transform: expandedPolicy ? "rotate(180deg)" : "rotate(0)" }} />
                  </div>
                  {expandedPolicy && (
                    <div className="mt-2 text-[11px] pt-2 flex flex-col gap-1" style={{ color: "var(--text-secondary, #A7ACB8)", borderTop: "1px solid var(--border-light, #2C303C)" }}>
                      {currentPlan.evidence?.map((ev, i) => (
                        <div key={i} className="flex items-start gap-1">
                          <span style={{ color: "var(--accent-soft-blue, #7B8BC8)" }}>•</span>
                          <span>{ev}</span>
                        </div>
                      ))}
                      {currentPlan.applicable_policy?.applicable_rules?.map((rule, idx) => (
                        <div key={idx} className="flex items-start gap-1 font-medium" style={{ color: "var(--text-secondary, #A7ACB8)" }}>
                          <span style={{ color: "var(--accent-soft-blue, #7B8BC8)", fontWeight: 700 }}>IRC:</span>
                          <span>{rule}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="ai-rec-card empty">
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted, #737987)" }}>
                <Info size={15} />
                <span>All approaches operating smoothly. No diversion required at this time.</span>
              </div>
            </div>
          )}

          {/* Quick Field Action Buttons */}
          <div className="field-actions-container">
            <span className="text-xs font-bold block mb-2" style={{ color: "var(--text-primary, #F4F5F7)" }}>Officer Field Actions</span>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                id="btn-officer-accept"
                className="officer-btn btn-accept"
                disabled={processingAction}
                onClick={() => handleAction("ACCEPT")}
              >
                <CheckCircle2 size={16} />
                <span>Accept Diversion</span>
              </button>
              <button
                id="btn-officer-ack"
                className="officer-btn btn-ack"
                disabled={processingAction}
                onClick={() => handleAction("ACKNOWLEDGE")}
              >
                <Check size={16} />
                <span>Acknowledge</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                id="btn-officer-reject"
                className="officer-btn btn-reject"
                disabled={processingAction}
                onClick={() => handleAction("REJECT")}
              >
                <XCircle size={14} />
                <span>Manual Control</span>
              </button>
              <button
                id="btn-officer-resolve"
                className="officer-btn btn-resolve"
                disabled={processingAction}
                onClick={() => handleAction("RESOLVE")}
              >
                <CheckCircle2 size={14} />
                <span>Report Clearance</span>
              </button>
              <button
                id="btn-officer-notify"
                className="officer-btn btn-notify"
                disabled={processingAction}
                onClick={() => handleAction("NOTIFY")}
              >
                <Share2 size={14} />
                <span>Request Patrol/Tow</span>
              </button>
            </div>
          </div>
        </div>

        {/* Officer App Bottom Bar */}
        <footer className="officer-footer">
          <button className="switch-mode-btn" onClick={onSwitchMode}>
            <Shield size={14} />
            <span>Switch to Control Room</span>
          </button>
          <div className="text-[10px] text-center mt-1" style={{ color: "var(--text-muted, #737987)" }}>
            Tamil Nadu Traffic Authority • Field Response Subsystem
          </div>
        </footer>
      </div>
    </div>
  );
}
