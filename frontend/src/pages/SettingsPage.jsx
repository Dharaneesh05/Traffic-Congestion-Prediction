import React, { useState, useEffect, useRef } from "react";
import { useSettings } from "../context/SettingsContext";
import { RotateCcw } from "lucide-react";

/**
 * Clean Flat Toggle Switch with clear ON / OFF status indicator
 */
function ToggleSwitch({ checked, onChange, id }) {
  const { t } = useSettings();
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: 700,
          color: checked ? "var(--status-normal, #2E8B57)" : "var(--text-muted, #64748B)",
          fontFamily: "var(--font-mono, monospace)",
          minWidth: "26px",
          textAlign: "right",
          letterSpacing: "0.04em",
        }}
      >
        {checked ? t("common.on", "ON") : t("common.off", "OFF")}
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
          background: checked ? "var(--status-normal, #2E8B57)" : "var(--bg-surface-secondary, #EEF2F6)",
          border: checked ? "1px solid var(--status-normal, #2E8B57)" : "1px solid var(--border-default, #D8E0E8)",
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
            boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
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
        background: "var(--bg-surface-secondary, #EEF2F6)",
        padding: "2px",
        borderRadius: "4px",
        border: "1px solid var(--border-default, #D8E0E8)",
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
              color: isSelected ? "#FFFFFF" : "var(--text-secondary, #344256)",
              background: isSelected ? "var(--accent, #245B86)" : "transparent",
              border: isSelected ? "1px solid var(--accent, #245B86)" : "1px solid transparent",
              borderRadius: "3px",
              cursor: "pointer",
              transition: "all 0.12s ease",
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
              color: isSelected ? "#FFFFFF" : "var(--text-secondary, #344256)",
              background: isSelected ? "var(--accent, #245B86)" : "var(--bg-surface-secondary, #EEF2F6)",
              border: isSelected ? "1px solid var(--accent, #245B86)" : "1px solid var(--border-default, #D8E0E8)",
              borderRadius: "3px",
              cursor: "pointer",
              transition: "all 0.12s ease",
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
        borderBottom: "1px solid var(--border-light, #E7ECF1)",
        gap: "1.5rem",
        minHeight: "44px",
      }}
    >
      <div
        style={{
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: "var(--text-primary, #162334)",
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
        color: "var(--text-muted, #64748B)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        paddingTop: isFirst ? "0.45rem" : "1.5rem",
        paddingBottom: "0.5rem",
        borderBottom: "1px solid var(--border-default, #D8E0E8)",
        marginTop: 0,
      }}
    >
      {title}
    </div>
  );
}

