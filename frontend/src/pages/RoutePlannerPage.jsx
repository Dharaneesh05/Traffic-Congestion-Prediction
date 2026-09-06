import React from "react";
import RoutePlanner from "../components/RoutePlanner";
import RouteComparison from "../components/RouteComparison";
import TrafficMap from "../components/TrafficMap";
import { Navigation2, MapPin, Clock, Zap, ShieldCheck } from "lucide-react";

export default function RoutePlannerPage({
  locations = [],
  onPlanRoute,
  isLoadingRoute = false,
  routeResult = null,
  activeStrategy = "forecast",
  setActiveStrategy,
  fromLocation = "Salem Bus Stand",
  toLocation = "Erode Bus Stand",
  cameraTelemetry = null,
}) {
  const activeData = routeResult ? routeResult[activeStrategy] : null;

  return (
    <div className="flex flex-col gap-4">
      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: "1.25rem", alignItems: "start" }}>
        {/* Left Column: Form Controls & Comparison Table */}
        <div className="flex flex-col gap-4">
          <RoutePlanner
            locations={locations}
            onPlanRoute={onPlanRoute}
            isLoading={isLoadingRoute}
            selectedFrom={fromLocation}
            selectedTo={toLocation}
          />

          {routeResult && (
            <RouteComparison
              routeResult={routeResult}
              activeStrategy={activeStrategy}
              onSelectStrategy={(strat) => setActiveStrategy && setActiveStrategy(strat)}
            />
          )}

          {/* Active Route Step Summary */}
          {activeData && activeData.found && (
            <div className="card">
              <h3 className="card-title mb-2">
                <ShieldCheck size={14} color="var(--state-green)" />
                Selected Trajectory Summary ({activeStrategy.toUpperCase()})
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.75rem" }}>
                <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Origin Node</span>
                  <strong>{activeData.origin?.name || fromLocation}</strong>
                </div>

                <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Destination Node</span>
                  <strong>{activeData.destination?.name || toLocation}</strong>
                </div>

                <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Total Distance</span>
                  <strong>{(activeData.metrics.total_distance_m / 1000.0).toFixed(2)} km</strong>
                </div>

                <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Estimated Time</span>
                  <strong>{activeData.metrics.total_time_min.toFixed(1)} min</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live OSM Map displaying route */}
        <div className="flex flex-col gap-4">
          <TrafficMap
            routeResult={routeResult}
            activeStrategy={activeStrategy}
            cameraTelemetry={cameraTelemetry}
            isFullPage={true}
          />
        </div>
      </div>
    </div>
  );
}
