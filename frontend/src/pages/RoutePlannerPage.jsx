import React, { useMemo } from "react";
import RoutePlanner from "../components/RoutePlanner";
import RouteComparison, { getMonitoredLocationsAlongRoute } from "../components/RouteComparison";
import TrafficMap from "../components/TrafficMap";
import { trafficService } from "../services/trafficService";

export default function RoutePlannerPage({
  locations = [],
  onPlanRoute,
  isLoadingRoute = false,
  routeResult = null,
  activeStrategy = "recommended",
  setActiveStrategy,
  fromLocation = "",
  toLocation = "",
  cameraTelemetry = null,
  areaJunctions = [],
  selectedJunction = null,
  onSelectJunction = null,
  selectedLocation = null,
  onSelectLocation = null,
  onSelectCamera = null,
  alerts = [],
  forecast = null,
  diversionData = null,
  onEvaluateDiversion = null,
  onClearRoute = null,
}) {
  // Combine all statewide junctions
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

  // Determine active route waypoints
  const activeRoute = (activeStrategy === "alternative" && routeResult?.alternative)
    ? routeResult.alternative
    : (activeStrategy === "congested" && routeResult?.congested)
    ? routeResult.congested
    : (routeResult?.recommended || routeResult?.forecast || routeResult?.distance);

  const activeWaypoints = activeRoute?.waypoints || [];

  const routeJunctions = useMemo(() => {
    return getMonitoredLocationsAlongRoute(activeWaypoints, allStatewideJunctions, 4.5);
  }, [activeWaypoints, allStatewideJunctions]);

  const mapJunctions = routeJunctions.length > 0 ? routeJunctions : areaJunctions;

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background: "var(--bg-app, #111315)",
      }}
    >
      {/* Left Operational Column: Controls & Route Assessment */}
      <div
        style={{
          width: "400px",
          minWidth: "380px",
          maxWidth: "420px",
          height: "100%",
          overflowY: "auto",
          background: "var(--bg-sidebar, #1B2028)",
          borderRight: "1px solid var(--border-default, #3D3F4E)",
          padding: "0.75rem 0.875rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.625rem",
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        <RoutePlanner
          locations={locations}
          onPlanRoute={onPlanRoute}
          isLoading={isLoadingRoute}
          selectedFrom={fromLocation}
          selectedTo={toLocation}
          selectedJunction={selectedJunction}
          routeResult={routeResult}
          onClearRoute={onClearRoute}
          onLocationChange={() => {
            if (routeResult && onClearRoute) onClearRoute();
          }}
        />

        {routeResult && (
          <RouteComparison
            routeResult={routeResult}
            activeStrategy={activeStrategy}
            onSelectStrategy={(strat) => setActiveStrategy && setActiveStrategy(strat)}
            areaJunctions={allStatewideJunctions}
            selectedJunction={selectedJunction}
            onSelectJunction={onSelectJunction}
            onSelectLocation={onSelectLocation}
            alerts={alerts}
            forecast={forecast}
            diversionData={diversionData}
            onEvaluateDiversion={onEvaluateDiversion}
            fromLocation={fromLocation}
            toLocation={toLocation}
          />
        )}
      </div>

      {/* Right Column: Dominant MapLibre/OSM Interactive Map */}
      <div
        style={{
          flex: 1,
          height: "100%",
          minWidth: 0,
          position: "relative",
          background: "var(--bg-app, #111315)",
        }}
      >
        <TrafficMap
          routeResult={routeResult}
          activeStrategy={activeStrategy}
          cameraTelemetry={cameraTelemetry}
          fromLocation={fromLocation}
          toLocation={toLocation}
          areaJunctions={mapJunctions}
          selectedJunction={selectedJunction}
          onSelectJunction={onSelectJunction}
          selectedLocation={selectedLocation}
          onSelectCamera={onSelectCamera}
          diversionData={diversionData}
          alerts={alerts}
          isFullPage={true}
          hideOverlayControls={false}
        />
      </div>
    </div>
  );
}
