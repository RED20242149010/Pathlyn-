
import React from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import Navbar from "./components/Navbar";
import "./Forecast.css";

const KHULNA_CENTER = [22.8456, 89.5403];

const forecastData = [
  { time: "13:00", score: 45 },
  { time: "14:00", score: 58 },
  { time: "15:00", score: 72 },
  { time: "16:00", score: 62 },
  { time: "17:00", score: 50 },
  { time: "18:00", score: 35 },
];

const hazardFactors = [
  {
    name: "Monsoon Water Logging (Predicted)",
    percentage: 45,
    color: "#f59e0b",
  },
  {
    name: "Expected Dusk Traffic Volume",
    percentage: 30,
    color: "#06b6d4",
  },
  {
    name: "Active Pavement Potholes",
    percentage: 25,
    color: "#f43f5e",
  },
];

const corridorPoints = [
  {
    name: "Shibbari",
    position: [22.8459, 89.5401],
    color: "#e600b8",
    labelPosition: [22.8500, 89.5401],
  },
  {
    name: "Gollamari",
    position: [22.8250, 89.5150],
    color: "#16a34a",
    labelPosition: [22.8290, 89.5100],
  },
  {
    name: "Moylapota",
    position: [22.8425, 89.5480],
    color: "#1687ed",
    labelPosition: [22.8390, 89.5480],
  },
  {
    name: "Rupsha",
    position: [22.8170, 89.5680],
    color: "#f97316",
    labelPosition: [22.8210, 89.5720],
  },
];

const corridorLine = [
  [22.8250, 89.5150],
  [22.8425, 89.5480],
  [22.8459, 89.5401],
  [22.8170, 89.5680],
];

function createLabelIcon(name, color) {
  return L.divIcon({
    className: "forecast-map-label-wrapper",
    html: `<div class="forecast-map-label" style="--label-color:${color}">${name} (approx.)</div>`,
    iconSize: [150, 26],
    iconAnchor: [75, 13],
  });
}

function ForecastChart() {
  return (
    <section className="forecast-panel forecast-chart-panel">
      <div className="forecast-panel-heading">
        <h2>6-Hour Risk Progression Forecast</h2>
        <span>Target Area: Mujgunni Highway</span>
      </div>

      <div className="forecast-chart">
        {forecastData.map((item, index) => {
          const isCurrent = item.time === "16:00";

          let color = "#06b6d4";
          if (item.score >= 70) color = "#f43f5e";
          else if (item.score >= 55) color = "#f59e0b";

          return (
            <div className="forecast-chart-column" key={item.time}>
              <div className="forecast-bar-area">
                <div
                  className={`forecast-bar ${isCurrent ? "current" : ""}`}
                  style={{
                    height: `${item.score * 2.5}px`,
                    background: color,
                    borderColor: isCurrent ? "#111827" : "transparent",
                  }}
                  title={`${item.score} risk score at ${item.time}`}
                />
              </div>

              <strong>{item.score}</strong>
              <span className={isCurrent ? "current-time" : ""}>
                {item.time}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CorridorMap() {
  return (
    <section className="forecast-panel forecast-map-panel">
      <div className="forecast-map-heading">
        <h2>Spatial Corridor Assessment</h2>
        <span>Mujgunni Bypass Intersection</span>
      </div>

      <div className="forecast-map-container">
        <MapContainer
          center={KHULNA_CENTER}
          zoom={13}
          scrollWheelZoom={true}
          className="forecast-leaflet-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Polyline
            positions={corridorLine}
            pathOptions={{
              color: "#1687ed",
              weight: 4,
              opacity: 0.85,
            }}
          />

          {corridorPoints.map((point) => (
            <React.Fragment key={point.name}>
              <CircleMarker
                center={point.position}
                radius={6}
                pathOptions={{
                  color: "#ffffff",
                  weight: 3,
                  fillColor: point.color,
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <strong>{point.name} (approx.)</strong>
                  <br />
                  Demonstration corridor location
                </Popup>
              </CircleMarker>

              <Marker
                position={point.labelPosition}
                icon={createLabelIcon(point.name, point.color)}
                interactive={false}
              />
            </React.Fragment>
          ))}

          <Marker position={[22.8450, 89.5350]}>
            <Popup>
              <strong>Khulna City</strong>
              <br />
              Forecast monitoring area
            </Popup>
          </Marker>
        </MapContainer>

        <div className="forecast-map-alert">
          MODERATE TRAFFIC CONGESTION EXPECTED
        </div>
      </div>
    </section>
  );
}

function Forecast() {
  return (
    <div className="forecast-page">
      <Navbar />

      <main className="forecast-main">
        <div className="forecast-left-column">

          {/* CURRENT RISK SCORE */}

          <section className="forecast-panel current-risk-panel">
            <span className="forecast-warning-badge">
              MODERATE HAZARD WARNING
            </span>

            <div className="current-risk-content">
              <div className="forecast-score-circle">
                <strong>62</strong>
                <span>SCORE</span>
              </div>

              <div className="current-risk-description">
                <h1>Mujgunni Highway</h1>
                <p>
                  Current rating: 62/100. Expected safety decline within
                  the next 3 hours due to deteriorating rain forecasts.
                </p>
              </div>
            </div>
          </section>

          {/* CONTRIBUTING FACTORS */}

          <section className="forecast-panel hazard-panel">
            <h2>Contributing Hazard Factors</h2>

            <div className="hazard-factor-list">
              {hazardFactors.map((factor) => (
                <div className="hazard-factor" key={factor.name}>
                  <div className="hazard-factor-heading">
                    <strong>{factor.name}</strong>
                    <span style={{ color: factor.color }}>
                      {factor.percentage}%
                    </span>
                  </div>

                  <div className="hazard-progress-track">
                    <div
                      className="hazard-progress-fill"
                      style={{
                        width: `${factor.percentage}%`,
                        background: factor.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ROUTE ADVICE */}

          <section className="forecast-panel advisory-panel">
            <h2>Route Advisory Recommendations</h2>

            <div className="advisory-card advisory-primary">
              <strong>Utilize Sonadanga Bypass</strong>
              <span>
                Reduces expected commute risk index by 40 points
              </span>
            </div>

            <div className="advisory-card advisory-secondary">
              <strong>Delay Departure to 20:00</strong>
              <span>Favorable rainfall decay expected</span>
            </div>
          </section>

        </div>

        <div className="forecast-right-column">

          {/* SIX-HOUR FORECAST */}

          <ForecastChart />

          {/* SPATIAL MAP */}

          <CorridorMap />

        </div>
      </main>
    </div>
  );
}

export default Forecast;
