import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Sidebar from "./components/Sidebar";

import Dashboard from "./pages/Dashboard";
import HealthMonitoring from "./pages/HealthMonitoring";
import RiskAlerts from "./pages/RiskAlerts";
import HealthHistory from "./pages/HealthHistory";
import Setting from "./pages/Setting";

import "./App.css";

function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />

      <main className="app-main-content">
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