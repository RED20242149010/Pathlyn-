
import React, { useEffect, useMemo, useState } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Tooltip,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  AlertTriangle,
  MapPin,
  Crosshair,
} from "lucide-react";

import Navbar from "./components/Navbar";
import "./RiskMap.css";

// ==========================================
// BACKEND API
// ==========================================

const API_URL = "http://127.0.0.1:8000/api/risk-map/";

// ==========================================
// KHULNA MAP CENTER
// ==========================================

const KHULNA_CENTER = [22.8456, 89.5403];

// ==========================================
// MAP MARKER ICON
// ==========================================

function createRiskIcon(location) {
  return L.divIcon({
    className: "risk-map-marker-wrapper",
    html: `
      <div class="risk-map-marker" style="--marker-color:${location.color}">
        <span></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// ==========================================
// MAIN RISK MAP COMPONENT
// ==========================================

export default function RiskMap() {
  // ----------------------------------------
  // BACKEND DATA
  // ----------------------------------------

  const [riskLocations, setRiskLocations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ----------------------------------------
  // SELECTED LOCATION
  // ----------------------------------------

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showAllLocations, setShowAllLocations] = useState(true);

  // ========================================
  // FETCH RISK MAP DATA FROM DJANGO
  // ========================================

  const fetchRiskLocations = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.locations)) {
        throw new Error("Invalid Risk Map API response.");
      }

      const formattedLocations = data.locations.map((location) => {
        const score =
          location.risk_score !== null &&
          location.risk_score !== undefined
            ? Number(location.risk_score)
            : null;

        return {
          ...location,

          position: [
            Number(location.latitude),
            Number(location.longitude),
          ],

          score,
          risk: location.risk_level || "Unknown",
          color: location.risk_color || "#64748b",
          shortName: location.name,

          description:
            location.description ||
            "No additional description available.",
        };
      });

      setRiskLocations(formattedLocations);

      // Keep selected location updated after refreshing.
      setSelectedLocation((previous) => {
        if (!previous) return null;

        return (
          formattedLocations.find(
            (location) => location.id === previous.id
          ) || null
        );
      });

    } catch (err) {
      console.error("Risk Map API error:", err);

      setError(
        "Unable to load Risk Map data. Please check that your Django backend is running."
      );

    } finally {
      setLoading(false);
    }
  };

  // Load data when page opens.
  useEffect(() => {
    fetchRiskLocations();
  }, []);

  // ========================================
  // RISK CATEGORY
  // ========================================

  const getRiskLabel = (location) => {
    return location?.risk || "Unknown";
  };

  const getRiskColor = (location) => {
    return location?.color || "#64748b";
  };

  // ========================================
  // FILTER LOCATIONS FOR MAP
  // ========================================

  const visibleLocations = useMemo(() => {
    if (showAllLocations) {
      return riskLocations;
    }

    return selectedLocation ? [selectedLocation] : [];
  }, [riskLocations, showAllLocations, selectedLocation]);

  // ========================================
  // SELECT LOCATION
  // ========================================

  const selectLocation = (location) => {
    setSelectedLocation(location);
    setShowAllLocations(false);
  };

  // ========================================
  // PAGE
  // ========================================

  return (
    <div className="risk-map-page">

      <Navbar />

      <main className="risk-map-main">

        {/* ==================================
            MAP AREA
        ================================== */}

        <section className="risk-map-area">

          {/* MAP LEGEND */}

          <div className="severity-key">

            <h3>SEVERITY INDEX KEY</h3>

            <div>
              <span className="key-dot high" />
              High Risk Status
            </div>

            <div>
              <span className="key-dot moderate" />
              Moderate Risk Status
            </div>

            <div>
              <span className="key-dot low" />
              Low Threat Zone
            </div>

          </div>

          {/* MAP */}

          <MapContainer
            center={KHULNA_CENTER}
            zoom={14}
            minZoom={11}
            maxZoom={18}
            scrollWheelZoom={true}
            className="risk-leaflet-map"
          >

            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* BACKEND RISK MARKERS */}

            {visibleLocations.map((location) => {
              const [latitude, longitude] = location.position;

              if (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)
              ) {
                return null;
              }

              return (
                <React.Fragment key={location.id}>

                  <Marker
                    position={location.position}
                    icon={createRiskIcon(location)}
                    eventHandlers={{
                      click: () => setSelectedLocation(location),
                    }}
                  >

                    <Tooltip direction="top" offset={[0, -12]}>
                      <strong>{location.shortName}</strong>
                      <br />
                      Risk Score: {location.score ?? "N/A"}
                    </Tooltip>

                    <Popup>

                      <div className="risk-map-popup">

                        <h3>{location.name}</h3>

                        <p>{location.description}</p>

                        <strong
                          style={{
                            color: getRiskColor(location),
                          }}
                        >
                          Risk Score: {location.score ?? "N/A"} (
                          {getRiskLabel(location)})
                        </strong>

                        <p>
                          Damage Reports:{" "}
                          {location.surface_integrity_failures?.count ?? 0}
                        </p>

                      </div>

                    </Popup>

                  </Marker>

                  <CircleMarker
                    center={location.position}
                    radius={7}
                    pathOptions={{
                      color: "#ffffff",
                      weight: 3,
                      fillColor: getRiskColor(location),
                      fillOpacity: 1,
                    }}
                  />

                </React.Fragment>
              );
            })}

          </MapContainer>

          {/* LOADING MESSAGE */}

          {loading && (
            <div className="risk-map-loading-message">
              Loading risk map data...
            </div>
          )}

          {/* ERROR MESSAGE */}

          {error && (
            <div className="risk-map-error-message">

              <AlertTriangle size={16} />

              <span>{error}</span>

              <button onClick={fetchRiskLocations}>
                Retry
              </button>

            </div>
          )}

          {/* EMPTY MAP MESSAGE */}

          {!loading && !error && visibleLocations.length === 0 && (
            <div className="risk-map-empty-message">
              No risk locations available.
            </div>
          )}

          {/* MAP INFORMATION CARD */}

          {selectedLocation && (

            <div className="map-info-card">

              <button
                className="map-info-close"
                onClick={() => setSelectedLocation(null)}
                aria-label="Close location details"
              >
                ×
              </button>

              <div className="map-info-title">

                <span
                  className="key-dot"
                  style={{
                    background: selectedLocation.color,
                  }}
                />

                <strong>{selectedLocation.name}</strong>

              </div>

              <p>{selectedLocation.description}</p>

              <span
                className="map-info-score"
                style={{
                  color: getRiskColor(selectedLocation),
                }}
              >
                Risk Score: {selectedLocation.score ?? "N/A"} (
                {selectedLocation.risk})
              </span>

              <p>
                Recorded Damage Reports:{" "}
                {selectedLocation.surface_integrity_failures?.count ?? 0}
              </p>

            </div>

          )}

          {/* MAP FOOTER */}

          <div className="risk-map-footer-note">

            <span>
              <Crosshair size={13} />
              Khulna City Risk Monitoring
            </span>

            <span>OpenStreetMap geographic data</span>

          </div>

        </section>

        {/* ==================================
            RIGHT SIDEBAR
        ================================== */}

        <aside className="risk-map-sidebar">

          {/* CRITICAL ZONES */}

          <div className="sidebar-section diagnostics-section">

            <div className="diagnostics-heading">

              <h3>CRITICAL ZONE DIAGNOSTICS</h3>

              <span>
                {riskLocations.length} Zones
              </span>

            </div>

            <div className="diagnostics-list">

              {riskLocations.map((location) => (

                <button
                  key={location.id}
                  className={`diagnostic-item ${
                    selectedLocation?.id === location.id
                      ? "selected"
                      : ""
                  }`}
                  onClick={() => selectLocation(location)}
                >

                  <span className="diagnostic-name">

                    <MapPin size={15} />

                    {location.name}

                  </span>

                  <span className="diagnostic-score">

                    <i
                      style={{
                        background: getRiskColor(location),
                      }}
                    />

                    {location.score ?? "N/A"} - {location.risk}

                  </span>

                </button>

              ))}

              {!loading && riskLocations.length === 0 && (
                <p>No risk locations available.</p>
              )}

            </div>

            <button
              className="show-all-zones"
              onClick={() => {
                setShowAllLocations(true);
                setSelectedLocation(null);
              }}
            >
              Show All Zones on Map
            </button>

          </div>

          {/* SELECTED ZONE DETAILS */}

          {selectedLocation && (

            <div className="selected-zone-panel">

              <div className="selected-zone-heading">

                <AlertTriangle size={17} />

                <h3>Selected Zone Details</h3>

              </div>

              <strong>{selectedLocation.name}</strong>

              <div className="selected-zone-score">

                <span>Severity Score</span>

                <strong
                  style={{
                    color: getRiskColor(selectedLocation),
                  }}
                >
                  {selectedLocation.score ?? "N/A"}/100
                </strong>

              </div>

              <div className="selected-zone-bar">

                <span
                  style={{
                    width: `${
                      selectedLocation.score !== null
                        ? Math.max(
                            0,
                            Math.min(100, selectedLocation.score)
                          )
                        : 0
                    }%`,
                    background: getRiskColor(selectedLocation),
                  }}
                />

              </div>

              <p>{selectedLocation.description}</p>

              <div className="selected-zone-extra">

                <p>
                  <strong>Damage Reports:</strong>{" "}
                  {selectedLocation.surface_integrity_failures?.count ?? 0}
                </p>

                <p>
                  <strong>Accidents (30 days):</strong>{" "}
                  {selectedLocation.accident_count_30_days ?? 0}
                </p>

                <p>
                  <strong>Traffic:</strong>{" "}
                  {selectedLocation.traffic?.congestion_level || "No data"}
                </p>

                <p>
                  <strong>Weather:</strong>{" "}
                  {selectedLocation.weather?.condition || "No data"}
                </p>

              </div>

            </div>

          )}

          {/* REFRESH BUTTON */}

          <button
            className="show-all-zones"
            onClick={fetchRiskLocations}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh Risk Data"}
          </button>

        </aside>

      </main>

    </div>
  );
}
