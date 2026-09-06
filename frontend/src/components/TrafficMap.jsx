import React, { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Maximize2, RotateCcw } from "lucide-react";

const OSM_RASTER_STYLE = {
  version: 8,
  sources: {
    "osm-tiles": {
      type: "raster",
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "osm-tiles-layer",
      type: "raster",
      source: "osm-tiles",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const STRATEGY_COLORS = {
  distance: "#2563eb",   // Primary Blue
  congestion: "#059669", // Green
  forecast: "#7c3aed",   // Purple
};

export default function TrafficMap({
  routeResult = null,
  activeStrategy = "forecast",
  cameraTelemetry = null,
  selectedLocation = null,
  center = [78.146, 11.664], // Salem / Central Tamil Nadu default
  zoom = 9,
  isFullPage = false,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // 1. Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OSM_RASTER_STYLE,
      center: center,
      zoom: zoom,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    map.on("load", () => {
      // Route line GeoJSON Source
      if (!map.getSource("route-line")) {
        map.addSource("route-line", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });
      }

      // Route Casing
      if (!map.getLayer("route-line-casing")) {
        map.addLayer({
          id: "route-line-casing",
          type: "line",
          source: "route-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 6,
            "line-opacity": 0.7,
          },
        });
      }

      // Route Line
      if (!map.getLayer("route-line-layer")) {
        map.addLayer({
          id: "route-line-layer",
          type: "line",
          source: "route-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": STRATEGY_COLORS[activeStrategy] || "#2563eb",
            "line-width": 4,
            "line-opacity": 0.95,
          },
        });
      }

      map.resize();
    });

    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Center on searched location when selectedLocation changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedLocation || selectedLocation.lat == null || selectedLocation.lon == null) return;

    map.flyTo({
      center: [selectedLocation.lon, selectedLocation.lat],
      zoom: 12,
      duration: 1000,
    });
  }, [selectedLocation]);

  // 3. Update Markers & Route Geometry
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // 3a. Add configured camera marker ONLY for actual cameras (e.g. CCTV-SKG-01 at Sankagiri)
    const camLat = 11.492;
    const camLon = 77.87;
    const camEl = document.createElement("div");
    camEl.className = "radar-ping-marker";
    camEl.title = "CCTV-SKG-01 (Sankagiri Junction)";

    const vel = cameraTelemetry?.average_speed_kmh != null ? `${cameraTelemetry.average_speed_kmh.toFixed(1)} km/h` : "--";
    const vCount = cameraTelemetry?.vehicle_count != null ? cameraTelemetry.vehicle_count : "--";
    const cScore = cameraTelemetry?.congestion_score != null ? cameraTelemetry.congestion_score.toFixed(2) : "--";

    const popupHtml = `
      <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 2px;">
        <strong style="color: #0f172a; font-size: 12px;">CCTV-SKG-01</strong><br/>
        <span style="color: #64748b;">Sankagiri Junction • NH544</span>
        <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 10px;">
          <div>Vehicles: <strong>${vCount}</strong></div>
          <div>Speed: <strong>${vel}</strong></div>
          <div>Congestion: <strong>${cScore}</strong></div>
        </div>
      </div>
    `;

    const camMarker = new maplibregl.Marker({ element: camEl })
      .setLngLat([camLon, camLat])
      .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(popupHtml))
      .addTo(map);
    markersRef.current.push(camMarker);

    // 3b. Add Searched Location Marker if active
    if (selectedLocation && selectedLocation.lat && selectedLocation.lon) {
      // Check if this location is near a real camera (within ~5km)
      const distToSkg = Math.hypot(selectedLocation.lat - camLat, selectedLocation.lon - camLon);
      const hasRealCamera = distToSkg < 0.05;

      const locEl = document.createElement("div");
      locEl.innerHTML = `
        <div style="background: #1e293b; color: white; padding: 3px 8px; border-radius: 3px; font-weight: 600; font-size: 11px; border: 1px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 4px;">
          <span>📍</span> <span>${selectedLocation.name}</span>
        </div>
      `;

      const locPopupHtml = `
        <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 2px;">
          <strong style="color: #0f172a; font-size: 12px;">${selectedLocation.name}</strong><br/>
          <span style="color: #64748b;">${selectedLocation.district ? selectedLocation.district + ", Tamil Nadu" : "Tamil Nadu"}</span>
          <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 10px; color: ${hasRealCamera ? '#16a34a' : '#64748b'};">
            ${hasRealCamera ? "Camera: CCTV-SKG-01 Active" : "Camera: No connected camera in selected area."}
          </div>
        </div>
      `;

      const locMarker = new maplibregl.Marker({ element: locEl, anchor: "bottom" })
        .setLngLat([selectedLocation.lon, selectedLocation.lat])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(locPopupHtml))
        .addTo(map);
      markersRef.current.push(locMarker);
    }

    // 3c. Route Polylines
    const activeData = routeResult ? routeResult[activeStrategy] : null;
    const rawWaypoints = activeData?.waypoints || [];

    const updateGeometry = () => {
      const source = map.getSource("route-line");
      if (!source) return;

      if (rawWaypoints.length > 0) {
        const coordinates = rawWaypoints.map((pt) => [pt[1], pt[0]]);

        source.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { strategy: activeStrategy },
              geometry: { type: "LineString", coordinates: coordinates },
            },
          ],
        });

        if (map.getLayer("route-line-layer")) {
          map.setPaintProperty(
            "route-line-layer",
            "line-color",
            STRATEGY_COLORS[activeStrategy] || "#2563eb"
          );
        }

        // Fit map bounds to route if no specific location was just searched
        if (!selectedLocation) {
          const bounds = new maplibregl.LngLatBounds(coordinates[0], coordinates[0]);
          coordinates.forEach((coord) => bounds.extend(coord));
          map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 600 });
        }

        // Origin Pin (A)
        const originCoord = coordinates[0];
        const originEl = document.createElement("div");
        originEl.innerHTML = `
          <div style="background: #15803d; color: white; padding: 2px 5px; border-radius: 2px; font-weight: 700; font-size: 10px; border: 1px solid white;">
            A • ${activeData.origin?.name || "Origin"}
          </div>
        `;
        const originMarker = new maplibregl.Marker({ element: originEl, anchor: "bottom" })
          .setLngLat(originCoord)
          .addTo(map);
        markersRef.current.push(originMarker);

        // Destination Pin (B)
        const destCoord = coordinates[coordinates.length - 1];
        const destEl = document.createElement("div");
        destEl.innerHTML = `
          <div style="background: #b91c1c; color: white; padding: 2px 5px; border-radius: 2px; font-weight: 700; font-size: 10px; border: 1px solid white;">
            B • ${activeData.destination?.name || "Destination"}
          </div>
        `;
        const destMarker = new maplibregl.Marker({ element: destEl, anchor: "bottom" })
          .setLngLat(destCoord)
          .addTo(map);
        markersRef.current.push(destMarker);
      } else {
        source.setData({ type: "FeatureCollection", features: [] });
      }
    };

    if (map.isStyleLoaded()) {
      updateGeometry();
    } else {
      map.once("load", updateGeometry);
    }
  }, [routeResult, activeStrategy, cameraTelemetry, selectedLocation]);

  const handleFitRoute = () => {
    if (mapRef.current && routeResult && routeResult[activeStrategy]) {
      const pts = routeResult[activeStrategy]?.waypoints || [];
      if (pts.length > 0) {
        const coords = pts.map((p) => [p[1], p[0]]);
        const bounds = new maplibregl.LngLatBounds(coords[0], coords[0]);
        coords.forEach((c) => bounds.extend(c));
        mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 600 });
      }
    }
  };

  const handleResetTamilNadu = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [78.146, 11.664],
        zoom: 7.8,
        duration: 800,
      });
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xs)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Map Header Bar */}
      <div
        style={{
          padding: "0.5rem 0.875rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border-default)",
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>
            LIVE TRAFFIC MAP
          </span>
          <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
            OpenStreetMap Highway Network
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <button
            onClick={handleFitRoute}
            style={{
              background: "var(--bg-card-subtle)",
              border: "1px solid var(--border-default)",
              borderRadius: "2px",
              padding: "0.2rem 0.45rem",
              fontSize: "0.6875rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              color: "var(--text-secondary)",
            }}
            title="Fit view to route"
          >
            <Maximize2 size={11} />
            <span>Fit Route</span>
          </button>

          <button
            onClick={handleResetTamilNadu}
            style={{
              background: "var(--bg-card-subtle)",
              border: "1px solid var(--border-default)",
              borderRadius: "2px",
              padding: "0.2rem 0.45rem",
              fontSize: "0.6875rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              color: "var(--text-secondary)",
            }}
            title="Reset to Tamil Nadu"
          >
            <RotateCcw size={11} />
            <span>Tamil Nadu</span>
          </button>
        </div>
      </div>

      {/* MapLibre Canvas Container */}
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: isFullPage ? "calc(100vh - 150px)" : "480px",
          minHeight: "440px",
          position: "relative",
          background: "#e2e8f0",
        }}
      >
        {/* Compact Map Legend */}
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            left: "10px",
            background: "rgba(255, 255, 255, 0.96)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xs)",
            padding: "0.4rem 0.625rem",
            fontSize: "0.6875rem",
            zIndex: 10,
            boxShadow: "var(--shadow-xs)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span style={{ width: 12, height: 3, background: "#2563eb", borderRadius: 1 }}></span>
            <span style={{ color: "var(--text-secondary)" }}>Recommended Route</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span style={{ width: 12, height: 3, background: "#059669", borderRadius: 1 }}></span>
            <span style={{ color: "var(--text-secondary)" }}>Alternative Route</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb" }}></span>
            <span style={{ color: "var(--text-secondary)" }}>Camera Node (Sankagiri)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
