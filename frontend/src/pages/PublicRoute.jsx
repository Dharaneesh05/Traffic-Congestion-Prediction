/**
 * PublicRoute.jsx — Mode 1: Public Traveler
 * ==========================================
 * Google Maps / Uber-style route planner for Tamil Nadu.
 * Users search by name, never by lat/lon.
 * Integrates with backend A* route planner via /api/get-route-by-name.
 */

import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation2, MapPin, Clock, AlertTriangle, ArrowRight,
  TrendingUp, Zap, RefreshCw, ChevronDown
} from "lucide-react";
import { getRouteByName, getTrafficStats, getPrediction } from "../api";
import LocationSearch from "../components/LocationSearch";
import RouteCard from "../components/RouteCard";
import CongestionBadge from "../components/CongestionBadge";

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const originIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.6)"></div>`,
  iconSize: [16, 16], iconAnchor: [8, 8],
});

const destIcon = L.divIcon({
  className: "",
  html: `<div style="width:20px;height:20px;background:#ef4444;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(239,68,68,0.6)"></div>`,
  iconSize: [20, 20], iconAnchor: [10, 20],
});

const ROUTE_COLORS = {
  distance:   "#3b82f6",
  congestion: "#10b981",
  forecast:   "#8b5cf6",
};

const MapFitBounds = ({ waypoints }) => {
  const map = useMap();
  useEffect(() => {
    if (waypoints?.length > 0) map.fitBounds(waypoints, { padding: [60, 60] });
  }, [waypoints, map]);
  return null;
};

