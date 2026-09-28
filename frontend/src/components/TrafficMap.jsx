import React, { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Maximize2, RotateCcw, Layers, Eye } from "lucide-react";
import { getRiskLevel } from "../services/tamilNaduTrafficData";
import { trafficService } from "../services/trafficService";
import { useSettings } from "../context/SettingsContext";

export const MAP_RASTER_STYLES = {
  standard: [
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
  ],
  light: [
    "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  ],
  dark: [
    "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  ],
  satellite: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  ],
};

const OSM_RASTER_STYLE = {
  version: 8,
  sources: {
    "osm-tiles": {
      type: "raster",
      tiles: MAP_RASTER_STYLES.standard,
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

// Compact Officer-Focused Small Overview Template for Map Markers
function renderSmallOverviewHtml({
  title,
  subTitle = "TRAFFIC OVERVIEW",
  status = "NORMAL",
  congestionScore = 0.2,
  metrics = [],
  secondaryInfo = [],
  incident = null,
  hasDetailsAction = true,
  hasCameraAction = false,
  cameraId = null,
}) {
  let statusColor = "#16A34A";
  let statusBg = "#F0FDF4";
  let statusBorder = "#BBF7D0";

  const upperStatus = String(status).toUpperCase().trim();
  if (upperStatus === "CRITICAL" || congestionScore >= 0.81) {
    status = "CRITICAL";
    statusColor = "#DC2626";
    statusBg = "#FEF2F2";
    statusBorder = "#FECACA";
  } else if (upperStatus === "HIGH" || congestionScore >= 0.61) {
    status = "HIGH";
    statusColor = "#EA580C";
    statusBg = "#FFF7ED";
    statusBorder = "#FED7AA";
  } else if (upperStatus === "MODERATE" || congestionScore >= 0.31) {
    status = "MODERATE";
    statusColor = "#C58A00";
    statusBg = "#FEF9C3";
    statusBorder = "#FDE047";
  } else {
    status = upperStatus === "LIVE" ? "LIVE" : "NORMAL";
    statusColor = "#16A34A";
    statusBg = "#F0FDF4";
    statusBorder = "#BBF7D0";
  }

  return `
    <div style="
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      width: 270px;
      background: #FFFFFF;
      border-radius: 4px;
      overflow: hidden;
      line-height: 1.35;
      color: #0F1B33;
    ">
      <!-- Top Header Bar -->
      <div style="
        background: #0F1B33;
        color: #FFFFFF;
        padding: 8px 10px;
        padding-right: 28px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div style="min-width: 0; flex: 1; padding-right: 6px;">
          <div style="font-size: 8px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${subTitle}
          </div>
          <div style="font-size: 12px; font-weight: 800; color: #FFFFFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${title}
          </div>
        </div>
        <span style="
          font-size: 8.5px;
          font-weight: 800;
          color: ${statusColor};
          background: ${statusBg};
          border: 1px solid ${statusBorder};
          padding: 1px 5px;
          border-radius: 3px;
          letter-spacing: 0.03em;
          flex-shrink: 0;
        ">
          ${status}
        </span>
      </div>

      <!-- Operational Stat Strip -->
      <div style="
        display: grid;
        grid-template-columns: repeat(${metrics.length || 3}, 1fr);
        background: #F8FAFC;
        border-bottom: 1px solid #D7DEE8;
        padding: 5px 2px;
        text-align: center;
      ">
        ${metrics.map((m, idx) => `
          <div style="${idx < metrics.length - 1 ? 'border-right: 1px solid #D7DEE8;' : ''} padding: 0 3px;">
            <div style="font-size: 7.5px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.02em;">${m.label}</div>
            <div style="font-size: 12px; font-weight: 800; color: ${m.color || '#0F1B33'}; font-family: Inter, sans-serif; margin-top: 1px;">
              ${m.value}
            </div>
          </div>
        `).join("")}
      </div>

      <!-- Secondary Info Strip: Cameras & Forecast -->
      ${secondaryInfo.length > 0 ? `
        <div style="
          display: flex;
          justify-content: space-between;
          background: #FFFFFF;
          border-bottom: 1px solid #D7DEE8;
          padding: 4px 8px;
          font-size: 9.5px;
        ">
          ${secondaryInfo.map(s => `
            <div>
              <span style="color: #64748B; font-size: 8.5px; font-weight: 600;">${s.label}: </span>
              <strong style="color: ${s.color || '#0F1B33'};">${s.value}</strong>
            </div>
          `).join("")}
        </div>
      ` : ''}

      <!-- Incident Notice (if active) -->
      ${incident ? `
        <div style="
          background: #FEF2F2;
          border-bottom: 1px solid #FECACA;
          padding: 3px 8px;
          font-size: 9px;
          color: #DC2626;
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <span style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #DC2626; flex-shrink: 0;"></span>
          <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${incident.title || incident.reason || "Incident Reported"}</strong>
        </div>
      ` : ''}

      <!-- Footer Action Strip -->
      <div style="
        padding: 5px 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #FFFFFF;
      ">
        ${hasDetailsAction ? `
          <button class="popup-inspect-btn" style="
            border: 1px solid #D7DEE8;
            background: #0F1B33;
            color: #FFFFFF;
            font-size: 9px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 3px;
            cursor: pointer;
          ">
            Inspect Details
          </button>
        ` : `<span></span>`}

        ${hasCameraAction && cameraId ? `
          <button class="popup-camera-btn" data-cam-id="${cameraId}" style="
            border: 1px solid #D7DEE8;
            background: #F8FAFC;
            color: #0F1B33;
            font-size: 9px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 3px;
            cursor: pointer;
          ">
            View CCTV
          </button>
        ` : `
          <span style="font-size: 8.5px; color: #64748B; font-weight: 600;">Control Active</span>
        `}
      </div>
    </div>
  `;
}

export default function TrafficMap({
  routeResult = null,
  activeStrategy = "forecast",
  cameraTelemetry = null,
  selectedLocation = null,
  areaJunctions = [],
  selectedJunction = null,
  onSelectJunction,
  onSelectCamera = null,
  diversionData = null,
  center = [78.6569, 11.1271], // Neutral Tamil Nadu statewide default
  zoom = 7.5,
  isFullPage = false,
  fromLocation = null,
  toLocation = null,
  areaOverview = null,
  districtName = "Tamil Nadu",
  alerts = [],
  layers: propLayers = null,
  mapStyle: propMapStyle = null,
  onSetLayers = null,
  hideOverlayControls = false,
  isLiveTrafficPage = false,
  mapRef: externalMapRef = null,
  height = null,
}) {
  const mapContainerRef = useRef(null);
  const internalMapRef = useRef(null);
  const mapRef = externalMapRef || internalMapRef;
  const markersRef = useRef([]);
  const routeMarkersRef = useRef([]);
  const incidentMarkersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  let settingsContext = null;
  try {
    settingsContext = useSettings();
  } catch (e) {}

  const effectiveMapStyle = propMapStyle || settingsContext?.settings?.mapStyle || "standard";
  const globalLayers = settingsContext?.settings?.mapLayers;

  // Layer Visibility Controls (Directly responsive to user checkbox toggles)
  const [internalLayers, setInternalLayers] = useState(() => ({
    trafficLevel: true,
    junctions: propLayers?.junctions ?? true,
    cameras: propLayers?.cameras ?? true,
    incidents: propLayers?.incidents ?? true,
    routes: propLayers?.routes ?? true,
    congestion: true,
  }));

  const layers = propLayers || internalLayers;

  const handleToggleLayer = (layerKey, checked) => {
    const updated = {
      ...layers,
      [layerKey]: checked,
    };
    if (onSetLayers) {
      onSetLayers(updated);
    }
    setInternalLayers(updated);
  };

  const setLayers = onSetLayers || setInternalLayers;
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // 1. Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialTiles = MAP_RASTER_STYLES[effectiveMapStyle] || MAP_RASTER_STYLES.standard;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        ...OSM_RASTER_STYLE,
        sources: {
          "osm-tiles": {
            type: "raster",
            tiles: initialTiles,
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
          },
        },
      },
      center: center,
      zoom: zoom,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    map.on("load", () => {
      // 1. Alternative Route (Dashed Green) - added first so Recommended route renders on top
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
            "line-width": 8,
            "line-opacity": 0.9,
          },
        });
        map.addLayer({
          id: "route-alt-layer",
          type: "line",
          source: "route-alt",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#16a34a", // Alternative route = dashed green
            "line-width": 5,
            "line-dasharray": [2, 2],
            "line-opacity": 0.95,
          },
        });
      }

      // 2. Primary / Recommended Route Line (Solid Blue)
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
            "line-width": 9.5,
            "line-opacity": 0.95,
          },
        });
        map.addLayer({
          id: "route-line-layer",
          type: "line",
          source: "route-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#2563eb", // Recommended route = solid blue
            "line-width": 6,
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
            "line-color": "#dc2626", // Congested road = red
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
      incidentMarkersRef.current.forEach((m) => m.remove());
      incidentMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  // 1b. Dynamic raster tile update when effectiveMapStyle changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    try {
      const src = map.getSource("osm-tiles");
      const tiles = MAP_RASTER_STYLES[effectiveMapStyle] || MAP_RASTER_STYLES.standard;
      if (src && typeof src.setTiles === "function") {
        src.setTiles(tiles);
      }
    } catch (err) {
      console.warn("Could not update map tiles:", err);
    }
  }, [effectiveMapStyle, mapLoaded]);

  // 2. Center & Zoom to Selected Junction, Location, or District
  const prevCenterRef = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (routeResult) return;

    let targetLon = null;
    let targetLat = null;
    let targetZoom = 13;

    if (selectedJunction && selectedJunction.coords && selectedJunction.coords.length >= 2) {
      targetLon = selectedJunction.coords[0];
      targetLat = selectedJunction.coords[1];
      targetZoom = 14.5;
    } else if (selectedLocation) {
      targetLon = selectedLocation.lon || (selectedLocation.coords && selectedLocation.coords[0]);
      targetLat = selectedLocation.lat || (selectedLocation.coords && selectedLocation.coords[1]);
      targetZoom = selectedLocation.zoom ?? (
        selectedLocation.searchCategory === "junction" || selectedLocation.searchCategory === "camera"
          ? 14.5
          : selectedLocation.searchCategory === "road"
          ? 12
          : selectedLocation.isGpsLocation
          ? 13
          : 12
      );
    }

    if (targetLon != null && targetLat != null) {
      const centerKey = `${targetLon.toFixed(4)},${targetLat.toFixed(4)},${targetZoom}`;
      if (prevCenterRef.current === centerKey) return;
      prevCenterRef.current = centerKey;

      map.flyTo({
        center: [targetLon, targetLat],
        zoom: targetZoom,
        essential: true,
        duration: 800,
      });
    }
  }, [selectedJunction, selectedLocation, mapLoaded, routeResult]);

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

        const vCount = jnc.metrics?.vehicleCount ?? (cameraTelemetry?.vehicle_count ?? "--");
        const spd = jnc.metrics?.averageSpeedKmh != null ? `${jnc.metrics.averageSpeedKmh} km/h` : "--";
        const occ = jnc.metrics?.roadOccupancyPct != null ? `${jnc.metrics.roadOccupancyPct}%` : "--";
        const onlineCams = (jnc.cameras || []).filter((c) => c.status === "ONLINE").length;
        const totalCams = (jnc.cameras || []).length;
        const forecastText = jnc.prediction?.next15Min || (jnc.congestionScore >= 0.81 ? "CRITICAL" : jnc.congestionScore >= 0.61 ? "HIGH" : "Moderate");
        const firstCamId = jnc.cameras?.[0]?.id || null;
        const isCritical = jnc.congestionScore >= 0.81;
        const isHigh = jnc.congestionScore >= 0.61 && !isCritical;
        const statusText = jnc.status || (isCritical ? "CRITICAL" : isHigh ? "HIGH" : "NORMAL");

        // SVG Pin Element with Integrated Hover Tooltip
        const pinEl = document.createElement("div");
        pinEl.className = "map-junction-marker-wrapper";
        pinEl.style.cursor = "pointer";
        pinEl.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="
              width: ${isSelected ? '15px' : '12px'};
              height: ${isSelected ? '15px' : '12px'};
              border-radius: 50%;
              background: ${risk.color};
              border: ${isSelected ? '2.5px solid #0F172A' : '2px solid #FFFFFF'};
              box-shadow: ${isSelected ? '0 0 0 3px rgba(15, 23, 42, 0.25), 0 2px 6px rgba(0,0,0,0.35)' : '0 1px 3px rgba(0,0,0,0.3)'};
              transition: all 0.15s ease;
            "></div>
            ${isSelected ? `
              <div style="
                margin-top: 3px;
                font-size: 9px;
                font-weight: 800;
                color: #0F1B33;
                background: #FFFFFF;
                border: 1px solid #CBD5E1;
                padding: 1px 5px;
                border-radius: 3px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                white-space: nowrap;
                letter-spacing: 0.02em;
              ">
                ${jnc.name}
              </div>
            ` : ''}
          </div>

          <div class="map-junction-hover-tooltip">
            <div style="font-weight: 800; font-size: 10px; color: #f8fafc; margin-bottom: 3px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span>${jnc.name}</span>
              <span style="font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 2px; background: ${risk.color}; color: #ffffff; text-transform: uppercase;">
                ${statusText}
              </span>
            </div>
            <div style="font-size: 9.5px; color: #cbd5e1; font-family: monospace; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
              <span>Vehicles: <strong style="color: #ffffff;">${vCount}</strong></span>
              <span style="color: #64748b;">•</span>
              <span>Speed: <strong style="color: #38bdf8;">${spd}</strong></span>
              <span style="color: #64748b;">•</span>
              <span>Occ: <strong style="color: ${jnc.metrics?.roadOccupancyPct > 60 ? '#f87171' : '#4ade80'};">${occ}</strong></span>
            </div>
          </div>
        `;

        const jncPopupHtml = renderSmallOverviewHtml({
          title: jnc.name,
          subTitle: `${jnc.district || districtName || "TAMIL NADU"} • JUNCTION OVERVIEW`,
          status: jnc.status || (jnc.congestionScore >= 0.81 ? "CRITICAL" : jnc.congestionScore >= 0.61 ? "HIGH" : jnc.congestionScore >= 0.31 ? "MODERATE" : "NORMAL"),
          congestionScore: jnc.congestionScore || 0.2,
          metrics: [
            { label: "Vehicles", value: vCount },
            { label: "Avg Speed", value: spd, color: jnc.metrics?.averageSpeedKmh < 25 ? "#dc2626" : "#0f172a" },
            { label: "Occupancy", value: occ, color: jnc.metrics?.roadOccupancyPct > 60 ? "#dc2626" : "#0f172a" },
          ],
          secondaryInfo: [
            { label: "Cameras", value: `${onlineCams}/${totalCams} Online`, color: onlineCams > 0 ? "#16a34a" : "#64748b" },
            { label: "Forecast", value: forecastText, color: forecastText === "CRITICAL" ? "#dc2626" : forecastText === "HIGH" ? "#ea580c" : "#16a34a" },
          ],
          incident: jnc.incident,
          hasDetailsAction: true,
          hasCameraAction: Boolean(firstCamId),
          cameraId: firstCamId,
        });

        const jncPopup = new maplibregl.Popup({
          offset: 14,
          closeButton: true,
          closeOnClick: false,
          maxWidth: "290px",
          className: "officer-map-popup",
        }).setHTML(jncPopupHtml);

        // Direct hover handlers for instant officer preview
        pinEl.addEventListener("mouseenter", () => {
          const tt = pinEl.querySelector(".map-junction-hover-tooltip");
          if (tt) tt.style.display = "flex";
          pinEl.style.zIndex = "99999";
        });
        pinEl.addEventListener("mouseleave", () => {
          const tt = pinEl.querySelector(".map-junction-hover-tooltip");
          if (tt) tt.style.display = "none";
          pinEl.style.zIndex = isSelected ? "10" : "5";
        });

        const marker = new maplibregl.Marker({ element: pinEl, anchor: "bottom" })
          .setLngLat([jLon, jLat])
          .setPopup(jncPopup)
          .addTo(map);

        pinEl.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!isLiveTrafficPage) {
            if (jncPopup.isOpen()) {
              jncPopup.remove();
            } else {
              jncPopup.addTo(map);
            }
          }
          if (onSelectJunction) onSelectJunction(jnc);
        });

        jncPopup.on("open", () => {
          pinEl.classList.add("has-popup-open");
          const popupEl = jncPopup.getElement();
          if (!popupEl) return;
          const inspectBtn = popupEl.querySelector(".popup-inspect-btn");
          if (inspectBtn && onSelectJunction) {
            inspectBtn.addEventListener("click", () => onSelectJunction(jnc));
          }
          const camBtn = popupEl.querySelector(".popup-camera-btn");
          if (camBtn && onSelectCamera && firstCamId) {
            camBtn.addEventListener("click", () => onSelectCamera(firstCamId));
          }
        });

        jncPopup.on("close", () => {
          pinEl.classList.remove("has-popup-open");
        });

        markersRef.current.push(marker);
      });
    }

    // 3b. Render Configured Real Cameras matching active context
    if (layers.cameras) {
      const cameraList = [];
      if (selectedJunction && selectedJunction.cameras && selectedJunction.cameras.length > 0) {
        selectedJunction.cameras.forEach((c, idx) => {
          cameraList.push({
            ...c,
            location: selectedJunction.name,
            coords: [
              selectedJunction.coords[0] + (idx === 0 ? 0.0012 : -0.0012 * idx),
              selectedJunction.coords[1] + (idx === 0 ? 0.0010 : -0.0010 * idx),
            ],
          });
        });
      } else if (areaJunctions && areaJunctions.length > 0) {
        areaJunctions.forEach((j) => {
          (j.cameras || []).forEach((c, idx) => {
            if (j.coords && j.coords.length >= 2) {
              cameraList.push({
                ...c,
                location: j.name,
                coords: [
                  j.coords[0] + (idx === 0 ? 0.0012 : -0.0012 * idx),
                  j.coords[1] + (idx === 0 ? 0.0010 : -0.0010 * idx),
                ],
              });
            }
          });
        });
      }

      // If no cameras in current area, fall back to highway feeds
      if (cameraList.length === 0) {
        cameraList.push({
          id: "CCTV-SKG-01",
          name: "CCTV-SKG-01",
          approach: "Sankagiri Inflow",
          location: "NH544 Corridor",
          status: "ONLINE",
          coords: [77.870, 11.480],
        });
      }

      cameraList.forEach((cam) => {
        if (!cam.coords || cam.coords.length < 2) return;
        const [cLon, cLat] = cam.coords;
        const isOnline = cam.status === "ONLINE";

        const camEl = document.createElement("div");
        camEl.className = isOnline ? "radar-ping-marker" : "";
        camEl.style.width = "20px";
        camEl.style.height = "20px";
        camEl.style.borderRadius = "50%";
        camEl.style.background = isOnline ? "#0F1B33" : "#64748B";
        camEl.style.border = isOnline ? "2px solid #2563EB" : "2px solid #94A3B8";
        camEl.style.boxShadow = "0 2px 6px rgba(15,27,51,0.35)";
        camEl.style.display = "flex";
        camEl.style.alignItems = "center";
        camEl.style.justifyContent = "center";
        camEl.style.cursor = "pointer";
        camEl.style.zIndex = "8";
        camEl.title = `Camera: ${cam.id} (${cam.approach || cam.location || cam.name})`;
        camEl.innerHTML = `
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
            <circle cx="12" cy="13" r="3"/>
          </svg>
        `;

        const camPopupHtml = `
          <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 2px; min-width: 140px;">
            <strong style="color: #0f172a; font-size: 12px;">${cam.id}</strong><br/>
            <span style="color: #64748b;">${cam.approach || cam.location || "Traffic Approach"}</span>
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 10px;">
              <div>Status: <strong style="color: ${isOnline ? '#16a34a' : '#dc2626'};">${cam.status}</strong></div>
            </div>
            <div style="margin-top: 5px; text-align: right;">
              <span style="font-size: 9px; color: #2563eb; font-weight: 700;">Click to view feed</span>
            </div>
          </div>
        `;

        const camMarker = new maplibregl.Marker({ element: camEl })
          .setLngLat([cLon, cLat])
          .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(camPopupHtml))
          .addTo(map);

        camEl.addEventListener("click", () => {
          if (onSelectCamera) onSelectCamera(cam.id);
        });

        markersRef.current.push(camMarker);
      });
    }

    // 3c. Current Location GPS Marker or Active Searched Location Pin
    const isGps = selectedLocation?.isGpsLocation || selectedLocation?.name === "Current Location";
    const isSearchedLocation = selectedLocation && selectedLocation.name && selectedLocation.name.toLowerCase() !== "tamil nadu";

    // Only render separate pin if this location isn't already covered by an area junction (GPS marker is always rendered)
    const alreadyRenderedAsJnc = !isGps && areaJunctions && areaJunctions.some(
      (j) => j.name.toLowerCase() === (selectedLocation?.name || "").toLowerCase()
    );

    if (selectedLocation && (isGps || isSearchedLocation) && !alreadyRenderedAsJnc) {
      const curLon = selectedLocation.lon ?? selectedLocation.coords?.[0];
      const curLat = selectedLocation.lat ?? selectedLocation.coords?.[1];

      if (curLon != null && curLat != null) {
        const qName = (selectedLocation.name || "").toLowerCase();
        const matchedJnc = selectedJunction ||
          (areaJunctions && areaJunctions.find((j) => qName.includes(j.name.toLowerCase()) || j.name.toLowerCase().includes(qName))) ||
          trafficService.allJunctions.find((j) => qName.includes(j.name.toLowerCase()) || j.name.toLowerCase().includes(qName)) ||
          null;

        const distData = trafficService.getDistrict(selectedLocation.district || selectedLocation.name);
        const overview = distData?.overview || areaOverview || null;

        let popupHtml = "";
        let camId = null;

        if (matchedJnc) {
          const vCount = matchedJnc.metrics?.vehicleCount ?? (cameraTelemetry?.vehicle_count ?? "--");
          const spd = matchedJnc.metrics?.averageSpeedKmh != null ? `${matchedJnc.metrics.averageSpeedKmh} km/h` : "--";
          const occ = matchedJnc.metrics?.roadOccupancyPct != null ? `${matchedJnc.metrics.roadOccupancyPct}%` : "--";
          const onlineCams = (matchedJnc.cameras || []).filter((c) => c.status === "ONLINE").length;
          const totalCams = (matchedJnc.cameras || []).length;
          const forecastText = matchedJnc.prediction?.next15Min || (matchedJnc.congestionScore >= 0.81 ? "CRITICAL" : matchedJnc.congestionScore >= 0.61 ? "HIGH" : "Moderate");
          camId = matchedJnc.cameras?.[0]?.id || null;

          popupHtml = renderSmallOverviewHtml({
            title: matchedJnc.name,
            subTitle: `${matchedJnc.district || districtName || "TAMIL NADU"} • JUNCTION OVERVIEW`,
            status: matchedJnc.status || (matchedJnc.congestionScore >= 0.81 ? "CRITICAL" : matchedJnc.congestionScore >= 0.61 ? "HIGH" : matchedJnc.congestionScore >= 0.31 ? "MODERATE" : "NORMAL"),
            congestionScore: matchedJnc.congestionScore || 0.2,
            metrics: [
              { label: "Vehicles", value: vCount },
              { label: "Avg Speed", value: spd, color: matchedJnc.metrics?.averageSpeedKmh < 25 ? "#dc2626" : "#0f172a" },
              { label: "Occupancy", value: occ, color: matchedJnc.metrics?.roadOccupancyPct > 60 ? "#dc2626" : "#0f172a" },
            ],
            secondaryInfo: [
              { label: "Cameras", value: `${onlineCams}/${totalCams} Online`, color: onlineCams > 0 ? "#16a34a" : "#64748b" },
              { label: "Forecast", value: forecastText, color: forecastText === "CRITICAL" ? "#dc2626" : forecastText === "HIGH" ? "#ea580c" : "#16a34a" },
            ],
            incident: matchedJnc.incident,
            hasDetailsAction: true,
            hasCameraAction: Boolean(camId),
            cameraId: camId,
          });
        } else if (overview) {
          popupHtml = renderSmallOverviewHtml({
            title: selectedLocation.name,
            subTitle: `${selectedLocation.district || districtName || "TAMIL NADU"} • AREA OVERVIEW`,
            status: overview.highRiskJunctionsCount > 1 ? "ELEVATED" : "MODERATE",
            congestionScore: overview.highRiskJunctionsCount > 1 ? 0.65 : 0.35,
            metrics: [
              { label: "Junctions", value: overview.majorJunctionsCount ?? areaJunctions.length },
              { label: "Critical/High", value: overview.highRiskJunctionsCount ?? 0, color: overview.highRiskJunctionsCount > 0 ? "#dc2626" : "#0f172a" },
              { label: "Incidents", value: overview.activeIncidentsCount ?? 0, color: overview.activeIncidentsCount > 0 ? "#ea580c" : "#0f172a" },
            ],
            secondaryInfo: [
              { label: "Cameras", value: `${overview.availableCamerasCount || 0} Online`, color: "#16a34a" },
              { label: "Forecast", value: overview.predictedCongestion || "Moderate", color: "#2563eb" },
            ],
            incident: null,
            hasDetailsAction: false,
            hasCameraAction: false,
          });
        } else {
          popupHtml = renderSmallOverviewHtml({
            title: selectedLocation.name,
            subTitle: isGps ? "CURRENT LOCATION • GPS POSITION" : "SEARCHED LOCATION",
            status: isGps ? "GPS ACTIVE" : "MONITORED",
            congestionScore: 0.2,
            metrics: [
              { label: "Latitude", value: curLat.toFixed(4) },
              { label: "Longitude", value: curLon.toFixed(4) },
              { label: "Status", value: isGps ? "Live GPS" : "Active Pin", color: "#2563eb" },
            ],
            secondaryInfo: [
              { label: "Coverage", value: "Tamil Nadu Control", color: "#16a34a" },
            ],
            hasDetailsAction: false,
            hasCameraAction: false,
          });
        }

        const pinEl = document.createElement("div");
        pinEl.className = isGps ? "" : "map-junction-marker-wrapper";
        pinEl.style.cursor = "pointer";

        if (isGps) {
          const locShort = (selectedLocation.name || "Current Location").split(",")[0].trim();
          const vCount = matchedJnc?.metrics?.vehicleCount ?? (cameraTelemetry?.vehicle_count ?? "--");
          const spd = matchedJnc?.metrics?.averageSpeedKmh != null ? `${matchedJnc.metrics.averageSpeedKmh} km/h` : "--";
          const occ = matchedJnc?.metrics?.roadOccupancyPct != null ? `${matchedJnc.metrics.roadOccupancyPct}%` : "--";

          pinEl.className = "map-junction-marker-wrapper";
          pinEl.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
              <div style="position: relative; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;">
                <div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background: rgba(123, 139, 200, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background: #7B8BC8; border: 2px solid #3E4776; box-shadow: 0 1px 4px rgba(0,0,0,0.5);"></div>
              </div>
            </div>

            <div class="map-junction-hover-tooltip">
              <div style="font-weight: 800; font-size: 10px; color: #f8fafc; margin-bottom: 3px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span>CURRENT LOCATION · ${locShort.toUpperCase()}</span>
                <span style="font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 2px; background: #3E4776; color: #7B8BC8;">
                  LIVE GPS
                </span>
              </div>
              <div style="font-size: 9.5px; color: #cbd5e1; font-family: monospace; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                <span>Vehicles: <strong style="color: #ffffff;">${vCount}</strong></span>
                <span style="color: #64748b;">•</span>
                <span>Speed: <strong style="color: #7B8BC8;">${spd}</strong></span>
                <span style="color: #64748b;">•</span>
                <span>Occ: <strong style="color: #F45E70;">${occ}</strong></span>
              </div>
            </div>
          `;
        } else {
          const vCount = matchedJnc?.metrics?.vehicleCount ?? (cameraTelemetry?.vehicle_count ?? "--");
          const spd = matchedJnc?.metrics?.averageSpeedKmh != null ? `${matchedJnc.metrics.averageSpeedKmh} km/h` : "--";
          const occ = matchedJnc?.metrics?.roadOccupancyPct != null ? `${matchedJnc.metrics.roadOccupancyPct}%` : "--";
          const statusText = matchedJnc ? (matchedJnc.status || (matchedJnc.congestionScore >= 0.81 ? "CRITICAL" : "HIGH")) : "MONITORED";

          pinEl.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
              <div style="
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: #2563EB;
                border: 2px solid #FFFFFF;
                box-shadow: 0 0 0 2px #0F172A, 0 1px 4px rgba(0,0,0,0.3);
              "></div>
              <div style="
                margin-top: 3px;
                font-size: 9px;
                font-weight: 800;
                color: #0F1B33;
                background: #FFFFFF;
                border: 1px solid #CBD5E1;
                padding: 1px 5px;
                border-radius: 3px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                white-space: nowrap;
                letter-spacing: 0.02em;
              ">
                ${selectedLocation.name}
              </div>
            </div>

            <div class="map-junction-hover-tooltip">
              <div style="font-weight: 800; font-size: 10px; color: #f8fafc; margin-bottom: 3px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span>${selectedLocation.name}</span>
                <span style="font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 2px; background: #2563eb; color: #ffffff;">
                  ${statusText}
                </span>
              </div>
              <div style="font-size: 9.5px; color: #cbd5e1; font-family: monospace; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                <span>Vehicles: <strong style="color: #ffffff;">${vCount}</strong></span>
                <span style="color: #64748b;">•</span>
                <span>Speed: <strong style="color: #38bdf8;">${spd}</strong></span>
                <span style="color: #64748b;">•</span>
                <span>Occ: <strong style="color: #f87171;">${occ}</strong></span>
              </div>
            </div>
          `;
        }

        const curPopup = new maplibregl.Popup({
          offset: 14,
          closeButton: true,
          closeOnClick: false,
          maxWidth: "290px",
          className: "officer-map-popup",
        }).setHTML(popupHtml);

        const curMarker = new maplibregl.Marker({ element: pinEl, anchor: "bottom" })
          .setLngLat([curLon, curLat])
          .setPopup(curPopup)
          .addTo(map);

        pinEl.addEventListener("click", (e) => {
          e.stopPropagation();
          if (curPopup.isOpen()) {
            curPopup.remove();
          } else {
            curPopup.addTo(map);
          }
          if (matchedJnc && onSelectJunction) {
            onSelectJunction(matchedJnc);
          }
        });

        curPopup.on("open", () => {
          pinEl.classList.add("has-popup-open");
          const popupEl = curPopup.getElement();
          if (!popupEl) return;
          const inspectBtn = popupEl.querySelector(".popup-inspect-btn");
          if (inspectBtn && matchedJnc && onSelectJunction) {
            inspectBtn.addEventListener("click", () => onSelectJunction(matchedJnc));
          }
          const camBtn = popupEl.querySelector(".popup-camera-btn");
          if (camBtn && onSelectCamera && camId) {
            camBtn.addEventListener("click", () => onSelectCamera(camId));
          }
        });

        curPopup.on("close", () => {
          pinEl.classList.remove("has-popup-open");
        });

        pinEl.addEventListener("mouseenter", () => {
          const tt = pinEl.querySelector(".map-junction-hover-tooltip");
          if (tt) tt.style.display = "flex";
          pinEl.style.zIndex = "99999";
        });
        pinEl.addEventListener("mouseleave", () => {
          const tt = pinEl.querySelector(".map-junction-hover-tooltip");
          if (tt) tt.style.display = "none";
          pinEl.style.zIndex = "10";
        });

        markersRef.current.push(curMarker);
      }
    }

    // 3c-2. Render Operational Incident Markers
    if (incidentMarkersRef.current) {
      incidentMarkersRef.current.forEach((m) => m.remove());
      incidentMarkersRef.current = [];
    }

    if (layers.incidents && alerts && alerts.length > 0) {
      alerts.forEach((alt) => {
        if (alt.status === "RESOLVED" || alt.status === "INCIDENT RESOLVED") return;
        const altLoc = (alt.location || "").toLowerCase();
        const altCam = (alt.camera_id || "").toLowerCase();

        let coords = null;
        let matchedJnc = null;

        if (areaJunctions && areaJunctions.length > 0) {
          matchedJnc = areaJunctions.find(
            (j) =>
              altLoc.includes(j.name.toLowerCase()) ||
              j.name.toLowerCase().includes(altLoc) ||
              (j.cameras || []).some((c) => c.id.toLowerCase() === altCam)
          );
          if (matchedJnc?.coords) coords = matchedJnc.coords;
        }

        if (!coords) {
          const globalJnc = trafficService.allJunctions.find(
            (j) =>
              altLoc.includes(j.name.toLowerCase()) ||
              j.name.toLowerCase().includes(altLoc) ||
              (j.cameras || []).some((c) => c.id.toLowerCase() === altCam)
          );
          if (globalJnc?.coords) {
            coords = globalJnc.coords;
            matchedJnc = globalJnc;
          }
        }

        if (!coords && altCam.includes("skg")) coords = [77.870, 11.480];
        if (!coords && altCam.includes("slm")) coords = [78.146, 11.664];
        if (!coords && altCam.includes("erd")) coords = [77.717, 11.341];

        if (coords) {
          const isCrit = (alt.severity || "").toUpperCase() === "CRITICAL";
          const altBadge = document.createElement("div");
          altBadge.style.display = "flex";
          altBadge.style.alignItems = "center";
          altBadge.style.justifyContent = "center";
          altBadge.style.width = "18px";
          altBadge.style.height = "18px";
          altBadge.style.borderRadius = "2px";
          altBadge.style.background = isCrit ? "#dc2626" : "#ea580c";
          altBadge.style.color = "#ffffff";
          altBadge.style.fontSize = "11px";
          altBadge.style.fontWeight = "900";
          altBadge.style.border = "1.5px solid #ffffff";
          altBadge.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";
          altBadge.style.cursor = "pointer";
          altBadge.title = `Incident: ${alt.reason || alt.location}`;
          altBadge.innerText = "!";

          altBadge.addEventListener("click", (e) => {
            e.stopPropagation();
            if (matchedJnc && onSelectJunction) {
              onSelectJunction(matchedJnc);
            }
          });

          const incMarker = new maplibregl.Marker({ element: altBadge, anchor: "center" })
            .setLngLat([coords[0] + 0.0018, coords[1] + 0.0012])
            .addTo(map);

          incidentMarkersRef.current.push(incMarker);
        }
      });
    }

    // 3d. Turn-by-Turn Route Planning & Junction Diversions
    if (layers.routes && routeResult) {
      // Standard Corridor Turn-by-Turn Routes (from Routing Engine / OSRM)
      const rec = routeResult.recommended || routeResult.forecast || routeResult.distance;
      const recData = rec;
      const alt = routeResult.alternative || (routeResult.congestion && routeResult.congestion.found ? routeResult.congestion : null);
      const cng = routeResult.congested;
      const shortest = routeResult.shortest || routeResult.distance;

      const recCoords = (rec?.waypoints || []).map(toLngLat).filter(Boolean);
      const altCoords = (alt?.waypoints || []).map(toLngLat).filter(Boolean);
      const cngCoords = (cng?.waypoints || []).map(toLngLat).filter(Boolean);
      const shortestCoords = (shortest?.waypoints || []).map(toLngLat).filter(Boolean);

      const allCoords = [];
      const selStrat = activeStrategy || routeResult.recommendation || "recommended";
      const isAltSelected = selStrat === "alternative" || selStrat === "congestion";
      const isCngSelected = selStrat === "congested";

      // Route visual mapping:
      // Active route: Solid Blue (#2563eb on route-line)
      // Alternative route: Dashed Green (#16a34a on route-alt)
      // Congested segment: Red (#dc2626 on route-congested)
      let blueCoords = recCoords;
      let greenCoords = altCoords;
      let redCoords = cngCoords;

      if (isAltSelected && altCoords.length > 0) {
        blueCoords = altCoords;
        greenCoords = recCoords;
        redCoords = cngCoords;
      } else if (isCngSelected && cngCoords.length > 0) {
        blueCoords = cngCoords;
        greenCoords = recCoords;
        redCoords = [];
      } else {
        blueCoords = recCoords;
        greenCoords = altCoords;
        redCoords = cngCoords;
      }

      // 1. Render Active Route in Blue
      if (blueCoords.length > 0 && map.getSource("route-line")) {
        map.getSource("route-line").setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { strategy: selStrat, role: "highlighted" },
              geometry: { type: "LineString", coordinates: blueCoords },
            },
          ],
        });
        allCoords.push(...blueCoords);
      } else if (map.getSource("route-line")) {
        map.getSource("route-line").setData({ type: "FeatureCollection", features: [] });
      }

      // 2. Render Secondary Alternative Route in Green
      if (greenCoords.length > 0 && map.getSource("route-alt")) {
        map.getSource("route-alt").setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { role: "alternative" },
              geometry: { type: "LineString", coordinates: greenCoords },
            },
          ],
        });
        allCoords.push(...greenCoords);
      } else if (map.getSource("route-alt")) {
        map.getSource("route-alt").setData({ type: "FeatureCollection", features: [] });
      }

      // 3. Render Congested Route / Segment in Red
      if (redCoords.length > 0 && map.getSource("route-congested")) {
        map.getSource("route-congested").setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { role: "congested" },
              geometry: { type: "LineString", coordinates: redCoords },
            },
          ],
        });
        allCoords.push(...redCoords);
      } else if (map.getSource("route-congested")) {
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
        startEl.style.zIndex = "50";
        startEl.innerHTML = `
          <div style="
            background: #1a73e8;
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
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #ffffff;"></span>
            <span>FROM: ${originName}</span>
          </div>
        `;

        const startPopupHtml = `
          <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 2px;">
            <div style="color: #1a73e8; font-weight: 800; font-size: 9px; text-transform: uppercase;">Origin (From)</div>
            <strong style="color: #0f172a; font-size: 12px;">${originName}</strong>
          </div>
        `;

        const startMarker = new maplibregl.Marker({ element: startEl, anchor: "bottom" })
          .setLngLat(originLngLat)
          .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(startPopupHtml))
          .addTo(map);

        routeMarkersRef.current.push(startMarker);
        allCoords.push(originLngLat);
      }

      if (destLngLat) {
        const destEl = document.createElement("div");
        destEl.style.cursor = "pointer";
        destEl.style.zIndex = "50";
        destEl.innerHTML = `
          <div style="
            background: #d93025;
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
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #ffffff;"></span>
            <span>TO: ${destName}</span>
          </div>
        `;

        const recDistanceKm = recData?.distance_km ?? (recData?.metrics?.total_distance_m != null
          ? (recData.metrics.total_distance_m / 1000).toFixed(1) + " km"
          : "--");
        const recEtaMin = recData?.time_min ?? (recData?.metrics?.total_time_min != null
          ? recData.metrics.total_time_min.toFixed(0) + " min"
          : "--");

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
        allCoords.push(destLngLat);
      }

      // Auto-fit map bounds so both routes and endpoints are fully framed in view
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
            padding: { top: 70, bottom: 70, left: 70, right: 70 },
            maxZoom: 13,
            duration: 900,
          });
        }
      }
    } else if (layers.routes && diversionData) {
      const allCoords = [];

      // 1. Recommended Bypass Route (Blue)
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
      } else if (map.getSource("route-line")) {
        map.getSource("route-line").setData({ type: "FeatureCollection", features: [] });
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
      } else if (map.getSource("route-alt")) {
        map.getSource("route-alt").setData({ type: "FeatureCollection", features: [] });
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
      } else if (map.getSource("route-congested")) {
        map.getSource("route-congested").setData({ type: "FeatureCollection", features: [] });
      }

      // Place Diversion markers
      if (diversionData.recommendedCoordinates && diversionData.recommendedCoordinates.length > 0) {
        const startCoord = diversionData.recommendedCoordinates[0];
        const divEl = document.createElement("div");
        divEl.style.cursor = "pointer";
        divEl.style.zIndex = "50";
        divEl.innerHTML = `
          <div style="
            background: #2563eb;
            color: #ffffff;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 800;
            border: 2px solid #ffffff;
            box-shadow: 0 3px 8px rgba(0,0,0,0.35);
            white-space: nowrap;
            font-family: Inter, sans-serif;
          ">
            <span>DIVERSION: ${diversionData.recommendedName || "Flyover Bypass"}</span>
          </div>
        `;
        const divMarker = new maplibregl.Marker({ element: divEl, anchor: "bottom" })
          .setLngLat(startCoord)
          .addTo(map);
        routeMarkersRef.current.push(divMarker);
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
          map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 80, maxZoom: 15, duration: 800 });
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
  }, [mapLoaded, areaJunctions, selectedJunction, selectedLocation, cameraTelemetry, routeResult, activeStrategy, diversionData, layers, fromLocation, toLocation, areaOverview, districtName]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: isFullPage ? "100%" : (height || "540px"),
        borderRadius: "var(--radius-xs)",
        overflow: "hidden",
        border: "1px solid var(--border-default, #3D3F4E)",
        background: "var(--bg-app, #111315)",
      }}
    >
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Layer Control Toggle Button and Legend (hidden when parent provides dedicated controls) */}
      {!hideOverlayControls && (
        <>
          <div style={{ position: "absolute", top: "10px", left: "10px", zIndex: 10 }}>
            <button
              onClick={() => setShowLayerMenu(!showLayerMenu)}
              style={{
                background: "var(--bg-surface, #1B2028)",
                border: "1px solid var(--border-default, #3D3F4E)",
                borderRadius: "4px",
                padding: "5px 9px",
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--text-primary, #F4F5F7)",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.4)",
              }}
            >
              <Layers size={13} color="var(--accent-soft-blue, #7B8BC8)" />
              <span>Map Layers</span>
            </button>

            {showLayerMenu && (
              <div
                style={{
                  marginTop: "4px",
                  background: "var(--bg-surface, #1B2028)",
                  border: "1px solid var(--border-default, #3D3F4E)",
                  borderRadius: "4px",
                  padding: "8px 10px",
                  boxShadow: "0 6px 16px rgba(0, 0, 0, 0.5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "12px",
                  width: "145px",
                  zIndex: 20,
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "7px", cursor: "pointer", color: "var(--text-primary, #F4F5F7)", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={!!layers.junctions}
                    onChange={(e) => handleToggleLayer("junctions", e.target.checked)}
                    style={{ accentColor: "var(--accent-soft-blue, #7B8BC8)", cursor: "pointer" }}
                  />
                  <span>Junctions</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "7px", cursor: "pointer", color: "var(--text-primary, #F4F5F7)", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={!!layers.cameras}
                    onChange={(e) => handleToggleLayer("cameras", e.target.checked)}
                    style={{ accentColor: "var(--accent-soft-blue, #7B8BC8)", cursor: "pointer" }}
                  />
                  <span>Cameras</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "7px", cursor: "pointer", color: "var(--text-primary, #F4F5F7)", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={!!layers.routes}
                    onChange={(e) => handleToggleLayer("routes", e.target.checked)}
                    style={{ accentColor: "var(--accent-soft-blue, #7B8BC8)", cursor: "pointer" }}
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
              background: "var(--bg-surface, #1B2028)",
              border: "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "4px",
              padding: "6px 10px",
              fontSize: "10px",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.45)",
            }}
          >
            <div style={{ fontWeight: 800, color: "var(--text-muted, #737987)", textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.03em" }}>
              Junction Status
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
              <span style={{ color: "var(--text-secondary, #A7ACB8)" }}>Normal</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#C2BB91" }} />
              <span style={{ color: "var(--text-secondary, #A7ACB8)" }}>Moderate</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }} />
              <span style={{ color: "var(--text-secondary, #A7ACB8)" }}>High</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#F45E70" }} />
              <span style={{ color: "var(--text-secondary, #A7ACB8)" }}>Critical</span>
            </div>
            {(routeResult || diversionData) && (
              <div style={{ borderTop: "1px solid var(--border-light, #2C303C)", paddingTop: "4px", marginTop: "3px", display: "flex", flexDirection: "column", gap: "3px" }}>
                <div style={{ fontWeight: 800, color: "var(--text-muted, #737987)", textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.03em" }}>
                  Routes
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ display: "inline-block", width: 14, height: 4, borderRadius: 2, background: "#7B8BC8" }} />
                  <span style={{ color: "var(--text-secondary, #A7ACB8)" }}>Recommended</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ display: "inline-block", width: 14, height: 3, borderRadius: 2, background: "#22C55E" }} />
                  <span style={{ color: "var(--text-secondary, #A7ACB8)" }}>Alternative</span>
                </div>
                {diversionData && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ display: "inline-block", width: 14, height: 3, borderRadius: 2, background: "#F45E70" }} />
                    <span style={{ color: "var(--text-secondary, #A7ACB8)" }}>Congested</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