export default function SettingsPage({ onSwitchWorkingMode }) {
  const { settings, updateSetting, resetToDefaults, t } = useSettings();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [activeSection, setActiveSection] = useState("general");
  const scrollContainerRef = useRef(null);

  const sections = [
    { id: "general", label: t("settings.general", "General") },
    { id: "display", label: t("settings.display", "Display") },
    { id: "traffic", label: t("settings.traffic", "Traffic") },
    { id: "map", label: t("settings.map", "Map") },
    { id: "alerts", label: t("settings.alerts", "Alerts") },
    { id: "working-mode", label: t("settings.workingMode", "Working mode") },
  ];

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
      for (let i = sections.length - 1; i >= 0; i--) {
        const sec = document.getElementById(`settings-sec-${sections[i].id}`);
        if (sec && sec.offsetTop - container.offsetTop <= scrollPos) {
          setActiveSection(sections[i].id);
          break;
        }
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [sections]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "100%",
        height: "calc(100vh - 78px)",
        padding: "0.75rem 2rem 1.5rem 2rem",
        boxSizing: "border-box",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* ── Page Header: Simple "Settings" title with NO subtitle ── */}
      <div style={{ paddingBottom: "1.25rem", flexShrink: 0 }}>
        <h1
          style={{
            fontSize: "1.375rem",
            fontWeight: 800,
            color: "var(--text-primary, #162334)",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {t("settings.title", "Settings")}
        </h1>
      </div>

      {/* ── Two-Column Operational Layout ── */}
      <div
        style={{
          display: "flex",
          gap: "2.75rem",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Left Navigation: Sticky / Fixed */}
        <nav
          style={{
            width: "210px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            paddingTop: 0,
            marginTop: 0,
          }}
        >
          {sections.map((sec) => {
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
                  padding: "0.55rem 0.95rem",
                  fontSize: "0.875rem",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "var(--text-primary, #162334)" : "var(--text-secondary, #344256)",
                  background: isActive ? "var(--bg-surface-secondary, #EEF2F6)" : "transparent",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = "var(--text-primary, #162334)";
                    e.currentTarget.style.background = "var(--bg-card-hover, #EEF2F6)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = "var(--text-secondary, #344256)";
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
            <SectionHeader title={t("settings.general", "GENERAL").toUpperCase()} id="settings-sec-general" isFirst={true} />

            <SettingRow label={t("settings.language", "Language")}>
              <SegmentedControl
                value={settings.language}
                onChange={(val) => updateSetting("language", null, val)}
                options={[
                  { value: "en", label: "English" },
                  { value: "ta", label: "தமிழ்" },
                ]}
              />
            </SettingRow>

            <SettingRow label={t("settings.speedUnit", "Speed unit")}>
              <SegmentedControl
                value={settings.speedUnit || "km/h"}
                onChange={(val) => updateSetting("speedUnit", null, val)}
                options={[
                  { value: "km/h", label: t("settings.speedKmh", "km/h") },
                  { value: "mph", label: t("settings.speedMph", "mph") },
                ]}
              />
            </SettingRow>

            <SettingRow label={t("settings.autoRefresh", "Auto refresh")}>
              <SegmentedControl
                value={settings.autoRefresh}
                onChange={(val) => updateSetting("autoRefresh", null, Number(val))}
                options={[
                  { value: 0, label: t("settings.refreshOff", "Off") },
                  { value: 15, label: t("settings.refresh15s", "15s") },
                  { value: 30, label: t("settings.refresh30s", "30s") },
                  { value: 60, label: t("settings.refresh60s", "60s") },
                ]}
              />
            </SettingRow>
          </div>

          {/* 2. DISPLAY */}
          <div>
            <SectionHeader title={t("settings.display", "DISPLAY").toUpperCase()} id="settings-sec-display" />

            <SettingRow label={t("settings.theme", "Theme")}>
              <SegmentedControl
                value={settings.theme}
                onChange={(val) => updateSetting("theme", null, val)}
                options={[
                  { value: "dark", label: t("settings.themeDark", "Dark") },
                  { value: "light", label: t("settings.themeLight", "Light") },
                  { value: "system", label: t("settings.themeSystem", "System") },
                ]}
              />
            </SettingRow>

            <SettingRow label={t("settings.density", "Density")}>
              <SegmentedControl
                value={settings.density}
                onChange={(val) => updateSetting("density", null, val)}
                options={[
                  { value: "compact", label: t("settings.densityCompact", "Compact") },
                  { value: "comfortable", label: t("settings.densityComfortable", "Comfortable") },
                ]}
              />
            </SettingRow>
          </div>

          {/* 3. TRAFFIC */}
          <div>
            <SectionHeader title={t("settings.traffic", "TRAFFIC").toUpperCase()} id="settings-sec-traffic" />

            <SettingRow label={t("settings.defaultLocation", "Default location")}>
              <SegmentedControl
                value={settings.defaultMapView}
                onChange={(val) => updateSetting("defaultMapView", null, val)}
                options={[
                  { value: "current", label: t("settings.viewCurrent", "Current location") },
                  { value: "selected", label: t("settings.viewSelected", "Selected location") },
                  { value: "tamil_nadu", label: t("settings.viewTamilNadu", "Tamil Nadu") },
                ]}
              />
            </SettingRow>

            <SettingRow label={t("settings.speedUnit", "Speed unit")}>
              <SegmentedControl
                value={settings.speedUnit || "km/h"}
                onChange={(val) => updateSetting("speedUnit", null, val)}
                options={[
                  { value: "km/h", label: t("settings.speedKmh", "km/h") },
                  { value: "mph", label: t("settings.speedMph", "mph") },
                ]}
              />
            </SettingRow>

            <SettingRow label={t("settings.vehicleCategories", "Vehicle categories")}>
              <MultiPills
                values={settings.vehicleCategories || { cars: true, trucks: true, buses: true, bikes: true }}
                onChange={(catKey, checked) => updateSetting("vehicleCategories", catKey, checked)}
                options={[
                  { key: "cars", label: t("traffic.cars", "Cars") },
                  { key: "trucks", label: t("traffic.trucks", "Trucks") },
                  { key: "buses", label: t("traffic.buses", "Buses") },
                  { key: "bikes", label: t("traffic.bikes", "Bikes") },
                ]}
              />
            </SettingRow>

            <SettingRow label={t("settings.autoRefresh", "Auto refresh")}>
              <SegmentedControl
                value={settings.autoRefresh}
                onChange={(val) => updateSetting("autoRefresh", null, Number(val))}
                options={[
                  { value: 0, label: t("settings.refreshOff", "Off") },
                  { value: 15, label: t("settings.refresh15s", "15s") },
                  { value: 30, label: t("settings.refresh30s", "30s") },
                  { value: 60, label: t("settings.refresh60s", "60s") },
                ]}
              />
            </SettingRow>
          </div>

          {/* 4. MAP */}
          <div>
            <SectionHeader title={t("settings.map", "MAP").toUpperCase()} id="settings-sec-map" />

            <SettingRow label={t("settings.mapStyle", "Map style")}>
              <SegmentedControl
                value={settings.mapStyle}
                onChange={(val) => updateSetting("mapStyle", null, val)}
                options={[
                  { value: "standard", label: t("settings.styleStandard", "Standard") },
                  { value: "light", label: t("settings.themeLight", "Light") },
                  { value: "dark", label: t("settings.themeDark", "Dark") },
                  { value: "satellite", label: t("settings.styleSatellite", "Satellite") },
                ]}
              />
            </SettingRow>

            <SettingRow label={t("settings.junctionStatus", "Junction status")}>
              <ToggleSwitch
                id="toggle-junction-layer"
                checked={settings.mapLayers.showJunctionStatus}
                onChange={(val) => updateSetting("mapLayers", "showJunctionStatus", val)}
              />
            </SettingRow>

            <SettingRow label={t("settings.cctvCameras", "CCTV cameras")}>
              <ToggleSwitch
                id="toggle-camera-layer"
                checked={settings.mapLayers.showCctvCameras}
                onChange={(val) => updateSetting("mapLayers", "showCctvCameras", val)}
              />
            </SettingRow>

            <SettingRow label={t("settings.activeIncidents", "Active incidents")}>
              <ToggleSwitch
                id="toggle-incident-layer"
                checked={settings.mapLayers.showActiveIncidents}
                onChange={(val) => updateSetting("mapLayers", "showActiveIncidents", val)}
              />
            </SettingRow>

            <SettingRow label={t("settings.recommendedRoutes", "Recommended routes")}>
              <ToggleSwitch
                id="toggle-route-layer"
                checked={settings.mapLayers.showRecommendedRoutes}
                onChange={(val) => updateSetting("mapLayers", "showRecommendedRoutes", val)}
              />
            </SettingRow>
          </div>

          {/* 5. ALERTS */}
          <div>
            <SectionHeader title={t("settings.alerts", "ALERTS").toUpperCase()} id="settings-sec-alerts" />

            <SettingRow label={t("settings.criticalIncidents", "Critical incidents")}>
              <ToggleSwitch
                id="toggle-notif-critical"
                checked={settings.notifications.critical}
                onChange={(val) => updateSetting("notifications", "critical", val)}
              />
            </SettingRow>

            <SettingRow label={t("settings.trafficCongestion", "Traffic congestion")}>
              <ToggleSwitch
                id="toggle-notif-high"
                checked={settings.notifications.highPriority}
                onChange={(val) => updateSetting("notifications", "highPriority", val)}
              />
            </SettingRow>

            <SettingRow label={t("settings.cameraOffline", "Camera offline")}>
              <ToggleSwitch
                id="toggle-notif-camera"
                checked={settings.notifications.cameraOffline}
                onChange={(val) => updateSetting("notifications", "cameraOffline", val)}
              />
            </SettingRow>

            <SettingRow label={t("settings.routeChanges", "Route changes")}>
              <ToggleSwitch
                id="toggle-notif-diversion"
                checked={settings.notifications.diversionUpdates}
                onChange={(val) => updateSetting("notifications", "diversionUpdates", val)}
              />
            </SettingRow>
          </div>

          {/* 6. WORKING MODE */}
          <div>
            <SectionHeader title={t("settings.workingMode", "WORKING MODE").toUpperCase()} id="settings-sec-working-mode" />

            <SettingRow label={t("settings.mode", "Mode")}>
              <SegmentedControl
                value={settings.workingMode}
                onChange={handleWorkingModeChange}
                options={[
                  { value: "control", label: t("settings.modeControl", "Control Room") },
                  { value: "field", label: t("settings.modeField", "Field Officer") },
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
                  border: "1px solid var(--border-default, #D8E0E8)",
                  color: "var(--text-muted, #64748B)",
                  borderRadius: "4px",
                  padding: "0.45rem 0.95rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  letterSpacing: "0.03em",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-primary, #162334)";
                  e.currentTarget.style.borderColor = "var(--border-strong, #B9C5D1)";
                  e.currentTarget.style.background = "var(--bg-card-hover, #EEF2F6)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted, #64748B)";
                  e.currentTarget.style.borderColor = "var(--border-default, #D8E0E8)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <RotateCcw size={13} />
                {t("settings.reset", "Reset to defaults")}
              </button>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  background: "var(--state-red-subtle, rgba(201, 75, 89, 0.08))",
                  border: "1px solid var(--state-red, #C94B59)",
                  padding: "0.6rem 0.95rem",
                  borderRadius: "4px",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: "0.75rem", color: "var(--state-red, #C94B59)", fontWeight: 600 }}>
                  {t("settings.resetConfirm", "Reset all system preferences and display settings to defaults?")}
                </span>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={handleConfirmReset}
                    style={{
                      background: "var(--state-red, #C94B59)",
                      border: "none",
                      color: "#FFFFFF",
                      borderRadius: "3px",
                      padding: "0.25rem 0.65rem",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {t("common.confirm", "Confirm")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    style={{
                      background: "var(--bg-surface-secondary, #EEF2F6)",
                      border: "1px solid var(--border-default, #D8E0E8)",
                      color: "var(--text-primary, #162334)",
                      borderRadius: "3px",
                      padding: "0.25rem 0.65rem",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {t("common.cancel", "Cancel")}
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
