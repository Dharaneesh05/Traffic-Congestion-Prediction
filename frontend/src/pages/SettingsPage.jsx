import React, { useState, useEffect, useRef } from "react";
import { useSettings } from "../context/SettingsContext";
import { RotateCcw } from "lucide-react";

/**
 * Clean Flat Toggle Switch with clear ON / OFF status indicator
 */
function ToggleSwitch({ checked, onChange, id }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: 700,
          color: checked ? "#22C55E" : "#94A3B8",
          fontFamily: "var(--font-mono, monospace)",
          minWidth: "26px",
          textAlign: "right",
          letterSpacing: "0.04em",
        }}
      >
        {checked ? "ON" : "OFF"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        id={id}
        onClick={() => onChange(!checked)}
        style={{
          width: "36px",
          height: "20px",
          borderRadius: "10px",
          background: checked ? "#22C55E" : "#252936",
          border: checked ? "1px solid #22C55E" : "1px solid #3D3F4E",
          cursor: "pointer",
          position: "relative",
          transition: "all 0.15s ease",
          padding: 0,
          outline: "none",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: "block",
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: "#ffffff",
            position: "absolute",
            top: "3px",
            left: checked ? "19px" : "3px",
            transition: "left 0.15s ease",
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
          }}
        />
      </button>
    </div>
  );
}

/**
 * Flat Segmented Control
 */
function SegmentedControl({ options, value, onChange }) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "#11141A",
        padding: "2px",
        borderRadius: "3px",
        border: "1px solid #29313D",
        gap: "2px",
      }}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: "0.3rem 0.75rem",
              fontSize: "0.8125rem",
              fontWeight: isSelected ? 700 : 500,
              color: isSelected ? "#F8FAFC" : "#94A3B8",
              background: isSelected ? "var(--accent-indigo, #3E4776)" : "transparent",
              border: isSelected ? "1px solid rgba(123, 139, 200, 0.4)" : "1px solid transparent",
              borderRadius: "2px",
              cursor: "pointer",
              transition: "all 0.1s ease",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Multi-Pill Selector for Categories
 */
