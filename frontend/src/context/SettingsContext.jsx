import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translate, getLocalizedJunctionName } from "../i18n/translations";

const STORAGE_KEY = "tn_traffic_settings";

export const DEFAULT_SETTINGS = {
  theme: "dark",              // light | dark | system
  density: "compact",         // compact | comfortable
  language: "en",             // en | ta
  defaultMapView: "selected", // selected | current | tamil_nadu
  speedUnit: "km/h",          // km/h | mph
  autoRefresh: 30,            // 0, 15, 30, 60
  vehicleCategories: {
    cars: true,
    trucks: true,
    buses: true,
    bikes: true,
  },
  mapStyle: "standard",       // standard | light | dark | satellite
  mapLayers: {
    showJunctionStatus: true,
    showCctvCameras: true,
    showActiveIncidents: true,
    showRecommendedRoutes: true,
  },
  notifications: {
    critical: true,
    highPriority: true,
    cameraOffline: true,
    diversionUpdates: true,
  },
  workingMode: "control",     // control | field
};

const SettingsContext = createContext({
  settings: DEFAULT_SETTINGS,
  updateSetting: () => {},
  updateSettings: () => {},
  resetToDefaults: () => {},
  t: (key, fallback) => fallback || key,
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          mapLayers: {
            ...DEFAULT_SETTINGS.mapLayers,
            ...(parsed.mapLayers || {}),
          },
          notifications: {
            ...DEFAULT_SETTINGS.notifications,
            ...(parsed.notifications || {}),
          },
          vehicleCategories: {
            ...DEFAULT_SETTINGS.vehicleCategories,
            ...(parsed.vehicleCategories || {}),
          },
        };
      }
    } catch (e) {
      console.warn("Could not load settings from localStorage:", e);
    }
    return DEFAULT_SETTINGS;
  });

  // Apply visual presentation attributes to document element
  useEffect(() => {
    const root = document.documentElement;

    // 1. Density
    root.setAttribute("data-density", settings.density);

    // 2. Language
    root.setAttribute("lang", settings.language);

    // 3. Theme
    let effectiveTheme = settings.theme;
    if (settings.theme === "system") {
      effectiveTheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    root.setAttribute("data-theme", effectiveTheme);

    // Persist to storage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("Could not save settings to localStorage:", e);
    }
  }, [settings]);

  // Update a single setting
  const updateSetting = useCallback((categoryOrKey, subKey, value) => {
    setSettings((prev) => {
      if (subKey !== null && typeof prev[categoryOrKey] === "object") {
        return {
          ...prev,
          [categoryOrKey]: {
            ...prev[categoryOrKey],
            [subKey]: value,
          },
        };
      }
      return {
        ...prev,
        [categoryOrKey]: value !== undefined ? value : subKey,
      };
    });
  }, []);

  // Update multiple settings at once
  const updateSettings = useCallback((partial) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (partial.mapLayers) {
        next.mapLayers = { ...prev.mapLayers, ...partial.mapLayers };
      }
      if (partial.notifications) {
        next.notifications = { ...prev.notifications, ...partial.notifications };
      }
      return next;
    });
  }, []);

  // Reset to default preferences
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }, []);

  // Translation helper bound to active language
  const t = useCallback(
    (key, paramsOrFallback = {}, fallback = "") =>
      translate(settings.language, key, paramsOrFallback, fallback),
    [settings.language]
  );

  // Localized junction and geographic name helper
  const tJunction = useCallback(
    (name) => getLocalizedJunctionName(name, settings.language),
    [settings.language]
  );

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        updateSettings,
        resetToDefaults,
        t,
        tJunction,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
