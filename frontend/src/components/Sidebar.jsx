import React, { useState } from "react";
import {
  LayoutDashboard,
  Map,
  Navigation2,
  TrendingUp,
  Video,
  AlertTriangle,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useSettings } from "../context/SettingsContext";

export default function Sidebar({ activeTab, setActiveTab, isCollapsed, setIsCollapsed }) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const { t } = useSettings();

  const navItems = [
    { id: "dashboard", label: t("nav.dashboard", "Dashboard"), icon: LayoutDashboard },
    { id: "map", label: t("nav.map", "Live Traffic Map"), icon: Map },
    { id: "cctv", label: t("nav.cctv", "Camera Monitoring"), icon: Video },
    { id: "routing", label: t("nav.routing", "Route Planning"), icon: Navigation2 },
    { id: "predictions", label: t("nav.forecast", "Traffic Forecast"), icon: TrendingUp },
    { id: "settings", label: t("nav.settings", "Settings"), icon: Settings },
  ];

  return (
    <aside
      style={{
        width: isCollapsed ? "60px" : "220px",
        background: "var(--bg-sidebar, #FFFFFF)",
        borderRight: "1px solid var(--border-default, #D7DEE8)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "sticky",
        top: 0,
        height: "100vh",
        zIndex: 60,
        flexShrink: 0,
      }}
    >
      {/* Brand Header */}
      <div>
        <div
          style={{
            height: "56px",
            boxSizing: "border-box",
            padding: isCollapsed ? "0 0.5rem" : "0 1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            borderBottom: "none",
            justifyContent: isCollapsed ? "center" : "flex-start",
          }}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            title="Tamil Nadu Police Traffic Control"
          >
            <img
              src="/tn-police-logo.png"
              alt="Tamil Nadu Police"
              style={{
                width: "28px",
                height: "28px",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>

          {!isCollapsed && (
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 800,
                  color: "var(--text-primary, #0F1B33)",
                  letterSpacing: "-0.01em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {t("nav.trafficControl", "TRAFFIC CONTROL")}
              </span>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #64748B)", fontWeight: 600 }}>
                {t("settings.viewTamilNadu", "Tamil Nadu")} Operations
              </span>
            </div>
          )}
        </div>

        {/* Navigation Items with bigger icons and comfortable vertical distribution */}
        <nav
          style={{
            padding: isCollapsed ? "1.5rem 0.5rem" : "1.25rem 0.625rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            alignItems: isCollapsed ? "center" : "stretch",
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isHovered = hoveredItem === item.id;

            return (
              <div
                key={item.id}
                style={{ position: "relative", width: isCollapsed ? "auto" : "100%" }}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <button
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    width: isCollapsed ? "40px" : "100%",
                    height: isCollapsed ? "40px" : "auto",
                    padding: isCollapsed ? "0" : "0.55rem 0.75rem",
                    borderRadius: "4px",
                    border: "none",
                    borderLeft: !isCollapsed
                      ? (isActive ? "3px solid var(--accent-soft-blue, #7B8BC8)" : "3px solid transparent")
                      : "none",
                    background: isActive
                      ? "var(--bg-surface-elevated, #252936)"
                      : isHovered
                      ? "var(--bg-card-hover, #2C303C)"
                      : "transparent",
                    color: isActive
                      ? "var(--accent-soft-blue, #7B8BC8)"
                      : isHovered
                      ? "var(--text-primary, #F4F5F7)"
                      : "var(--text-secondary, #A7ACB8)",
                    fontWeight: isActive ? 600 : 500,
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    justifyContent: isCollapsed ? "center" : "flex-start",
                  }}
                  aria-label={item.label}
                >
                  <Icon
                    size={18}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    color="currentColor"
                  />
                  {!isCollapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
                </button>

                {/* Clear Floating Tooltip on Hover in Collapsed Mode */}
                {isCollapsed && isHovered && (
                  <div
                    style={{
                      position: "absolute",
                      left: "calc(100% + 12px)",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "var(--bg-surface-elevated, #252936)",
                      border: "1px solid var(--border-default, #3D3F4E)",
                      color: "var(--text-primary, #F4F5F7)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      padding: "0.35rem 0.7rem",
                      borderRadius: "4px",
                      whiteSpace: "nowrap",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                      zIndex: 300,
                      pointerEvents: "none",
                      letterSpacing: "0.02em",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {item.label}
                    {/* Arrow Pointer */}
                    <div
                      style={{
                        position: "absolute",
                        left: "-5px",
                        top: "50%",
                        transform: "translateY(-50%) rotate(45deg)",
                        width: "8px",
                        height: "8px",
                        background: "var(--bg-surface-elevated, #252936)",
                        borderLeft: "1px solid var(--border-default, #3D3F4E)",
                        borderBottom: "1px solid var(--border-default, #3D3F4E)",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer Collapse Toggle */}
      <div
        style={{
          padding: "0.875rem 0.625rem",
          borderTop: "1px solid var(--border-light, #2C303C)",
          display: "flex",
          justifyContent: isCollapsed ? "center" : "flex-end",
        }}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: "var(--bg-surface-secondary, #252936)",
            border: "1px solid var(--border-default, #3D3F4E)",
            borderRadius: "4px",
            width: "28px",
            height: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted, #737987)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-primary, #F4F5F7)";
            e.currentTarget.style.background = "var(--bg-card-hover, #2C303C)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-muted, #737987)";
            e.currentTarget.style.background = "var(--bg-surface-secondary, #252936)";
          }}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