function MultiPills({ options, values = {}, onChange }) {
  return (
    <div style={{ display: "inline-flex", gap: "0.35rem", flexWrap: "wrap" }}>
      {options.map((opt) => {
        const isSelected = Boolean(values[opt.key]);
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key, !isSelected)}
            style={{
              padding: "0.3rem 0.75rem",
              fontSize: "0.8125rem",
              fontWeight: isSelected ? 700 : 500,
              color: isSelected ? "#F8FAFC" : "#94A3B8",
              background: isSelected ? "var(--accent-indigo, #3E4776)" : "#11141A",
              border: isSelected ? "1px solid rgba(123, 139, 200, 0.4)" : "1px solid #29313D",
              borderRadius: "2px",
              cursor: "pointer",
              transition: "all 0.1s ease",
              letterSpacing: "0.02em",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Settings Row Item — Clean Flat Row with Divider
 */
function SettingRow({ label, children }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.85rem 0",
        borderBottom: "1px solid #29313D",
        gap: "1.5rem",
        minHeight: "44px",
      }}
    >
      <div
        style={{
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: "#F8FAFC",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

/**
 * Section Header Line
 */
function SectionHeader({ title, id, isFirst = false }) {
  return (
    <div
      id={id}
      style={{
        fontSize: "0.8125rem",
        fontWeight: 700,
        color: "#94A3B8",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        paddingTop: isFirst ? "0.45rem" : "1.5rem",
        paddingBottom: "0.5rem",
        borderBottom: "1px solid #29313D",
        marginTop: 0,
      }}
    >
      {title}
    </div>
  );
}

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "display", label: "Display" },
  { id: "traffic", label: "Traffic" },
  { id: "map", label: "Map" },
  { id: "alerts", label: "Alerts" },
  { id: "working-mode", label: "Working mode" },
];

export default function SettingsPage({ onSwitchWorkingMode }) {
  const { settings, updateSetting, resetToDefaults } = useSettings();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [activeSection, setActiveSection] = useState("general");
  const scrollContainerRef = useRef(null);

  const handleWorkingModeChange = (mode) => {
    updateSetting("workingMode", null, mode);
    if (onSwitchWorkingMode) {
      onSwitchWorkingMode(mode);
    }
  };

  const handleConfirmReset = () => {
    resetToDefaults();
    setShowResetConfirm(false);
    if (onSwitchWorkingMode) {
      onSwitchWorkingMode("control");
    }
  };

  const handleNavClick = (sectionId) => {
    setActiveSection(sectionId);
    const container = scrollContainerRef.current;
    const target = document.getElementById(`settings-sec-${sectionId}`);
    if (container && target) {
      const topOffset = target.offsetTop - container.offsetTop;
      container.scrollTo({ top: topOffset, behavior: "smooth" });
    }
  };

  // Scroll listener for sticky left navigation highlight
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollPos = container.scrollTop + 60;
      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const sec = document.getElementById(`settings-sec-${SECTIONS[i].id}`);
        if (sec && sec.offsetTop - container.offsetTop <= scrollPos) {
          setActiveSection(SECTIONS[i].id);
          break;
        }
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        maxWidth: "1080px",
        margin: "0 auto",
        width: "100%",
        height: "calc(100vh - 78px)",
        padding: "0.5rem 1.25rem 1.5rem 1.25rem",
        boxSizing: "border-box",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* ── Page Header: Simple "Settings" title with NO subtitle ── */}
      <div style={{ paddingBottom: "1.25rem", flexShrink: 0 }}>
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            color: "#F8FAFC",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Settings
        </h1>
      </div>

      {/* ── Two-Column Operational Layout ── */}
      <div
        style={{
          display: "flex",
          gap: "2.5rem",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Left Navigation: Sticky / Fixed */}
        <nav
          style={{
            width: "180px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            paddingTop: 0,
            marginTop: 0,
          }}
        >
          {SECTIONS.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleNavClick(sec.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "0.45rem 0.75rem",
                  fontSize: "0.875rem",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#F8FAFC" : "#94A3B8",
                  background: isActive ? "rgba(123, 139, 200, 0.08)" : "transparent",
                  border: "none",
                  borderLeft: isActive
                    ? "2px solid var(--accent-soft-blue, #7B8BC8)"
                    : "2px solid transparent",
                  borderRadius: "0 3px 3px 0",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = "#CBD5E1";
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = "#94A3B8";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {sec.label}
              </button>
            );
          })}
        </nav>

        {/* Right Settings List: Scrollable, Flat Rows with Horizontal Separators */}
        <div
          ref={scrollContainerRef}
          className="hide-scrollbar"
          style={{
            flex: 1,
            overflowY: "auto",
            paddingRight: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            paddingTop: 0,
            marginTop: 0,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {/* 1. GENERAL */}
          <div>
            <SectionHeader title="GENERAL" id="settings-sec-general" isFirst={true} />

            <SettingRow label="Language">
              <SegmentedControl
                value={settings.language}
                onChange={(val) => updateSetting("language", null, val)}
                options={[
                  { value: "en", label: "English" },
                  { value: "ta", label: "தமிழ்" },
                ]}
              />
            </SettingRow>

            <SettingRow label="Speed unit">
              <SegmentedControl
                value={settings.speedUnit || "km/h"}
                onChange={(val) => updateSetting("speedUnit", null, val)}
                options={[
                  { value: "km/h", label: "km/h" },
                  { value: "mph", label: "mph" },
                ]}
              />
            </SettingRow>

            <SettingRow label="Auto refresh">
              <SegmentedControl
                value={settings.autoRefresh}
                onChange={(val) => updateSetting("autoRefresh", null, Number(val))}
                options={[
                  { value: 0, label: "Off" },
                  { value: 15, label: "15s" },
                  { value: 30, label: "30s" },
                  { value: 60, label: "60s" },
                ]}
              />
            </SettingRow>
          </div>

          {/* 2. DISPLAY */}
          <div>
            <SectionHeader title="DISPLAY" id="settings-sec-display" />

            <SettingRow label="Theme">
              <SegmentedControl
                value={settings.theme}
                onChange={(val) => updateSetting("theme", null, val)}
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                  { value: "system", label: "System" },
                ]}
              />
            </SettingRow>

            <SettingRow label="Density">
              <SegmentedControl
                value={settings.density}
                onChange={(val) => updateSetting("density", null, val)}
                options={[
                  { value: "compact", label: "Compact" },
                  { value: "comfortable", label: "Comfortable" },
                ]}
              />
            </SettingRow>
          </div>

          {/* 3. TRAFFIC */}
          <div>
            <SectionHeader title="TRAFFIC" id="settings-sec-traffic" />

            <SettingRow label="Default location">
              <SegmentedControl
                value={settings.defaultMapView}
                onChange={(val) => updateSetting("defaultMapView", null, val)}
                options={[
                  { value: "current", label: "Current location" },
                  { value: "selected", label: "Selected location" },
                  { value: "tamil_nadu", label: "Tamil Nadu" },
                ]}
              />
            </SettingRow>

            <SettingRow label="Speed unit">
              <SegmentedControl
                value={settings.speedUnit || "km/h"}
                onChange={(val) => updateSetting("speedUnit", null, val)}
                options={[
                  { value: "km/h", label: "km/h" },
                  { value: "mph", label: "mph" },
                ]}
              />
            </SettingRow>

            <SettingRow label="Vehicle categories">
              <MultiPills
                values={settings.vehicleCategories || { cars: true, trucks: true, buses: true, bikes: true }}
                onChange={(catKey, checked) => updateSetting("vehicleCategories", catKey, checked)}
                options={[
                  { key: "cars", label: "Cars" },
                  { key: "trucks", label: "Trucks" },
                  { key: "buses", label: "Buses" },
                  { key: "bikes", label: "Bikes" },
                ]}
              />
            </SettingRow>

            <SettingRow label="Auto refresh">
              <SegmentedControl
                value={settings.autoRefresh}
                onChange={(val) => updateSetting("autoRefresh", null, Number(val))}
                options={[
                  { value: 0, label: "Off" },
                  { value: 15, label: "15s" },
                  { value: 30, label: "30s" },
                  { value: 60, label: "60s" },
                ]}
              />
            </SettingRow>
          </div>

          {/* 4. MAP */}
          <div>
            <SectionHeader title="MAP" id="settings-sec-map" />

            <SettingRow label="Map style">
              <SegmentedControl
                value={settings.mapStyle}
                onChange={(val) => updateSetting("mapStyle", null, val)}
                options={[
                  { value: "standard", label: "Standard" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "satellite", label: "Satellite" },
                ]}
              />
            </SettingRow>

            <SettingRow label="Junction status">
              <ToggleSwitch
                id="toggle-junction-layer"
                checked={settings.mapLayers.showJunctionStatus}
                onChange={(val) => updateSetting("mapLayers", "showJunctionStatus", val)}
              />
            </SettingRow>

            <SettingRow label="CCTV cameras">
              <ToggleSwitch
                id="toggle-camera-layer"
                checked={settings.mapLayers.showCctvCameras}
                onChange={(val) => updateSetting("mapLayers", "showCctvCameras", val)}
              />
            </SettingRow>

            <SettingRow label="Active incidents">
              <ToggleSwitch
                id="toggle-incident-layer"
                checked={settings.mapLayers.showActiveIncidents}
                onChange={(val) => updateSetting("mapLayers", "showActiveIncidents", val)}
              />
            </SettingRow>

            <SettingRow label="Recommended routes">
              <ToggleSwitch
                id="toggle-route-layer"
                checked={settings.mapLayers.showRecommendedRoutes}
                onChange={(val) => updateSetting("mapLayers", "showRecommendedRoutes", val)}
              />
            </SettingRow>
          </div>

          {/* 5. ALERTS */}
          <div>
            <SectionHeader title="ALERTS" id="settings-sec-alerts" />

            <SettingRow label="Critical incidents">
              <ToggleSwitch
                id="toggle-notif-critical"
                checked={settings.notifications.critical}
                onChange={(val) => updateSetting("notifications", "critical", val)}
              />
            </SettingRow>

            <SettingRow label="Traffic congestion">
              <ToggleSwitch
                id="toggle-notif-high"
                checked={settings.notifications.highPriority}
                onChange={(val) => updateSetting("notifications", "highPriority", val)}
              />
            </SettingRow>

            <SettingRow label="Camera offline">
              <ToggleSwitch
                id="toggle-notif-camera"
                checked={settings.notifications.cameraOffline}
                onChange={(val) => updateSetting("notifications", "cameraOffline", val)}
              />
            </SettingRow>

            <SettingRow label="Route changes">
              <ToggleSwitch
                id="toggle-notif-diversion"
                checked={settings.notifications.diversionUpdates}
                onChange={(val) => updateSetting("notifications", "diversionUpdates", val)}
              />
            </SettingRow>
          </div>

          {/* 6. WORKING MODE */}
          <div>
            <SectionHeader title="WORKING MODE" id="settings-sec-working-mode" />

            <SettingRow label="Mode">
              <SegmentedControl
                value={settings.workingMode}
                onChange={handleWorkingModeChange}
                options={[
                  { value: "control", label: "Control Room" },
                  { value: "field", label: "Field Officer" },
                ]}
              />
            </SettingRow>
          </div>

          {/* 7. RESET TO DEFAULTS */}
          <div style={{ paddingTop: "1.25rem", paddingBottom: "2rem" }}>
            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                style={{
                  background: "transparent",
                  border: "1px solid #29313D",
                  color: "#94A3B8",
                  borderRadius: "3px",
                  padding: "0.4rem 0.85rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  letterSpacing: "0.03em",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#F8FAFC";
                  e.currentTarget.style.borderColor = "#3D3F4E";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#94A3B8";
                  e.currentTarget.style.borderColor = "#29313D";
                }}
              >
                <RotateCcw size={13} />
                Reset to defaults
              </button>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  background: "rgba(244, 94, 112, 0.08)",
                  border: "1px solid rgba(244, 94, 112, 0.3)",
                  padding: "0.5rem 0.85rem",
                  borderRadius: "3px",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: "0.75rem", color: "#FF5B6E", fontWeight: 600 }}>
                  Reset all preferences and display settings to defaults?
                </span>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={handleConfirmReset}
                    style={{
                      background: "#FF5B6E",
                      border: "none",
                      color: "#FFFFFF",
                      borderRadius: "3px",
                      padding: "0.25rem 0.65rem",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    style={{
                      background: "#252936",
                      border: "1px solid #3D3F4E",
                      color: "#CBD5E1",
                      borderRadius: "3px",
                      padding: "0.25rem 0.65rem",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
