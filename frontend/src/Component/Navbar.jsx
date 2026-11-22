
import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import {
  User,
  LogOut,
  LayoutDashboard,
  BrainCircuit,
  Map,
  Navigation,
  ChartNoAxesCombined,
  Construction,
  Lightbulb,
  Shield,
} from "lucide-react";

import "./Navbar.css";

const API_BASE_URL = "http://localhost:8000";

function Navbar() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("User");
  const [loggingOut, setLoggingOut] = useState(false);

  // ======================================
  // LOAD USERNAME
  // ======================================

  useEffect(() => {
    const savedUsername = localStorage.getItem("saferoute_username");

    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  // ======================================
  // NAVIGATION ITEMS
  // ======================================

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Risk Prediction", path: "/risk-prediction", icon: BrainCircuit },
    { name: "Risk Map", path: "/risk-map", icon: Map },
    { name: "Safe Routes", path: "/safe-routes", icon: Navigation },
    { name: "Forecast & Score", path: "/forecast", icon: ChartNoAxesCombined },
    { name: "Road Damage", path: "/road-damage", icon: Construction },
    { name: "Authority Insights", path: "/authority-insights", icon: Lightbulb },
    { name: "Admin Panel", path: "/admin", icon: Shield },
  ];

  // ======================================
  // LOGOUT
  // ======================================

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await fetch(`${API_BASE_URL}/api/logout/`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("saferoute_username");
      localStorage.removeItem("saferoute_role");
      localStorage.removeItem("saferoute_remember");
      localStorage.removeItem("saferoute_logged_in");

      navigate("/login");
      setLoggingOut(false);
    }
  };

  // ======================================
  // NAVBAR UI
  // ======================================

  return (
    <header className="safe-navbar">

      {/* PATHLYN BRAND */}

      <NavLink to="/" className="safe-navbar-brand">

        <div className="safe-navbar-logo">
          <img
            src="/pathlyn-brand.png"
            alt="PATHLYN Logo"
            className="pathlyn-logo"
          />
        </div>

        <div className="safe-navbar-brand-text">
          <h1>PATHLYN</h1>
          <span>INTELLIGENT ROAD PATHWAYS</span>
        </div>

      </NavLink>

      {/* NAVIGATION LINKS */}

      <nav className="safe-navbar-links">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `safe-navbar-link ${isActive ? "active" : ""}`
              }
            >
              <Icon className="safe-navbar-link-icon" size={17} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* USER ACCOUNT */}

      <div className="safe-navbar-account">

        <div className="safe-navbar-user">
          <User size={20} />
          <span title={username}>{username}</span>
        </div>

        <button
          className="safe-navbar-logout"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          <LogOut size={19} />

          <span>
            {loggingOut ? "Logging out..." : "Logout"}
          </span>
        </button>

      </div>

    </header>
  );
}

export default Navbar;
