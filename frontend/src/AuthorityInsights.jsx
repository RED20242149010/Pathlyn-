
import React, { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar";
import "./AuthorityInsights.css";

const API_URL = "http://127.0.0.1:8000/api/risk-map/";

function getRiskLevel(score) {
  if (score === null || score === undefined) return "Unknown";
  if (score >= 70) return "High";
  if (score >= 35) return "Moderate";
  return "Low";
}

function getRiskColor(score) {
  if (score === null || score === undefined) return "#94a3b8";
  if (score >= 70) return "#f43f5e";
  if (score >= 35) return "#f59e0b";
  return "#10b981";
}

function getFactorName(key) {
  const names = {
    surface_damage: "Road surface damage",
    traffic: "Traffic congestion",
    weather: "Weather and rainfall",
    accidents: "Recent accident records",
  };

  return names[key] || key.replaceAll("_", " ");
}

function getRecommendedAction(report) {
  const type = (report.damage_type || "").toLowerCase();

  if (type.includes("pothole")) {
    return "Repair reported pothole";
  }

  if (type.includes("water")) {
    return "Inspect and improve drainage";
  }

  if (type.includes("crack")) {
    return "Inspect and repair road cracks";
  }

  if (type.includes("surface")) {
    return "Arrange road surface maintenance";
  }

  return `Inspect ${report.damage_type || "reported road damage"}`;
}

function getPriority(severity) {
  const value = (severity || "").toLowerCase();

  if (value === "critical" || value === "high") {
    return "High priority";
  }

  if (value === "moderate") {
    return "Medium priority";
  }

  return "Routine";
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SummaryCard({ label, value, description, descriptionType }) {
  return (
    <div className="authority-summary-card">
      <span className="authority-summary-label">{label}</span>
      <strong className="authority-summary-value">{value}</strong>
      <span
        className={`authority-summary-description ${descriptionType || ""}`}
      >
        {description}
      </span>
    </div>
  );
}

function AuthorityInsights() {
  const [locations, setLocations] = useState([]);
  const [summary, setSummary] = useState({});
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAuthorityData() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(API_URL, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Unable to load authority data. Server returned ${response.status}.`
          );
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error("The backend could not provide risk information.");
        }

        setLocations(Array.isArray(result.locations) ? result.locations : []);
        setSummary(result.summary || {});
        setGeneratedAt(result.generated_at || null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Could not connect to the backend.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchAuthorityData();

    return () => controller.abort();
  }, [refreshKey]);

  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => {
      const scoreA = a.risk_score ?? -1;
      const scoreB = b.risk_score ?? -1;
      return scoreB - scoreA;
    });
  }, [locations]);

  const riskDrivers = useMemo(() => {
    const drivers = [];

    locations.forEach((location) => {
      const factors = location.risk_factors || {};

      Object.entries(factors).forEach(([key, value]) => {
        const contribution = Number(value) || 0;

        if (contribution > 0) {
          drivers.push({
            id: `${location.id}-${key}`,
            title: getFactorName(key),
            location: location.name,
            contribution,
            level: location.risk_level || "Unknown",
          });
        }
      });
    });

    return drivers.sort(
      (a, b) => b.contribution - a.contribution
    );
  }, [locations]);

  const interventions = useMemo(() => {
    const reports = [];

    locations.forEach((location) => {
      (location.damage_reports || []).forEach((report) => {
        if (report.repaired || report.status === "Resolved") return;

        reports.push({
          ...report,
          locationName: location.name,
          riskLevel: location.risk_level,
        });
      });
    });

    const priorityOrder = {
      Critical: 0,
      High: 1,
      Moderate: 2,
      Low: 3,
    };

    return reports.sort((a, b) => {
      const priorityA = priorityOrder[a.severity] ?? 4;
      const priorityB = priorityOrder[b.severity] ?? 4;
      return priorityA - priorityB;
    });
  }, [locations]);

  const highRiskCount =
    summary.high_risk ??
    locations.filter((item) => item.risk_level === "High").length;

  const averageRisk = summary.average_risk_score ?? "N/A";

  const locationsWithData =
    summary.locations_with_data ??
    locations.filter((item) => item.risk_score !== null).length;

  const handleRefresh = () => {
    setRefreshKey((previous) => previous + 1);
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="authority-page">
      <Navbar />

      <main className="authority-main">
        <section className="authority-header">
          <div>
            <h1>Authority Insights</h1>
            <p>
              Evidence-led road safety planning for Khulna Municipality
            </p>
          </div>

          <div className="authority-header-actions">
            <button
              className="authority-refresh-button"
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh Data"}
            </button>

            <button
              className="authority-export-button"
              onClick={handleExportPDF}
            >
              Export Report (PDF)
            </button>
          </div>
        </section>

        {error && (
          <div className="authority-error">
            <strong>Backend connection error</strong>
            <p>{error}</p>
            <button onClick={handleRefresh}>Try Again</button>
          </div>
        )}

        {loading && locations.length === 0 && (
          <div className="authority-loading">
            Loading authority insights from the database...
          </div>
        )}

        {!loading && !error && locations.length === 0 && (
          <div className="authority-empty">
            No active road locations were returned by the backend.
          </div>
        )}

        {locations.length > 0 && (
          <>
            <section className="authority-summary-grid">
              <SummaryCard
                label="Active high-risk zones"
                value={highRiskCount}
                description="Locations currently classified as high risk"
                descriptionType="danger-text"
              />

              <SummaryCard
                label="Average risk index"
                value={averageRisk}
                description="Average of locations with recorded data"
              />

              <SummaryCard
                label="Unresolved damage reports"
                value={interventions.length}
                description="Road damage reports awaiting resolution"
                descriptionType={
                  interventions.length > 0 ? "danger-text" : "success-text"
                }
              />

              <SummaryCard
                label="Monitored locations"
                value={summary.total_locations ?? locations.length}
                description={`${locationsWithData} locations have recorded risk data`}
              />
            </section>

            <section className="authority-analytics-grid">
              <div className="authority-panel risk-index-panel">
                <div className="authority-panel-heading">
                  <h2>Risk Index by Location</h2>
                  <p>
                    Current risk exposure across monitored Khulna locations
                  </p>
                </div>

                <div className="risk-index-list">
                  {sortedLocations.map((location) => {
                    const score = location.risk_score;
                    const level = getRiskLevel(score);

                    return (
                      <div className="risk-index-row" key={location.id}>
                        <span className="risk-location-name">
                          {location.name}
                        </span>

                        <div
                          className="risk-progress-track"
                          aria-label={`Risk score ${
                            score === null ? "unavailable" : score
                          }`}
                        >
                          <div
                            className="risk-progress-fill"
                            style={{
                              width: `${score ?? 0}%`,
                              background: getRiskColor(score),
                            }}
                          />
                        </div>

                        <strong className="risk-index-score">
                          {score ?? "—"}
                        </strong>

                        <span
                          className={`risk-level-label ${level.toLowerCase()}`}
                        >
                          {level}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="risk-index-footer">
                  <span>Risk index: 0–100</span>
                  <span>Higher score indicates greater exposure</span>
                </div>
              </div>

              <div className="authority-panel risk-drivers-panel">
                <div className="authority-panel-heading">
                  <h2>Primary Risk Drivers</h2>
                  <p>
                    Recorded factors contributing to location risk scores
                  </p>
                </div>

                <div className="risk-drivers-list">
                  {riskDrivers.length > 0 ? (
                    riskDrivers.slice(0, 8).map((driver) => (
                      <div className="risk-driver-row" key={driver.id}>
                        <div className="risk-driver-info">
                          <strong>{driver.title}</strong>
                          <span>
                            {driver.location} · Contribution:{" "}
                            {driver.contribution}
                          </span>
                        </div>

                        <span
                          className={`risk-driver-badge ${(
                            driver.level || "unknown"
                          ).toLowerCase()}`}
                        >
                          {driver.level}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="authority-no-data">
                      No positive risk-factor contributions are currently
                      available.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="authority-panel interventions-panel">
              <div className="interventions-heading">
                <div>
                  <h2>Road Maintenance Recommendations</h2>
                  <p>
                    Suggested actions based on unresolved road damage reports
                  </p>
                </div>

                <span>{interventions.length} reports</span>
              </div>

              <div className="authority-table-wrapper">
                <table className="authority-table">
                  <thead>
                    <tr>
                      <th>Suggested Action</th>
                      <th>Target Location</th>
                      <th>Damage Type</th>
                      <th>Severity</th>
                      <th>Report Date</th>
                      <th>Report Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {interventions.length > 0 ? (
                      interventions.map((item) => (
                        <tr key={item.id}>
                          <td className="table-action">
                            {getRecommendedAction(item)}
                          </td>

                          <td>{item.locationName}</td>

                          <td>{item.damage_type || "Not specified"}</td>

                          <td>
                            <span
                              className={`priority-badge ${getPriority(
                                item.severity
                              )
                                .toLowerCase()
                                .replace(" ", "-")}`}
                            >
                              {item.severity || "Unknown"}
                            </span>
                          </td>

                          <td>{formatDate(item.reported_at)}</td>

                          <td>{item.status || "Pending review"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="authority-table-empty">
                          No unresolved road damage reports were found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <footer className="authority-footer">
              <span>
                Khulna Division · {locations.length} monitored locations
              </span>

              <span>
                {generatedAt
                  ? `Last updated: ${new Date(generatedAt).toLocaleString()}`
                  : "Update time unavailable"}
              </span>

              <span>
                Risk scores are heuristic estimates, not accident probabilities.
              </span>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

export default AuthorityInsights;
