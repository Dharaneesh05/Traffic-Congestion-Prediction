/**
 * RouteRecommendation.jsx — Control Room Route Optimization
 * ===========================================================
 * No lat/lon inputs. Tamil Nadu location names with autocomplete.
 * Shows all 3 A* strategies on the map with AI explanation.
 */

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation2, MapPin, Zap, ArrowRight } from "lucide-react";
import { getRouteByName } from "../api";
import LocationSearch from "../components/LocationSearch";
import RouteCard from "../components/RouteCard";
import CongestionBadge from "../components/CongestionBadge";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const originIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.7)"></div>`,
  iconSize: [14, 14], iconAnchor: [7, 7],
});

const destIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;background:#ef4444;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(239,68,68,0.7)"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 18],
});

const ROUTE_COLORS = { distance: "#3b82f6", congestion: "#10b981", forecast: "#8b5cf6" };

const FitBounds = ({ pts }) => {
  const map = useMap();
  useEffect(() => { if (pts?.length > 0) map.fitBounds(pts, { padding: [50, 50] }); }, [pts, map]);
  return null;
};

const QUICK_ROUTES = [
  { from: "Salem Bus Stand", to: "Erode Bus Stand" },
  { from: "Salem Junction",  to: "Coimbatore" },
  { from: "Namakkal",       to: "Karur" },
  { from: "Erode Bus Stand", to: "Tiruppur Bus Stand" },
];

export default function RouteRecommendation() {
  const [from, setFrom]       = useState(null);
  const [to, setTo]           = useState(null);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [active, setActive]   = useState("forecast");

  const handleSearch = async () => {
    if (!from || !to) { setError("Select both origin and destination."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await getRouteByName(from.name, to.name);
      setResult(data);
      setActive(data.recommendation || "forecast");
    } catch (e) {
      setError(e.message || "Routing failed. Ensure the OSM map is loaded.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuick = (r) => {
    setFrom({ name: r.from }); setTo({ name: r.to });
  };

  const activeData  = result?.[active];
  const waypoints   = activeData?.waypoints || [];
  const allStrategies = ["distance", "congestion", "forecast"].filter(k => result?.[k]);

  return (
    <div className="flex flex-col gap-6 fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Navigation2 size={16} color="var(--accent-primary)" />
          <span className="text-xs text-muted uppercase tracking-wider font-bold">Route Optimization</span>
        </div>
        <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>A* Route Planner</h2>
        <div className="text-sm text-muted mt-1">Congestion-aware A* with TFT forecast integration · Tamil Nadu OSM network</div>
      </div>

      {/* Main layout */}
      <div className="flex gap-6" style={{ alignItems: "flex-start" }}>
        {/* Left panel */}
        <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Search inputs */}
          <div className="glass-card" style={{ padding: "1.125rem" }}>
            <div className="font-bold text-sm mb-4">Search Route</div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-muted uppercase tracking-wider font-bold mb-2" style={{ display: "block" }}>From</label>
                <LocationSearch placeholder="Origin location..." value={from} onChange={setFrom} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
                <ArrowRight size={12} color="var(--text-muted)" />
                <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wider font-bold mb-2" style={{ display: "block" }}>To</label>
                <LocationSearch placeholder="Destination location..." value={to} onChange={setTo} />
              </div>
            </div>

            <button
              className="btn btn-primary w-full mt-4"
              onClick={handleSearch}
              disabled={loading || !from || !to}
            >
              {loading ? (
                <><div className="spinner" style={{ width: 14, height: 14, borderTopColor: "white" }} /> Calculating...</>
              ) : (
                <><Zap size={14} /> Find Optimal Route</>
              )}
            </button>

            {error && (
              <div className="text-xs text-danger mt-3 p-2 rounded" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </div>
            )}
          </div>

          {/* Quick routes */}
          <div className="glass-card" style={{ padding: "1rem" }}>
            <div className="text-xs text-muted uppercase tracking-wider font-bold mb-3">Common Routes</div>
            <div className="flex flex-col gap-1">
              {QUICK_ROUTES.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleQuick(r)}
                  style={{
                    background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)",
                    borderRadius: 8, padding: "0.5rem 0.75rem", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                    color: "var(--text-secondary)", fontSize: "0.8rem", fontFamily: "var(--font-family)",
                    transition: "all 0.15s ease", textAlign: "left", width: "100%",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(59,130,246,0.07)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  <MapPin size={11} color="var(--accent-primary)" />
                  <span>{r.from}</span>
                  <ArrowRight size={10} color="var(--text-muted)" />
                  <span>{r.to}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Route results */}
          <AnimatePresence>
            {result && (
              <motion.div className="flex flex-col gap-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <div className="text-xs text-muted uppercase tracking-wider font-bold">Route Options</div>
                {allStrategies.map((strategy) => (
                  <RouteCard
                    key={strategy}
                    strategy={strategy}
                    data={result[strategy]}
                    isRecommended={strategy === result.recommendation}
                    active={strategy === active}
                    onClick={() => setActive(strategy)}
                  />
                ))}

                {/* AI Explanation */}
                <div className="ai-panel">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={13} color="var(--accent-purple)" />
                    <span className="text-xs font-bold">AI Analysis</span>
                  </div>
                  <p className="text-xs text-secondary" style={{ lineHeight: 1.6 }}>
                    Strategy <strong style={{ color: "var(--accent-purple)" }}>{result.recommendation}</strong> recommended
                    based on TFT 15-minute congestion forecast.
                    {result.savings?.time_saved_min > 0 && (
                      <> Saves <strong style={{ color: "var(--accent-success)" }}>{result.savings.time_saved_min} minutes</strong>
                      {" "}by avoiding {(result.savings.extra_distance_m / 1000).toFixed(1)} km of congested roads.</>
                    )}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Map */}
        <div className="glass-card flex-1" style={{ padding: 0, overflow: "hidden", minHeight: 560, position: "relative" }}>
          <MapContainer
            center={[11.44, 77.95]}
            zoom={9}
            style={{ width: "100%", height: "560px" }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            {result && allStrategies.map((strategy) => {
              const pts = result[strategy]?.waypoints || [];
              return pts.length > 0 ? (
                <Polyline
                  key={strategy}
                  positions={pts}
                  color={ROUTE_COLORS[strategy]}
                  weight={strategy === active ? 5 : 2.5}
                  opacity={strategy === active ? 0.9 : 0.25}
                  dashArray={strategy !== active ? "6 6" : undefined}
                />
              ) : null;
            })}

            {waypoints.length > 0 && (
              <>
                <FitBounds pts={waypoints} />
                <Marker position={waypoints[0]} icon={originIcon}>
                  <Popup>{from?.name || "Origin"}</Popup>
                </Marker>
                <Marker position={waypoints[waypoints.length - 1]} icon={destIcon}>
                  <Popup>{to?.name || "Destination"}</Popup>
                </Marker>
              </>
            )}
          </MapContainer>

          {/* Legend overlay */}
          <div style={{
            position: "absolute", bottom: 12, left: 12,
            background: "rgba(8,10,14,0.88)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: "0.5rem 0.875rem",
            display: "flex", gap: "0.875rem", zIndex: 20,
          }}>
            {Object.entries(ROUTE_COLORS).map(([k, c]) => (
              <div key={k} className="flex items-center gap-1" style={{ fontSize: "0.7rem" }}>
                <div style={{ width: 20, height: 3, background: c, borderRadius: 2 }} />
                <span style={{ color: "var(--text-muted)", textTransform: "capitalize" }}>{k}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
