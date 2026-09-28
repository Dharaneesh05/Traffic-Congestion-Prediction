import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import SummaryCards from "../components/SummaryCards";
import TrafficMap from "../components/TrafficMap";
import CCTVPanel from "../components/CCTVPanel";
import AlertsPanel from "../components/AlertsPanel";
import LocationOverviewBanner from "../components/LocationOverviewBanner";
import JunctionDetailPanel from "../components/JunctionDetailPanel";
import MonitoredJunctionsTable from "../components/MonitoredJunctionsTable";
import { trafficService } from "../services/trafficService";

export default function Dashboard({
  health,
  locations,
  telemetry,
  forecast,
  alerts = [],
  cameraStatus,
  isLoadingCameraAction,
  onStartCamera,
  onStopCamera,
  routeResult,
  activeStrategy,
  setActiveStrategy,
  onPlanRoute,
  isCalculatingRoute,
  onClearRoute,
  fromLocation,
  toLocation,
  activeCameraId = "CCTV-SKG-01",
  onSelectCamera,
  selectedLocation,
  areaOverview = null,
  districtName = "Tamil Nadu",
  areaJunctions = [],
  selectedJunction = null,
  onSelectJunction,
  onCloseJunctionDetail,
  diversionData = null,
  onEvaluateDiversion,
  onClearDiversion,
  onOfficerAction,
  onViewAlert,
  onAcknowledgeAlert,
  onDismissOverview,
  onNavigateTab = null,
}) {
  const [contextTab, setContextTab] = useState("attention"); // "attention" | "junction" | "cctv"
  const [isOverviewDismissed, setIsOverviewDismissed] = useState(false);
  const [currentLiveTelemetry, setCurrentLiveTelemetry] = useState(telemetry);
  const [toastEvent, setToastEvent] = useState(null);

  // Sync currentLiveTelemetry when external telemetry prop changes
  useEffect(() => {
    if (telemetry) {
      setCurrentLiveTelemetry(telemetry);
    }
  }, [telemetry]);

  // Operational notification toast for high congestion events and active incidents (Section 23)
  useEffect(() => {
    // 1. Prioritize selected junction if highly congested
    if (selectedJunction && selectedJunction.congestionScore >= 0.6) {
      const isFiveRoads = selectedJunction.name.toLowerCase().includes("five roads");
      const title = selectedJunction.congestionScore >= 0.81 ? "SEVERE CONGESTION" : "HEAVY INFLOW";
      const text = isFiveRoads
        ? "Traffic queue extending toward Junction Road."
        : (selectedJunction.incident?.reason || "Traffic queue extending toward primary corridor approach.");
      const condition = selectedJunction.congestionScore >= 0.8 ? "Standstill" : "Very Slow";
      const time = selectedJunction.incident?.time ? selectedJunction.incident.time.replace("Reported: ", "") : "8 min ago";

      setToastEvent({ title, text, condition, time, location: selectedJunction.name });
      return;
    }

    // 2. Otherwise display top active incident from alerts list
    const activeAlert = (alerts || []).find((a) => {
      const s = (a.status || "").toUpperCase();
      return s !== "RESOLVED" && s !== "INCIDENT RESOLVED";
    });

    if (activeAlert) {
      const sev = (activeAlert.severity || "HIGH").toUpperCase();
      const title = sev === "CRITICAL" ? "CRITICAL ALERT" : "ATTENTION REQUIRED";
      const text = activeAlert.reason || "High traffic density detected on monitored corridor.";
      const condition = sev === "CRITICAL" ? "Standstill" : "Congested";
      const time = activeAlert.timestamp ? "Active" : "Just now";
      const location = activeAlert.location || "Monitored Highway Corridor";

      setToastEvent({ title, text, condition, time, location });
      return;
    }

    // 3. Fallback to any congested junction in areaJunctions
    const highCongestedJunction = (areaJunctions || []).find((j) => (j.congestionScore || 0) >= 0.6);
    if (highCongestedJunction) {
      setToastEvent({
        title: highCongestedJunction.congestionScore >= 0.81 ? "SEVERE CONGESTION" : "HEAVY INFLOW",
        text: `${highCongestedJunction.name}: traffic queue detected on approach.`,
        condition: highCongestedJunction.congestionScore >= 0.8 ? "Standstill" : "Very Slow",
        time: "Active",
        location: highCongestedJunction.name,
      });
      return;
    }
  }, [selectedJunction?.id, alerts, areaJunctions]);

  // Auto-dismiss toast notification after 6 seconds
  useEffect(() => {
    if (!toastEvent) return;
    const timer = setTimeout(() => {
      setToastEvent(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toastEvent]);

  // Show overview banner again when location/district changes
  useEffect(() => {
    setIsOverviewDismissed(false);
  }, [districtName, selectedLocation?.name]);

  // When a junction is selected, automatically switch contextual tab to junction view
  useEffect(() => {
    if (selectedJunction) {
      setContextTab("junction");
    }
  }, [selectedJunction?.id]);

  // Calculate active alert count requiring officer attention
  const activeAlertCount = (alerts || []).filter(
    (a) => a.status !== "RESOLVED" && a.status !== "INCIDENT RESOLVED"
  ).length;

  const handleSelectJunction = (j) => {
    if (onSelectJunction) onSelectJunction(j);
    if (j) {
      setContextTab("junction");
    } else {
      setContextTab("attention");
    }
  };

  const handleCloseJunction = () => {
    if (onCloseJunctionDetail) onCloseJunctionDetail();
    setContextTab("attention");
  };

  const handleViewCamera = (camId) => {
    if (onSelectCamera) onSelectCamera(camId);
    setContextTab("cctv");
  };

  const handleEvaluateRoute = (j) => {
    if (onEvaluateDiversion) onEvaluateDiversion(j);
    if (onNavigateTab) {
      onNavigateTab("routing");
    }
  };

  return (
    <div className="workstation-container">
      {/* 2. Map-First Operational Workstation (70% Left / 30% Right Split) */}
      <div className="workstation-grid">
        {/* Left Column (70%): Location Line + Traffic Measurements Strip + Map + Table */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* 1. Location Overview Banner: Slim Operational Line */}
          {!isOverviewDismissed && (areaOverview || areaJunctions.length > 0) && (
            <div className="operational-reveal-1">
              <LocationOverviewBanner
                overview={areaOverview}
                districtName={districtName}
                junctions={areaJunctions}
                onClose={() => {
                  setIsOverviewDismissed(true);
                  if (onDismissOverview) onDismissOverview();
                }}
              />
            </div>
          )}

          {/* Traffic Status Strip - Live Synced with CCTV/RTSP Video Analysis */}
          <div className="operational-reveal-1">
            <SummaryCards
              telemetry={currentLiveTelemetry || telemetry}
              cameraStatus={cameraStatus}
              selectedJunction={selectedJunction}
              areaJunctions={areaJunctions}
              activeCameraId={activeCameraId}
              districtName={districtName}
              selectedLocation={selectedLocation}
            />
          </div>

          {/* Main Traffic Map */}
          <div className="operational-reveal-2">
            <TrafficMap
              height="520px"
              routeResult={routeResult}
              activeStrategy={activeStrategy}
              cameraTelemetry={currentLiveTelemetry || telemetry}
              selectedLocation={selectedLocation}
              areaJunctions={areaJunctions}
              selectedJunction={selectedJunction}
              onSelectJunction={handleSelectJunction}
              diversionData={diversionData}
              fromLocation={fromLocation}
              toLocation={toLocation}
              onSelectCamera={handleViewCamera}
              areaOverview={areaOverview}
              districtName={districtName}
            />
          </div>

        </div>

        {/* Right Column (30%): Clean Contextual Operational Panel (No horizontal overflow) */}
        <div className="operational-reveal-2" style={{ display: "flex", flexDirection: "column" }}>
          <div className="context-panel-container">
            {/* Context Switcher Tab Bar: 3 Clean Tabs */}
            <div className="context-tab-bar">
              <button
                className={`context-tab-button ${contextTab === "attention" ? "active" : ""}`}
                onClick={() => setContextTab("attention")}
                title="View urgent traffic incidents and queued recommendations"
              >
                <span>ATTENTION</span>
                {activeAlertCount > 0 && (
                  <span className="context-tab-badge">{activeAlertCount}</span>
                )}
              </button>

              <button
                className={`context-tab-button ${contextTab === "junction" ? "active" : ""}`}
                onClick={() => setContextTab("junction")}
                disabled={!selectedJunction}
                title={selectedJunction ? `View intelligence for ${selectedJunction.name}` : "Select a junction to view details"}
              >
                <span>JUNCTION</span>
              </button>

              <button
                className={`context-tab-button ${contextTab === "cctv" ? "active" : ""}`}
                onClick={() => setContextTab("cctv")}
                title="Live CCTV camera stream and AI vehicle tracking"
              >
                <span>CCTV</span>
                {cameraStatus === "online" && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--status-online, #22C55E)" }} />
                )}
              </button>
            </div>

            {/* Contextual Panel Body */}
            <div>
              {contextTab === "attention" && (
                <AlertsPanel
                  alerts={alerts}
                  onViewAlert={(a) => {
                    if (onViewAlert) onViewAlert(a);
                    const locLower = (a?.location || a?.junction || "").toLowerCase();
                    let match = (areaJunctions || []).find((j) => {
                      const jName = (j.name || "").toLowerCase();
                      const jArea = (j.area || "").toLowerCase();
                      return (
                        (locLower && jName && (locLower.includes(jName) || jName.includes(locLower))) ||
                        (locLower && jArea && locLower.includes(jArea))
                      );
                    });
                    if (!match && trafficService?.allJunctions) {
                      match = trafficService.allJunctions.find((j) => {
                        const jName = (j.name || "").toLowerCase();
                        return locLower && jName && (locLower.includes(jName) || jName.includes(locLower));
                      });
                    }
                    if (!match && areaJunctions && areaJunctions.length > 0) {
                      match = areaJunctions[0];
                    }
                    if (match) {
                      handleSelectJunction(match);
                    }
                  }}
                  onAcknowledgeAlert={onAcknowledgeAlert}
                  onOfficerAction={onOfficerAction}
                  selectedJunction={selectedJunction}
                />
              )}

              {contextTab === "junction" && selectedJunction && (
                <JunctionDetailPanel
                  junction={selectedJunction}
                  onClose={handleCloseJunction}
                  onViewCamera={handleViewCamera}
                  onEvaluateRoute={handleEvaluateRoute}
                  onOfficerAction={onOfficerAction}
                  activeCameraId={activeCameraId}
                />
              )}

              {contextTab === "junction" && !selectedJunction && (
                <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--text-muted, #737987)", fontSize: "0.8125rem" }}>
                  Select a junction from the map or table to view intelligence and control options.
                </div>
              )}

              {contextTab === "cctv" && (
                <CCTVPanel
                  telemetry={currentLiveTelemetry || telemetry}
                  cameraStatus={cameraStatus}
                  onStartCamera={onStartCamera}
                  onStopCamera={onStopCamera}
                  onTelemetryUpdate={(newTel) => setCurrentLiveTelemetry(newTel)}
                  isLoadingAction={isLoadingCameraAction}
                  activeCameraId={activeCameraId}
                  onSelectCamera={handleViewCamera}
                  selectedJunction={selectedJunction}
                  areaJunctions={areaJunctions}
                  onSelectJunction={handleSelectJunction}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Monitored Junctions High-Density Operational Table (Full Available Page Width) */}
      <div className="operational-reveal-3" style={{ width: "100%", marginTop: "0.5rem" }}>
        <MonitoredJunctionsTable
          junctions={areaJunctions}
          selectedJunctionId={selectedJunction?.id}
          onSelectJunction={handleSelectJunction}
          telemetry={currentLiveTelemetry || telemetry}
        />
      </div>

      {/* Operational Notification Toast positioned outside the CCTV / contextual panel */}
      {toastEvent && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "24px",
            background: "var(--bg-surface, #1B2028)",
            border: "1px solid var(--border-default, #3D3F4E)",
            borderRadius: "6px",
            padding: "0.75rem 0.95rem",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
            zIndex: 9999,
            width: "320px",
            maxWidth: "calc(100vw - 48px)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            fontFamily: "var(--font-sans)",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 800,
                color: toastEvent.title?.includes("SEVERE") || toastEvent.title?.includes("CRITICAL")
                  ? "var(--status-critical, #F45E70)"
                  : "var(--status-high, #F59E0B)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {toastEvent.title || "HEAVY INFLOW"}
            </span>
            <button
              onClick={() => setToastEvent(null)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "0",
                color: "var(--text-muted, #737987)",
                display: "flex",
                alignItems: "center",
              }}
              title="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>

          {toastEvent.location && (
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary, #F4F5F7)" }}>
              {toastEvent.location}
            </div>
          )}

          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #A7ACB8)", fontWeight: 500, lineHeight: 1.35 }}>
            {toastEvent.text?.toLowerCase().includes("diversion rejected")
              ? "Diversion rejected · Standard signal timing retained"
              : toastEvent.text?.toLowerCase().includes("diversion accepted") || toastEvent.text?.toLowerCase().includes("diversion active")
              ? "Diversion active · Alternate route deployed"
              : toastEvent.text?.toLowerCase().includes("normalized")
              ? "Traffic normalized · Corridors nominal"
              : toastEvent.text}
          </div>

          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #C5CBD6)", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700 }}>
            <span style={{ color: "var(--text-primary, #FFFFFF)", fontWeight: 800 }}>
              {toastEvent.condition || "Very Slow"}
            </span>
            <span style={{ color: "var(--text-muted, #737987)", fontWeight: 600, fontSize: "0.6875rem" }}>
              {toastEvent.time || "8 min ago"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
