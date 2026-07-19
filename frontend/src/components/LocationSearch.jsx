/**
 * LocationSearch.jsx
 * Autocomplete search box for Tamil Nadu locations.
 * Resolves to {name, lat, lon} on selection.
 */

import { useState, useEffect, useRef } from "react";
import { MapPin, Search, X } from "lucide-react";
import { getLocations } from "../api";

let _cachedLocations = null;

export default function LocationSearch({ placeholder, value, onChange, icon }) {
  const [query, setQuery] = useState(value?.name || "");
  const [locations, setLocations] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const Icon = icon || MapPin;

  useEffect(() => {
    const loadLocs = async () => {
      if (_cachedLocations) { setLocations(_cachedLocations); return; }
      setLoading(true);
      try {
        const data = await getLocations();
        _cachedLocations = data.locations || [];
        setLocations(_cachedLocations);
      } catch { /* offline fallback */ }
      finally { setLoading(false); }
    };
    loadLocs();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setFiltered([]); return; }
    const q = query.toLowerCase();
    setFiltered(
      locations.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 8)
    );
  }, [query, locations]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (loc) => {
    setQuery(loc.name);
    setOpen(false);
    onChange(loc);
  };

  const handleClear = () => {
    setQuery("");
    onChange(null);
  };

  return (
    <div className="route-input-group" ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <Icon size={16} style={{ position: "absolute", left: "0.75rem", color: "var(--text-muted)", zIndex: 1, flexShrink: 0 }} />
        <input
          className="glass-input"
          style={{ paddingLeft: "2.25rem", paddingRight: query ? "2.25rem" : "0.875rem" }}
          type="text"
          placeholder={placeholder || "Search location..."}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        {query && (
          <button
            onClick={handleClear}
            style={{ position: "absolute", right: "0.75rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (filtered.length > 0 || loading) && (
        <div className="location-autocomplete">
          {loading && (
            <div className="autocomplete-item text-muted">
              <div className="spinner" style={{ width: 14, height: 14 }} />
              Loading locations...
            </div>
          )}
          {filtered.map((loc) => (
            <div
              key={loc.name}
              className="autocomplete-item"
              onMouseDown={() => handleSelect(loc)}
            >
              <MapPin size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "0.875rem" }}>{loc.name}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
