import React from "react";
import SummaryCards from "../components/SummaryCards";
import TrafficMap from "../components/TrafficMap";
import RouteComparison from "../components/RouteComparison";
import CCTVPanel from "../components/CCTVPanel";
import AlertsPanel from "../components/AlertsPanel";
import RoutePlanner from "../components/RoutePlanner";
import LocationOverviewBanner from "../components/LocationOverviewBanner";
import JunctionDetailPanel from "../components/JunctionDetailPanel";

export default function Dashboard({
  health,
  locations,
  telemetry,
  forecast,
  alerts,
  cameraStatus,
  isLoadingCameraAction,
  onStartCamera,
  onStopCamera,
  routeResult,
  activeStrategy,
  setActiveStrategy,
  onPlanRoute,
  isCalculatingRoute,
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
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* 1. Location Overview Banner (appears when a district/area is searched/selected) */}
      {(areaOverview || areaJunctions.length > 0) && (
        <LocationOverviewBanner
          overview={areaOverview}
          districtName={districtName}
          junctions={areaJunctions}
          selectedJunctionId={selectedJunction?.id}
          onSelectJunction={onSelectJunction}
          onClose={onDismissOverview}
        />
      )}

      {/* 2. Compact KPI Row (Synchronized to selected junction or aggregated area) */}
      <SummaryCards
        telemetry={telemetry}
        cameraStatus={cameraStatus}
        selectedJunction={selectedJunction}
        areaJunctions={areaJunctions}
      />

      {/* 3. Main Live Traffic Map (Centerpiece with color-coded junctions and multi-route polylines) */}
      <TrafficMap
        routeResult={routeResult}
        activeStrategy={activeStrategy}
        cameraTelemetry={telemetry}
        selectedLocation={selectedLocation}
        areaJunctions={areaJunctions}
        selectedJunction={selectedJunction}
        onSelectJunction={onSelectJunction}
        diversionData={diversionData}
        fromLocation={fromLocation}
        toLocation={toLocation}
      />

      {/* 4. Detailed Junction Intelligence & Officer Decision Panel (when a junction is selected) */}
      {selectedJunction && (
        <JunctionDetailPanel
          junction={selectedJunction}
          onClose={onCloseJunctionDetail}
          onViewCamera={(camId) => onSelectCamera && onSelectCamera(camId)}
          onEvaluateRoute={() => onEvaluateDiversion && onEvaluateDiversion(selectedJunction)}
          onOfficerAction={onOfficerAction}
          activeCameraId={activeCameraId}
        />
      )}

      {/* 5. Route Recommendation Table (when an A* corridor route is calculated) */}
      {routeResult && (
        <RouteComparison
          routeResult={routeResult}
          activeStrategy={activeStrategy}
          onSelectStrategy={(strat) => setActiveStrategy(strat)}
          telemetry={telemetry}
        />
      )}

      {/* 6. Operational Grid: Route Control, CCTV Stream, and Alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.875rem" }}>
        {/* Route Planner Inputs with Diversion Advisory */}
        <RoutePlanner
          locations={locations}
          onPlanRoute={onPlanRoute}
          isLoading={isCalculatingRoute}
          selectedFrom={fromLocation}
          selectedTo={toLocation}
          selectedJunction={selectedJunction}
          onEvaluateDiversion={onEvaluateDiversion}
          diversionData={diversionData}
          onClearDiversion={onClearDiversion}
        />

        {/* Camera Feed Terminal with Nearby Cameras */}
        <CCTVPanel
          telemetry={telemetry}
          cameraStatus={cameraStatus}
          onStartCamera={onStartCamera}
          onStopCamera={onStopCamera}
          isLoadingAction={isLoadingCameraAction}
          activeCameraId={activeCameraId}
          onSelectCamera={onSelectCamera}
          selectedJunction={selectedJunction}
        />

        {/* Operational Incident Feed with Action Buttons */}
        <AlertsPanel
          alerts={alerts}
          onViewAlert={onViewAlert}
          onAcknowledgeAlert={onAcknowledgeAlert}
        />
      </div>
    </div>
  );
}
