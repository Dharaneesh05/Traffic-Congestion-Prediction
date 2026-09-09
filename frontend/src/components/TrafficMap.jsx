import React, { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Maximize2, RotateCcw, Layers, Eye } from "lucide-react";
import { getRiskLevel } from "../services/tamilNaduTrafficData";

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

// Helper to safely convert coordinates to [lon, lat] for MapLibre
const toLngLat = (pt) => {
  if (!pt) return null;
  if (Array.isArray(pt)) {
    if (pt.length < 2) return null;
    if (pt[0] > 70) return [pt[0], pt[1]]; // [lon, lat]
    return [pt[1], pt[0]]; // [lat, lon] -> [lon, lat]
  }
  if (typeof pt === "object") {
    const lat = pt.lat ?? pt.latitude;
    const lon = pt.lon ?? pt.lng ?? pt.longitude;
    if (lon != null && lat != null) return [lon, lat];
  }
  return null;
};

export default function TrafficMap({
  routeResult = null,
  activeStrategy = "forecast",
  cameraTelemetry = null,
  selectedLocation = null,
  areaJunctions = [],
  selectedJunction = null,
  onSelectJunction,
  diversionData = null,
  center = [78.146, 11.664], // Salem / Central Tamil Nadu default
  zoom = 9,
  isFullPage = false,
  fromLocation = null,
  toLocation = null,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const routeMarkersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Layer Visibility Controls
  const [layers, setLayers] = useState({
    junctions: true,
    cameras: true,
    congestion: true,
    routes: true,
  });
  const [showLayerMenu, setShowLayerMenu] = useState(false);

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
      // 1. Alternative Route (Green) - added first so Recommended route renders on top
      if (!map.getSource("route-alt")) {
        map.addSource("route-alt", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "route-alt-casing",
          type: "line",
          source: "route-alt",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 6.5,
            "line-opacity": 0.85,
          },
        });
        map.addLayer({
          id: "route-alt-layer",
          type: "line",
          source: "route-alt",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#10b981", // Alternative Green
            "line-width": 4,
            "line-opacity": 0.95,
          },
        });
      }

      // 2. Primary / Recommended Route Line (Blue) - added second so it is visually more prominent
      if (!map.getSource("route-line")) {
        map.addSource("route-line", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "route-line-casing",
          type: "line",
          source: "route-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 8.5,
            "line-opacity": 0.9,
          },
        });
        map.addLayer({
          id: "route-line-layer",
          type: "line",
          source: "route-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#2563eb", // Recommended Blue
            "line-width": 5.5,
            "line-opacity": 1.0,
          },
        });
      }

      // 3. Congested Segment (Red) - for junction diversion scenarios
      if (!map.getSource("route-congested")) {
        map.addSource("route-congested", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "route-congested-layer",
          type: "line",
          source: "route-congested",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#dc2626", // Congested Red
            "line-width": 6,
            "line-opacity": 0.95,
          },
        });
      }

      map.resize();
      setMapLoaded(true);
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
      routeMarkersRef.current.forEach((m) => m.remove());
      routeMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  // 2. Center & Zoom to Selected Location or District
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedLocation) return;

    const targetLon = selectedLocation.lon || (selectedLocation.coords && selectedLocation.coords[0]);
    const targetLat = selectedLocation.lat || (selectedLocation.coords && selectedLocation.coords[1]);

    if (targetLon != null && targetLat != null) {
      map.flyTo({
        center: [targetLon, targetLat],
        zoom: selectedLocation.searchCategory === "junction" ? 14 : 12,
        duration: 900,
      });
    }
  }, [selectedLocation]);

  // 3. Render Junction Markers, Camera Markers, and Polylines
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Clear old junction and camera markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Clear old route origin/destination markers
    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];

    // 3a. Render Junction Markers
    if (layers.junctions && areaJunctions && areaJunctions.length > 0) {
      areaJunctions.forEach((jnc) => {
        if (!jnc.coords || jnc.coords.length < 2) return;
        const [jLon, jLat] = jnc.coords;
        const isSelected = selectedJunction?.id === jnc.id;
        const risk = getRiskLevel(jnc.congestionScore);

        // SVG Pin Element
        const pinEl = document.createElement("div");
        pinEl.style.cursor = "pointer";
        pinEl.style.transition = "transform 0.15s ease";
        pinEl.innerHTML = `
          <div style="
            background: ${isSelected ? '#0f172a' : risk.color};
            color: #ffffff;
            padding: 3px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 800;
            border: 1.5px solid #ffffff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
            transform: ${isSelected ? 'scale(1.1)' : 'scale(1.0)'};
          ">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></span>
            <span>${jnc.name}</span>
          </div>
        `;

        const vCount = jnc.metrics?.vehicleCount ?? "--";
        const spd = jnc.metrics?.averageSpeedKmh != null ? `${jnc.metrics.averageSpeedKmh} km/h` : "--";
        const cScore = jnc.congestionScore != null ? jnc.congestionScore.toFixed(2) : "--";
        const predWorsen = jnc.prediction?.trend || "+15 min";
        const camCount = (jnc.cameras || []).length;
        const onlineCamCount = (jnc.cameras || []).filter(c => c.status === "ONLINE").length;

        const popupHtml = `
          <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 3px; min-width: 170px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="color: #0f172a; font-size: 12px;">${jnc.name}</strong>
              <span style="font-size: 9px; font-weight: 800; color: ${risk.color}; background: ${risk.bg}; padding: 1px 4px; border-radius: 2px;">
                ${jnc.status || risk.label}
              </span>
            </div>
            <div style="color: #64748b; font-size: 10px; margin-top: 2px;">
              ${jnc.area || jnc.district} • Score: <strong>${cScore}</strong>
            </div>
            <div style="margin-top: 5px; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 2px;">
              <div>Vehicles: <strong>${vCount}</strong></div>
              <div>Speed: <strong>${spd}</strong></div>
              <div>Prediction: <strong>${predWorsen}</strong></div>
              <div>Cameras: <strong>${onlineCamCount}/${camCount}</strong></div>
            </div>
            <div style="margin-top: 6px; text-align: right;">
              <span style="font-size: 9px; color: #2563eb; font-weight: 700;">Click marker to view details</span>
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 12 }).setHTML(popupHtml);

        const marker = new maplibregl.Marker({ element: pinEl, anchor: "bottom" })
          .setLngLat([jLon, jLat])
          .setPopup(popup)
          .addTo(map);

        pinEl.addEventListener("click", () => {
          if (onSelectJunction) onSelectJunction(jnc);
        });

        markersRef.current.push(marker);
      });
    }

    // 3b. Render Configured Real Cameras (e.g. CCTV-SKG-01 at Sankagiri)
    if (layers.cameras) {
      const camLat = 11.480;
      const camLon = 77.870;
      const camEl = document.createElement("div");
      camEl.className = "radar-ping-marker";
      camEl.title = "CCTV-SKG-01 (Sankagiri Junction)";

      const vel = cameraTelemetry?.average_speed_kmh != null ? `${cameraTelemetry.average_speed_kmh.toFixed(1)} km/h` : "--";
      const vCount = cameraTelemetry?.vehicle_count != null ? cameraTelemetry.vehicle_count : "--";
      const cScore = cameraTelemetry?.congestion_score != null ? cameraTelemetry.congestion_score.toFixed(2) : "--";

      const camPopupHtml = `
        <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 2px;">
          <strong style="color: #0f172a; font-size: 12px;">CCTV-SKG-01</strong><br/>
          <span style="color: #64748b;">Sankagiri Junction • NH544</span>
          <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 10px;">
            <div>Status: <strong style="color: #16a34a;">ONLINE (LIVE)</strong></div>
            <div>Vehicles: <strong>${vCount}</strong></div>
            <div>Speed: <strong>${vel}</strong></div>
            <div>Congestion: <strong>${cScore}</strong></div>
          </div>
        </div>
      `;

      const camMarker = new maplibregl.Marker({ element: camEl })
        .setLngLat([camLon, camLat])
        .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(camPopupHtml))
        .addTo(map);
      markersRef.current.push(camMarker);
    }

    // 3c. Diversion Multi-Route Polylines
    if (layers.routes && diversionData) {
      const allCoords = [];

      // 1. Recommended Route (Blue)
      if (diversionData.recommendedCoordinates && map.getSource("route-line")) {
        map.getSource("route-line").setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { label: "Recommended Diversion" },
              geometry: { type: "LineString", coordinates: diversionData.recommendedCoordinates },
            },
          ],
        });
        allCoords.push(...diversionData.recommendedCoordinates);
      }

      // 2. Alternative Route (Green)
      if (diversionData.alternativeCoordinates && map.getSource("route-alt")) {
        map.getSource("route-alt").setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { label: "Alternative Route" },
              geometry: { type: "LineString", coordinates: diversionData.alternativeCoordinates },
            },
          ],
        });
        allCoords.push(...diversionData.alternativeCoordinates);
      }

      // 3. Congested Segment (Red)
      if (diversionData.congestedCoordinates && map.getSource("route-congested")) {
        map.getSource("route-congested").setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { label: "Congested Segment" },
              geometry: { type: "LineString", coordinates: diversionData.congestedCoordinates },
            },
          ],
        });
        allCoords.push(...diversionData.congestedCoordinates);
      }

      // Auto-fit map bounds to the diversion routes
      if (allCoords.length > 0) {
        let minLon = 180, minLat = 90, maxLon = -180, maxLat = -90;
        allCoords.forEach(([lon, lat]) => {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });
        if (minLon < maxLon && minLat < maxLat) {
          map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 60, maxZoom: 14, duration: 800 });
        }
      }
    } else if (layers.routes && routeResult) {
      // Standard Corridor Turn-by-Turn Routes (from Routing Engine / OSRM)
      const recKey = activeStrategy || routeResult.recommendation || "forecast";
      const altKey = recKey === "distance" ? (routeResult.congestion ? "congestion" : "forecast") : "distance";

      const recData = routeResult[recKey] || routeResult[routeResult.recommendation] || routeResult.forecast || routeResult.distance;
      const altData = routeResult[altKey] || (recKey !== "distance" ? routeResult.distance : routeResult.forecast);

      const recWaypoints = recData?.waypoints || [];
      const altWaypoints = altData?.waypoints || [];

      const recCoords = recWaypoints.map(toLngLat).filter(Boolean);
      const altCoords = altWaypoints.map(toLngLat).filter(Boolean);

      const allCoords = [];

      // 1. Alternative Route (Green - underneath Recommended)
      if (altCoords.length > 0 && map.getSource("route-alt")) {
        map.getSource("route-alt").setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { strategy: altKey, role: "alternative" },
              geometry: { type: "LineString", coordinates: altCoords },
            },
          ],
        });
        allCoords.push(...altCoords);
      } else if (map.getSource("route-alt")) {
        map.getSource("route-alt").setData({ type: "FeatureCollection", features: [] });
      }

      // 2. Recommended Route (Blue - on top, bold)
      if (recCoords.length > 0 && map.getSource("route-line")) {
        map.getSource("route-line").setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { strategy: recKey, role: "recommended" },
              geometry: { type: "LineString", coordinates: recCoords },
            },
          ],
        });
        allCoords.push(...recCoords);
      } else if (map.getSource("route-line")) {
        map.getSource("route-line").setData({ type: "FeatureCollection", features: [] });
      }

      // 3. Clear congested segment when calculating clean corridor routing
      if (map.getSource("route-congested")) {
        map.getSource("route-congested").setData({ type: "FeatureCollection", features: [] });
      }

      // 4. Place Start (Origin) and Destination Markers
      const originName = routeResult.from_name || fromLocation || "Origin";
      const destName = routeResult.to_name || toLocation || "Destination";

      const originLngLat = routeResult.from_coords
        ? toLngLat(routeResult.from_coords)
        : recData?.origin
        ? toLngLat(recData.origin)
        : recCoords.length > 0
        ? recCoords[0]
        : null;

      const destLngLat = routeResult.to_coords
        ? toLngLat(routeResult.to_coords)
        : recData?.destination
        ? toLngLat(recData.destination)
        : recCoords.length > 0
        ? recCoords[recCoords.length - 1]
        : null;

      if (originLngLat) {
        const startEl = document.createElement("div");
        startEl.style.cursor = "pointer";
        startEl.style.zIndex = "5";
        startEl.innerHTML = `
          <div style="
            background: #1d4ed8;
            color: #ffffff;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 800;
            border: 2px solid #ffffff;
            box-shadow: 0 3px 8px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            gap: 5px;
            white-space: nowrap;
            font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          ">
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #93c5fa; border: 1.5px solid #ffffff;"></span>
            <span>ORIGIN: ${originName}</span>
          </div>
        `;

        const startPopupHtml = `
          <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 2px;">
            <div style="color: #1d4ed8; font-weight: 800; font-size: 9px; text-transform: uppercase;">Origin Location</div>
            <strong style="color: #0f172a; font-size: 12px;">${originName}</strong>
          </div>
        `;

        const startMarker = new maplibregl.Marker({ element: startEl, anchor: "bottom" })
          .setLngLat(originLngLat)
          .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(startPopupHtml))
          .addTo(map);

        routeMarkersRef.current.push(startMarker);
      }

      if (destLngLat) {
        const destEl = document.createElement("div");
        destEl.style.cursor = "pointer";
        destEl.style.zIndex = "5";
        destEl.innerHTML = `
          <div style="
            background: #dc2626;
            color: #ffffff;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 800;
            border: 2px solid #ffffff;
            box-shadow: 0 3px 8px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            gap: 5px;
            white-space: nowrap;
            font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          ">
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #fca5a5; border: 1.5px solid #ffffff;"></span>
            <span>DEST: ${destName}</span>
          </div>
        `;

        const recDistanceKm = recData?.metrics?.total_distance_m != null
          ? (recData.metrics.total_distance_m / 1000).toFixed(1) + " km"
          : "--";
        const recEtaMin = recData?.metrics?.total_time_min != null
          ? recData.metrics.total_time_min.toFixed(0) + " min"
          : "--";

        const destPopupHtml = `
          <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 2px; min-width: 140px;">
            <div style="color: #dc2626; font-weight: 800; font-size: 9px; text-transform: uppercase;">Destination Location</div>
            <strong style="color: #0f172a; font-size: 12px;">${destName}</strong>
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 10px; display: flex; justify-content: space-between;">
              <span>Distance: <strong>${recDistanceKm}</strong></span>
              <span>ETA: <strong>${recEtaMin}</strong></span>
            </div>
          </div>
        `;

        const destMarker = new maplibregl.Marker({ element: destEl, anchor: "bottom" })
          .setLngLat(destLngLat)
          .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(destPopupHtml))
          .addTo(map);

        routeMarkersRef.current.push(destMarker);
      }

      // Auto-fit map bounds so the entire route is framed
      if (allCoords.length > 0) {
        let minLon = 180, minLat = 90, maxLon = -180, maxLat = -90;
        allCoords.forEach(([lon, lat]) => {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });
        if (minLon < maxLon && minLat < maxLat) {
          map.fitBounds([[minLon, minLat], [maxLon, maxLat]], {
            padding: { top: 60, bottom: 60, left: 60, right: 60 },
            maxZoom: 14,
            duration: 800,
          });
        }
      }
    } else {
      // Clear route lines and markers
      if (map.getSource("route-line")) {
        map.getSource("route-line").setData({ type: "FeatureCollection", features: [] });
      }
      if (map.getSource("route-alt")) {
        map.getSource("route-alt").setData({ type: "FeatureCollection", features: [] });
      }
      if (map.getSource("route-congested")) {
        map.getSource("route-congested").setData({ type: "FeatureCollection", features: [] });
      }
      routeMarkersRef.current.forEach((m) => m.remove());
      routeMarkersRef.current = [];
    }
  }, [mapLoaded, areaJunctions, selectedJunction, cameraTelemetry, routeResult, activeStrategy, diversionData, layers, fromLocation, toLocation]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: isFullPage ? "calc(100vh - 120px)" : "600px",
        borderRadius: "var(--radius-xs)",
        overflow: "hidden",
        border: "1px solid var(--border-default)",
        background: "#e2e8f0",
      }}
    >
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Layer Control Toggle Button */}
      <div style={{ position: "absolute", top: "10px", left: "10px", zIndex: 10 }}>
        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          style={{
            background: "#ffffff",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xs)",
            padding: "5px 8px",
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            cursor: "pointer",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <Layers size={13} />
          <span>Map Layers</span>
        </button>

        {showLayerMenu && (
          <div
            style={{
              marginTop: "4px",
              background: "#ffffff",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xs)",
              padding: "6px 8px",
              boxShadow: "var(--shadow-md)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "11px",
              width: "140px",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={layers.junctions}
                onChange={(e) => setLayers({ ...layers, junctions: e.target.checked })}
              />
              <span>Junctions</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={layers.cameras}
                onChange={(e) => setLayers({ ...layers, cameras: e.target.checked })}
              />
              <span>Cameras</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={layers.routes}
                onChange={(e) => setLayers({ ...layers, routes: e.target.checked })}
              />
              <span>Routes</span>
            </label>
          </div>
        )}
      </div>

      {/* Legend Card */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(4px)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-xs)",
          padding: "5px 8px",
          fontSize: "10px",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: "3px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ fontWeight: 800, color: "var(--text-primary)", textTransform: "uppercase", fontSize: "9px" }}>
          Junction Status
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />
          <span>Normal (0 - 0.3)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#ca8a04" }} />
          <span>Moderate (0.3 - 0.6)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#ea580c" }} />
          <span>High (0.6 - 0.8)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#dc2626" }} />
          <span>Critical (0.8 - 1.0)</span>
        </div>
        {(routeResult || diversionData) && (
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "4px", marginTop: "3px", display: "flex", flexDirection: "column", gap: "3px" }}>
            <div style={{ fontWeight: 800, color: "var(--text-primary)", textTransform: "uppercase", fontSize: "9px" }}>
              Route Paths
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-block", width: 14, height: 4, borderRadius: 2, background: "#2563eb" }} />
              <span>Recommended Route</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-block", width: 14, height: 3, borderRadius: 2, background: "#10b981" }} />
              <span>Alternative Route</span>
            </div>
            {diversionData && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ display: "inline-block", width: 14, height: 3, borderRadius: 2, background: "#dc2626" }} />
                <span>Congested Segment</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
