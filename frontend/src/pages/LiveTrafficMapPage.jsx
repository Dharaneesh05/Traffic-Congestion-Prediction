import React from "react";
import TrafficMap from "../components/TrafficMap";

export default function LiveTrafficMapPage({
  routeResult,
  activeStrategy,
  setActiveStrategy,
  telemetry,
  cameraStatus,
  onPlanRoute,
  locations = [],
  selectedLocation = null,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <TrafficMap
        routeResult={routeResult}
        activeStrategy={activeStrategy}
        cameraTelemetry={telemetry}
        selectedLocation={selectedLocation}
        isFullPage={true}
      />
    </div>
  );
}
