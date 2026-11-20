
import React, { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Dashboard from "./Dashboard";
import Login from "./Login";
import Register from "./Register";
import SafeRoutes from "./SafeRoutes";
import RiskPrediction from "./RiskPrediction";
import RoadDamage from "./RoadDamage";
import RiskMap from "./RiskMap";
import AuthorityInsights from "./AuthorityInsights";
import Forecast from "./Forecast";
import AdminPanel from "./AdminPanel";

const API_BASE_URL = "http://localhost:8000";

// ==================================================
// ADMIN ROUTE PROTECTION
// ==================================================

function ProtectedAdminRoute({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let isMounted = true;

    const checkAdminPermission = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/me/`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          if (isMounted) {
            setStatus("unauthorized");
          }
          return;
        }

        const data = await response.json();

        // Support either a direct user object or nested user object.
        const user = data.user || data;

        const isStaff =
          user.is_staff === true ||
          user.is_superuser === true ||
          user.role === "staff" ||
          user.role === "admin" ||
          user.role === "superuser";

        if (isMounted) {
          setStatus(isStaff ? "allowed" : "forbidden");
        }
      } catch (error) {
        console.error("Admin permission check failed:", error);

        if (isMounted) {
          setStatus("unauthorized");
        }
      }
    };

    checkAdminPermission();

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === "checking") {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2>Checking permissions...</h2>
        <p>Please wait.</p>
      </div>
    );
  }

  if (status === "unauthorized") {
    return <Navigate to="/login" replace />;
  }

  if (status === "forbidden") {
    return <Navigate to="/" replace />;
  }

  return children;
}


// ==================================================
// 404 PAGE
// ==================================================

function NotFound() {
  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>404 - Page Not Found</h1>

      <p>The page you are looking for does not exist.</p>

      <button onClick={() => (window.location.href = "/")}>
        Back to Dashboard
      </button>
    </div>
  );
}


// ==================================================
// MAIN APP
// ==================================================

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Main Dashboard */}
        <Route path="/" element={<Dashboard />} />

        {/* Authentication */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Normal User Features */}
        <Route path="/safe-routes" element={<SafeRoutes />} />

        <Route
          path="/risk-prediction"
          element={<RiskPrediction />}
        />

        <Route path="/road-damage" element={<RoadDamage />} />

        <Route path="/risk-map" element={<RiskMap />} />

        <Route
          path="/authority-insights"
          element={<AuthorityInsights />}
        />

        <Route path="/forecast" element={<Forecast />} />

        {/* Staff-Only Admin Panel and Manage Reports */}
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <AdminPanel />
            </ProtectedAdminRoute>
          }
        />

        {/* Unknown Pages - Keep Last */}
        <Route path="*" element={<NotFound />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
