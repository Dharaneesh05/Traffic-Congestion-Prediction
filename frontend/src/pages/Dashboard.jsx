import React from "react";
import SummaryCards from "../components/SummaryCards";
import TrafficMap from "../components/TrafficMap";
import RouteComparison from "../components/RouteComparison";
import CCTVPanel from "../components/CCTVPanel";
import AlertsPanel from "../components/AlertsPanel";
import RoutePlanner from "../components/RoutePlanner";

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
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {/* 1. Compact KPI Row */}
      <SummaryCards
        telemetry={telemetry}
        cameraStatus={cameraStatus}
      />

      {/* 2. Main Live Traffic Map (Centerpiece) */}
      <TrafficMap
        routeResult={routeResult}
        activeStrategy={activeStrategy}
        cameraTelemetry={telemetry}
        selectedLocation={selectedLocation}
      />

      {/* 3. Route Recommendation Table */}
      {routeResult && (
        <RouteComparison
          routeResult={routeResult}
          activeStrategy={activeStrategy}
          onSelectStrategy={(strat) => setActiveStrategy(strat)}
          telemetry={telemetry}
        />
      )}

      {/* 4. Operational Grid: Route Control, CCTV Stream, and Alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.875rem" }}>
        {/* Route Planner Inputs */}
        <RoutePlanner
          locations={locations}
          onPlanRoute={onPlanRoute}
          isLoading={isCalculatingRoute}
          selectedFrom={fromLocation}
          selectedTo={toLocation}
        />

        {/* Camera Feed Terminal */}
        <CCTVPanel
          telemetry={telemetry}
          cameraStatus={cameraStatus}
          onStartCamera={onStartCamera}
          onStopCamera={onStopCamera}
          isLoadingAction={isLoadingCameraAction}
          activeCameraId={activeCameraId}
          onSelectCamera={onSelectCamera}
        />

        {/* Operational Incident Feed */}
        <AlertsPanel alerts={alerts} />
      </div>
    </div>
  );
}
