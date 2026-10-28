import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";

import Dashboard from "./pages/Dashboard";
import HealthMonitoring from "./pages/HealthMonitoring";
import RiskAlerts from "./pages/RiskAlerts";
import HealthHistory from "./pages/HealthHistory";
import Setting from "./pages/Setting";

import "./App.css";

function AppLayout() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerRef = useRef(null);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    if (!isDrawerOpen) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const drawer = drawerRef.current;
    const menuButton = menuButtonRef.current;
    const closeButton = drawer?.querySelector(".app-sidebar-close");
    closeButton?.focus();

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
        return;
      }

      if (event.key === "Tab" && drawer) {
        const focusableElements = drawer.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (!firstElement || !lastElement) {
          event.preventDefault();
        } else if (
          event.shiftKey &&
          (document.activeElement === firstElement || !drawer.contains(document.activeElement))
        ) {
          event.preventDefault();
          lastElement.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === lastElement || !drawer.contains(document.activeElement))
        ) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      menuButton?.focus();
    };
  }, [isDrawerOpen]);

  return (
    <div className="app-layout">
      <Sidebar
        drawerRef={drawerRef}
        isOpen={isDrawerOpen}
        onNavigate={() => setIsDrawerOpen(false)}
        onClose={() => setIsDrawerOpen(false)}
      />
      {isDrawerOpen && (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Close navigation drawer"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      <main className="app-main-content">
        <Header
          menuButtonRef={menuButtonRef}
          isOpen={isDrawerOpen}
          onToggle={() => setIsDrawerOpen((isOpen) => !isOpen)}
        />
        <Routes>
          <Route path="/" element={<Dashboard />} />

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/health-monitoring"
            element={<HealthMonitoring />}
          />

          <Route
            path="/risk-alerts"
            element={<RiskAlerts />}
          />

          <Route
            path="/health-history"
            element={<HealthHistory />}
          />

          <Route
            path="/settings"
            element={<Setting />}
          />

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}