export default function PublicRoute() {
  const [from, setFrom]         = useState(null);
  const [to, setTo]             = useState(null);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [activeRoute, setActiveRoute] = useState("forecast");
  const [liveStats, setLiveStats]     = useState(null);
  const [forecast, setForecast]       = useState(null);

  // Fetch live traffic stats for the congestion context
  useEffect(() => {
    const fetch = async () => {
      try {
        const [s, p] = await Promise.all([getTrafficStats(), getPrediction()]);
        if (s.metrics) setLiveStats(s.metrics);
        if (p.forecast) setForecast(p.forecast);
      } catch {}
    };
    fetch();
    const id = setInterval(fetch, 5000);
    return () => clearInterval(id);
  }, []);

  const handleSearch = async () => {
    if (!from || !to) { setError("Please select both From and To locations."); return; }
    if (from.name === to.name) { setError("Origin and destination cannot be the same."); return; }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await getRouteByName(from.name, to.name);
      setResult(data);
      setActiveRoute(data.recommendation || "forecast");
    } catch (e) {
      setError(e.message || "Could not find a route. Ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const recommended = result?.recommendation || "forecast";
  const activeData  = result?.[activeRoute];
  const waypoints   = activeData?.waypoints || [];
  const allRoutes   = ["distance", "congestion", "forecast"].filter(k => result?.[k]);

  const currentLevel  = liveStats?.congestion_level  || "FREE_FLOW";
  const currentScore  = liveStats?.congestion_score  ?? 0;
  const forecastLevel = forecast?.["15min"]?.level_q50 || "FREE_FLOW";

  // Map center — Salem region default
  const mapCenter = from
    ? [from.lat, from.lon]
    : [11.4400, 77.9500];

  return (
    <div style={{ display: "flex", height: "100%", minHeight: "calc(100vh - 68px)", position: "relative" }}>
      {/* ── Left Panel ── */}
      <motion.div
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          width: 380, flexShrink: 0,
          display: "flex", flexDirection: "column", gap: "1rem",
          padding: "1.25rem", overflowY: "auto",
          background: "rgba(8,10,14,0.75)", backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          zIndex: 10,
        }}
      >
        {/* Logo strip */}
        <div className="flex items-center gap-2 mb-1">
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Navigation2 size={18} color="white" />
          </div>
          <div>
            <div className="font-bold text-sm">Smart Route Planner</div>
            <div className="text-xs text-muted">Agentic AI • Tamil Nadu</div>
          </div>
        </div>

        {/* From / To inputs */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted uppercase tracking-wider font-bold mb-2" style={{ display: "block" }}>
              From
            </label>
            <LocationSearch
              placeholder="Search origin (e.g. Salem Bus Stand)"
              value={from}
              onChange={setFrom}
              icon={MapPin}
            />
          </div>

          {/* Swap button visual divider */}
          <div className="flex items-center gap-2">
            <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              onClick={() => { const tmp = from; setFrom(to); setTo(tmp); }}>
              <ChevronDown size={14} color="var(--accent-primary)" />
            </div>
            <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wider font-bold mb-2" style={{ display: "block" }}>
              To
            </label>
            <LocationSearch
              placeholder="Search destination (e.g. Erode Bus Stand)"
              value={to}
              onChange={setTo}
              icon={MapPin}
            />
          </div>
        </div>

        <button
          className="btn btn-primary btn-lg w-full"
          onClick={handleSearch}
          disabled={loading || !from || !to}
          style={{ marginTop: "0.25rem" }}
        >
          {loading ? (
            <><div className="spinner" style={{ width: 16, height: 16, borderTopColor: "white" }} /> Finding Best Route...</>
          ) : (
            <><Zap size={16} /> Find Best Route</>
          )}
        </button>

        {error && (
          <div className="text-xs text-danger p-3 rounded-md" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}

        {/* Live Traffic Context */}
        <div className="glass-card-flat" style={{ padding: "0.875rem" }}>
          <div className="text-xs text-muted uppercase tracking-wider font-bold mb-3">Live Traffic Context</div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-secondary">Current Congestion</span>
              <CongestionBadge level={currentLevel} score={currentScore} showScore />
            </div>
            <div className="congestion-bar">
              <div className="congestion-fill" style={{
                width: `${currentScore * 100}%`,
                background: currentScore > 0.7 ? "var(--accent-danger)" : currentScore > 0.4 ? "var(--accent-warning)" : "var(--accent-success)",
              }} />
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-secondary">Predicted (15 min)</span>
              <CongestionBadge level={forecastLevel} />
            </div>
          </div>
        </div>

        {/* Route alternatives */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted uppercase tracking-wider font-bold">Route Options</div>
                <div className="flex items-center gap-1 text-xs text-muted">
                  <span className="font-mono">{from?.name}</span>
                  <ArrowRight size={10} />
                  <span className="font-mono">{to?.name}</span>
                </div>
              </div>

              {allRoutes.map((strategy) => (
                <RouteCard
                  key={strategy}
                  strategy={strategy}
                  data={result[strategy]}
                  isRecommended={strategy === recommended}
                  active={strategy === activeRoute}
                  onClick={() => setActiveRoute(strategy)}
                />
              ))}

              {/* AI Explanation */}
              {result.savings && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="ai-panel"
                  style={{ marginTop: "0.25rem" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={14} color="var(--accent-purple)" />
                    <span className="text-xs font-bold">AI Route Analysis</span>
                  </div>
                  <p className="text-xs text-secondary" style={{ lineHeight: 1.6 }}>
                    The <strong style={{ color: "var(--accent-purple)" }}>
                      {recommended.charAt(0).toUpperCase() + recommended.slice(1)}</strong> strategy
                    is recommended based on current traffic conditions and TFT forecast.
                    {result.savings.time_saved_min > 0 && (
                      <> Saves <strong style={{ color: "var(--accent-success)" }}>{result.savings.time_saved_min} minutes</strong> by
                      avoiding {(result.savings.extra_distance_m / 1000).toFixed(1)} km of congested roads.</>
                    )}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Map ── */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer
          center={mapCenter}
          zoom={10}
          style={{ width: "100%", height: "100%", background: "#080a0e" }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Draw all routes with different opacity */}
          {result && allRoutes.map((strategy) => {
            const pts = result[strategy]?.waypoints || [];
            return pts.length > 0 ? (
              <Polyline
                key={strategy}
                positions={pts}
                color={ROUTE_COLORS[strategy]}
                weight={strategy === activeRoute ? 6 : 3}
                opacity={strategy === activeRoute ? 0.9 : 0.3}
                dashArray={strategy !== activeRoute ? "8 8" : undefined}
              />
            ) : null;
          })}

          {waypoints.length > 0 && (
            <>
              <MapFitBounds waypoints={waypoints} />
              <Marker position={waypoints[0]} icon={originIcon}>
                <Popup>{from?.name || "Origin"}</Popup>
              </Marker>
              <Marker position={waypoints[waypoints.length - 1]} icon={destIcon}>
                <Popup>{to?.name || "Destination"}</Popup>
              </Marker>
            </>
          )}
        </MapContainer>

        {/* Map overlay — route summary badge */}
        {activeData && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              background: "rgba(8,10,14,0.9)", backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 999, padding: "0.4rem 1.25rem",
              display: "flex", alignItems: "center", gap: "1.5rem",
              zIndex: 20,
            }}
          >
            <div className="flex items-center gap-1 text-sm">
              <Navigation2 size={13} color="var(--accent-primary)" />
              <span className="font-mono font-bold text-primary">
                {((activeData.metrics?.total_distance_m || 0) / 1000).toFixed(1)} km
              </span>
            </div>
            <div className="divider-v" style={{ height: 16 }} />
            <div className="flex items-center gap-1 text-sm">
              <Clock size={13} color="var(--accent-warning)" />
              <span className="font-mono font-bold text-warning">
                {(activeData.metrics?.total_time_min || 0).toFixed(0)} min
              </span>
            </div>
            <div className="divider-v" style={{ height: 16 }} />
            <CongestionBadge level={
              (activeData.metrics?.avg_congestion || 0) > 0.7 ? "CONGESTED"
              : (activeData.metrics?.avg_congestion || 0) > 0.5 ? "HEAVY"
              : (activeData.metrics?.avg_congestion || 0) > 0.3 ? "MODERATE"
              : "FREE_FLOW"
            } />
          </motion.div>
        )}

        {/* Zoom controls */}
        <div style={{
          position: "absolute", bottom: 24, right: 16,
          display: "flex", flexDirection: "column", gap: 4, zIndex: 20,
        }}>
          {["+", "−"].map((ch, i) => (
            <button
              key={i}
              style={{
                width: 34, height: 34,
                background: "rgba(8,10,14,0.9)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, color: "white", fontSize: 18, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {ch}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {!result && !loading && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center", pointerEvents: "none",
            zIndex: 5,
          }}>
            <div style={{ opacity: 0.25 }}>
              <Navigation2 size={64} color="white" style={{ marginBottom: 12 }} />
              <div className="text-secondary text-sm">Select From & To, then tap Find Best Route</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
