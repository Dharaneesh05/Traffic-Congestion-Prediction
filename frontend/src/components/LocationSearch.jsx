/**
 * LocationSearch.jsx
 * Autocomplete search box for locations using OpenStreetMap Nominatim.
 * Resolves to {name, lat, lon} on selection.
 */

import { useState, useEffect, useRef } from "react";
import { MapPin, Search, X } from "lucide-react";
import { searchLocations } from "../api";

export default function LocationSearch({ placeholder, value, onChange, icon }) {
  const [query, setQuery] = useState(value?.name || "");
  const [filtered, setFiltered] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const Icon = icon || MapPin;

  // Sync internal state if value prop changes externally (e.g. swap button)
  useEffect(() => {
    if (value) {
      setQuery(value.name);
    } else {
      setQuery("");
    }
  }, [value]);

  useEffect(() => {
    if (!query.trim() || query === value?.name) { 
      setFiltered([]); 
      return; 
    }
    
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        // Query database location search API first
        const dbRes = await searchLocations(query).catch(() => null);
        const dbResults = (dbRes?.locations || []).map(item => ({
          id: item.id || item.junction_id,
          name: item.name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          source: item.source || "database"
        }));

        if (dbResults.length > 0) {
          setFiltered(dbResults);
        } else {
          // Fallback to Nominatim geocoding
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=in`);
          const data = await res.json();
          const results = data.map(item => ({
            name: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            source: "nominatim"
          }));
          setFiltered(results);
        }
      } catch (err) {
        console.error("Geocoding failed:", err);
      } finally {
        setLoading(false);
      }
    }, 350); // 350ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [query, value]);

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
