
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  MapPin,
  Image as ImageIcon,
  AlertTriangle,
  RefreshCw,
  Send,
  LogIn,
  FileText,
} from "lucide-react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./RoadDamage.css";
import Navbar from "./components/Navbar";

const API_BASE_URL = "http://localhost:8000";

// --------------------------------------------------
// ROAD LOCATIONS
// --------------------------------------------------

const ROAD_LOCATIONS = [
  { id: 1, name: "Shibbari Circle", lat: 22.8459, lng: 89.5401 },
  { id: 3, name: "KDA Avenue", lat: 22.8435, lng: 89.5355 },
  { id: 4, name: "Boyra Bazar Intersection", lat: 22.8335, lng: 89.5285 },
  { id: 5, name: "Moylapota More", lat: 22.8425, lng: 89.5480 },
  { id: 6, name: "Royal More", lat: 22.8395, lng: 89.5450 },
  { id: 7, name: "Sonadanga Bus Terminal", lat: 22.8315, lng: 89.5365 },
  { id: 8, name: "Fulbari Gate", lat: 22.8660, lng: 89.5350 },
  { id: 9, name: "Shipyard Road", lat: 22.8190, lng: 89.5750 },
  { id: 11, name: "Daulatpur Bazar Road", lat: 22.8910, lng: 89.5270 },
  { id: 12, name: "Khan Jahan Ali Road", lat: 22.8500, lng: 89.5350 },
  { id: 13, name: "Khulna-Jessore Highway (City Entry)", lat: 22.8660, lng: 89.5100 },
  { id: 14, name: "Rupsha Bridge Approach", lat: 22.8170, lng: 89.5680 },
  { id: 15, name: "Nirala Moor", lat: 22.8370, lng: 89.5310 },
  { id: 16, name: "Khalishpur Main Road", lat: 22.8650, lng: 89.5450 },
  { id: 17, name: "Majid Sarani", lat: 22.8540, lng: 89.5350 },
  { id: 18, name: "Gollamari Intersection", lat: 22.8250, lng: 89.5150 },
  { id: 19, name: "Rupsha Ghat Road", lat: 22.8190, lng: 89.5650 },
];

const DAMAGE_TYPES = [
  "Pothole",
  "Crack",
  "Surface Damage",
  "Waterlogging",
  "Broken Road",
  "Other",
];

const SEVERITIES = ["Low", "Moderate", "High", "Critical"];

// --------------------------------------------------
// CSRF TOKEN HELPER
// --------------------------------------------------

async function getCSRFToken() {
  const response = await fetch(`${API_BASE_URL}/api/csrf/`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Could not obtain the Django CSRF token.");
  }

  const data = await response.json();

  if (!data.success || !data.csrfToken) {
    throw new Error("Django did not return a valid CSRF token.");
  }

  return data.csrfToken;
}

// --------------------------------------------------
// ROAD DAMAGE COMPONENT
// --------------------------------------------------

function RoadDamage() {
  const navigate = useNavigate();

  // REFERENCES
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const fileInputRef = useRef(null);

  // AUTHENTICATION
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // REPORT HISTORY
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);

  // NOTIFICATIONS
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  // FORM INPUTS
  const [selectedLocationId, setSelectedLocationId] = useState("18");
  const [damageType, setDamageType] = useState("Pothole");
  const [severity, setSeverity] = useState("Moderate");
  const [description, setDescription] = useState("");

  // PHOTO
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  // SUBMISSION AND AI ANALYSIS
  const [submitting, setSubmitting] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const selectedLocation = ROAD_LOCATIONS.find(
    (location) => String(location.id) === selectedLocationId
  );

  // --------------------------------------------------
  // CHECK DJANGO AUTHENTICATION
  // --------------------------------------------------

  useEffect(() => {
    let active = true;

    async function checkAuthentication() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/me/`, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        const data = await response.json();

        if (!active) return;

        if (response.ok && data.success && data.authenticated) {
          setAuthenticated(true);

          localStorage.setItem(
            "saferoute_username",
            data.username || ""
          );
          localStorage.setItem("saferoute_logged_in", "true");
        } else {
          setAuthenticated(false);

          localStorage.removeItem("saferoute_username");
          localStorage.removeItem("saferoute_logged_in");
        }
      } catch (error) {
        console.error("Authentication check failed:", error);

        if (active) {
          setAuthenticated(false);
        }
      } finally {
        if (active) {
          setCheckingAuth(false);
        }
      }
    }

    checkAuthentication();

    return () => {
      active = false;
    };
  }, []);

  // --------------------------------------------------
  // LOAD REPORT HISTORY
  // --------------------------------------------------

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    setPageError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/road-damage/`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Could not load road damage reports."
        );
      }

      setReports(
        Array.isArray(data.reports) ? data.reports : []
      );
    } catch (error) {
      console.error("Report loading failed:", error);

      setPageError(
        "Could not connect to the Road Damage API. Make sure Django is running."
      );
    } finally {
      setLoadingReports(false);
    }
  }, []);

  // LOAD REPORTS WHEN PAGE OPENS
  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // --------------------------------------------------
  // INITIALIZE LEAFLET MAP
  // --------------------------------------------------

  useEffect(() => {
    if (!mapElementRef.current || mapInstanceRef.current) return;

    const map = L.map(mapElementRef.current, {
      center: [22.835, 89.542],
      zoom: 13,
      scrollWheelZoom: true,
    });

    mapInstanceRef.current = map;

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }
    ).addTo(map);

    // ADD ALL ROAD LOCATION MARKERS
    ROAD_LOCATIONS.forEach((location) => {
      const isSelected =
        location.id === Number(selectedLocationId);

      L.circleMarker(
        [location.lat, location.lng],
        {
          radius: isSelected ? 9 : 6,
          color: isSelected ? "#e11d48" : "#0891b2",
          fillColor: isSelected ? "#fb7185" : "#06b6d4",
          fillOpacity: 0.9,
          weight: 2,
        }
      )
        .addTo(map)
        .bindPopup(`<strong>${location.name}</strong>`);
    });

    // SELECTED LOCATION MARKER
    const initialLocation = ROAD_LOCATIONS.find(
      (location) =>
        String(location.id) === selectedLocationId
    );

    markerRef.current = L.marker([
      initialLocation?.lat || 22.825,
      initialLocation?.lng || 89.515,
    ]).addTo(map);

    markerRef.current.bindPopup(
      initialLocation?.name || "Selected road location"
    );

    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // --------------------------------------------------
  // UPDATE MAP WHEN LOCATION CHANGES
  // --------------------------------------------------

  useEffect(() => {
    if (!mapInstanceRef.current || !selectedLocation) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([
        selectedLocation.lat,
        selectedLocation.lng,
      ]);

      markerRef.current.setPopupContent(
        selectedLocation.name
      );
    }

    mapInstanceRef.current.setView(
      [selectedLocation.lat, selectedLocation.lng],
      14
    );
  }, [selectedLocationId, selectedLocation]);

  // --------------------------------------------------
  // IMAGE PREVIEW CLEANUP
  // --------------------------------------------------

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  // --------------------------------------------------
  // IMAGE UPLOAD
  // --------------------------------------------------

  const handlePhoto = (file) => {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png"];

    if (!allowedTypes.includes(file.type)) {
      setNotice("Please select a JPG or PNG image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setNotice("Image size must be 10 MB or smaller.");
      return;
    }

    setNotice("");
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setAnalysis(null);
  };

  const handleFileChange = (event) => {
    handlePhoto(event.target.files?.[0]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    handlePhoto(event.dataTransfer.files?.[0]);
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview("");
    setAnalysis(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // --------------------------------------------------
  // PREPARE AI ANALYSIS
  // Actual Gemini analysis runs on Django at submission.
  // --------------------------------------------------

  const handleAnalyze = () => {
    if (!photo) {
      setNotice("Please upload a road photo before analyzing.");
      return;
    }

    setAnalysis({
      message:
        "Photo is ready. Gemini AI analysis will run when you submit the report.",
    });

    setNotice(
      "Photo prepared. Submit the report to run Gemini AI image analysis."
    );
  };

  // --------------------------------------------------
  // SUBMIT ROAD DAMAGE REPORT
  // --------------------------------------------------

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNotice("");

    if (checkingAuth) {
      setNotice("Please wait while we check your login status.");
      return;
    }

    if (!authenticated) {
      navigate("/login");
      return;
    }

    if (!selectedLocationId || !damageType) {
      setNotice("Please select a location and damage type.");
      return;
    }

    if (!photo) {
      setNotice("Please upload a road damage photo.");
      return;
    }

    const formData = new FormData();

    formData.append("location_id", selectedLocationId);
    formData.append("damage_type", damageType);
    formData.append("severity", severity);
    formData.append("description", description);
    formData.append("photo", photo);

    setSubmitting(true);

    try {
      // GET FRESH DJANGO CSRF TOKEN
      const csrfToken = await getCSRFToken();

      // SEND REPORT TO DJANGO BACKEND
      const response = await fetch(
        `${API_BASE_URL}/api/road-damage/create/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "X-CSRFToken": csrfToken,
            Accept: "application/json",
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        setAuthenticated(false);
        localStorage.removeItem("saferoute_username");
        localStorage.removeItem("saferoute_logged_in");
        navigate("/login");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "The report could not be submitted."
        );
      }

      // SAVE AI ANALYSIS RESULT
      setAnalysis(
        data.report?.analysis_report || null
      );

      setNotice(
        "Gemini AI analysis completed and your road damage report was saved."
      );

      // RESET FORM
      setDescription("");
      setPhoto(null);
      setPhotoPreview("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // REFRESH REPORT HISTORY
      await loadReports();
    } catch (error) {
      console.error("Road damage submission failed:", error);

      setNotice(
        error.message || "Could not submit the road damage report."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------
  // DATE FORMAT
  // --------------------------------------------------

  const formatDate = (dateValue) => {
    if (!dateValue) return "Date unavailable";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleString();
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="road-damage-page">

      {/* SHARED NAVBAR */}
      <Navbar />

      {/* MAIN CONTENT */}
      <main className="rd-main">

        {/* PAGE HEADING */}
        <div className="rd-page-heading">
          <div>
            <span className="rd-eyebrow">
              KHULNA OPERATIONS
            </span>

            <h1>Road Damage Reporting</h1>

            <p>
              Report structural road hazards and review pavement
              conditions across Khulna City.
            </p>
          </div>

          <button
            className="rd-refresh-button"
            type="button"
            onClick={loadReports}
            disabled={loadingReports}
          >
            <RefreshCw size={15} />
            {loadingReports ? "Refreshing..." : "Refresh Reports"}
          </button>
        </div>

        {/* NOTIFICATIONS */}
        {notice && (
          <div className="rd-notice" role="status">
            <span>{notice}</span>

            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}

        {pageError && (
          <div className="rd-error-message" role="alert">
            {pageError}
          </div>
        )}

        <div className="rd-layout">

          {/* LEFT COLUMN */}
          <section className="rd-left-column">

            {/* ROAD DAMAGE REPORT FORM */}
            <form
              className="rd-card rd-report-form"
              onSubmit={handleSubmit}
            >

              <div className="rd-card-heading">
                <h2>Report Structural Road Damage</h2>
                <span className="rd-heading-line" />
              </div>

              {/* PHOTO INPUT */}
              <input
                ref={fileInputRef}
                className="rd-hidden-input"
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFileChange}
              />

              <div
                className={`rd-upload-zone ${
                  photo ? "has-photo" : ""
                }`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Upload road damage photo"
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Selected road damage"
                    className="rd-upload-preview"
                  />
                ) : (
                  <>
                    <Upload size={27} />

                    <strong>
                      Drag &amp; Drop Road Photo Here
                    </strong>

                    <span>
                      Supports JPG, PNG up to 10MB
                    </span>
                  </>
                )}
              </div>

              {photo && (
                <div className="rd-file-information">
                  <ImageIcon size={15} />

                  <span>{photo.name}</span>

                  <button
                    type="button"
                    onClick={removePhoto}
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* LOCATION */}
              <div className="rd-form-field">
                <label htmlFor="rd-location">
                  <MapPin size={13} />
                  ROAD LOCATION
                </label>

                <select
                  id="rd-location"
                  value={selectedLocationId}
                  onChange={(event) =>
                    setSelectedLocationId(event.target.value)
                  }
                >
                  {ROAD_LOCATIONS.map((location) => (
                    <option
                      key={location.id}
                      value={location.id}
                    >
                      {location.name}, Khulna
                    </option>
                  ))}
                </select>
              </div>

              {/* DAMAGE TYPE */}
              <div className="rd-form-field">
                <label htmlFor="rd-damage-type">
                  DAMAGE TYPE
                </label>

                <select
                  id="rd-damage-type"
                  value={damageType}
                  onChange={(event) =>
                    setDamageType(event.target.value)
                  }
                >
                  {DAMAGE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* SEVERITY */}
              <div className="rd-form-field">
                <label htmlFor="rd-severity">
                  SEVERITY LEVEL
                </label>

                <select
                  id="rd-severity"
                  value={severity}
                  onChange={(event) =>
                    setSeverity(event.target.value)
                  }
                >
                  {SEVERITIES.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              {/* DESCRIPTION */}
              <div className="rd-form-field">
                <label htmlFor="rd-description">
                  DESCRIPTION
                </label>

                <textarea
                  id="rd-description"
                  rows="3"
                  placeholder="Describe the road damage, nearby landmark, or safety concern..."
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                />
              </div>

              {/* AI PREPARATION */}
              <button
                className="rd-analyze-button"
                type="button"
                onClick={handleAnalyze}
                disabled={!photo || submitting}
              >
                Analyze Pavement Health
              </button>

              {/* SUBMIT REPORT */}
              <button
                className="rd-submit-button"
                type="submit"
                disabled={submitting || checkingAuth}
              >
                {submitting ? (
                  <>
                    <RefreshCw
                      size={16}
                      className="rd-spin"
                    />
                    Analyzing with Gemini...
                  </>
                ) : !authenticated && !checkingAuth ? (
                  <>
                    <LogIn size={16} />
                    Sign In to Submit Official Report
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Submit &amp; Analyze Report
                  </>
                )}
              </button>

              {checkingAuth && (
                <p className="rd-auth-hint">
                  Checking account status...
                </p>
              )}

              {!checkingAuth && !authenticated && (
                <p className="rd-auth-hint">
                  You can view reports without signing in.
                  Login is required to submit an official report.
                </p>
              )}

            </form>

            {/* AI CLASSIFICATION RESULT */}
            <section className="rd-card rd-analysis-card">
              <h2>AI Classification Result</h2>

              {analysis ? (
                <>
                  {analysis.damage_type && (
                    <div className="rd-result-row">
                      <span>Damage Type:</span>

                      <strong className="rd-damage-value">
                        {analysis.damage_type}
                      </strong>
                    </div>
                  )}

                  {analysis.severity && (
                    <div className="rd-result-row">
                      <span>Severity:</span>

                      <strong className="rd-severity-value">
                        {analysis.severity}
                      </strong>
                    </div>
                  )}

                  {analysis.confidence && (
                    <div className="rd-result-row">
                      <span>AI Confidence:</span>

                      <strong className="rd-confidence-value">
                        {analysis.confidence}
                      </strong>
                    </div>
                  )}

                  {analysis.visual_observations?.length > 0 && (
                    <div className="rd-ai-details">
                      <strong>Visual Observations</strong>

                      <ul>
                        {analysis.visual_observations.map(
                          (item, index) => (
                            <li key={index}>{item}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                  {analysis.recommended_action && (
                    <div className="rd-ai-details">
                      <strong>Recommended Action</strong>
                      <p>{analysis.recommended_action}</p>
                    </div>
                  )}

                  {analysis.limitations && (
                    <div className="rd-ai-details">
                      <strong>Assessment Limitations</strong>
                      <p>{analysis.limitations}</p>
                    </div>
                  )}

                  {analysis.message && (
                    <p className="rd-analysis-disclaimer">
                      {analysis.message}
                    </p>
                  )}
                </>
              ) : (
                <div className="rd-empty-analysis">
                  Upload a photo and submit your report to
                  receive Gemini AI visual analysis.
                </div>
              )}
            </section>

          </section>

          {/* RIGHT COLUMN */}
          <section className="rd-right-column">

            {/* PHOTO PREVIEW */}
            <section className="rd-card rd-preview-card">
              <div className="rd-panel-heading">
                <h2>Analyzed Pavement Preview</h2>

                <span
                  className={
                    photoPreview
                      ? "rd-status-flagged"
                      : "rd-status-waiting"
                  }
                >
                  {photoPreview
                    ? "Photo Uploaded"
                    : "Awaiting Photo"}
                </span>
              </div>

              <div className="rd-large-preview">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Road pavement preview"
                  />
                ) : (
                  <div className="rd-preview-placeholder">
                    <ImageIcon size={42} />

                    <strong>
                      Your road photo will appear here
                    </strong>

                    <span>
                      Upload a JPG or PNG image to preview the pavement
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* LEAFLET MAP */}
            <section className="rd-card rd-map-card">
              <div className="rd-panel-heading">
                <h2>Nearby Hazard Spatial Pin</h2>

                <span className="rd-map-label">
                  {selectedLocation?.name || "Khulna Area"}
                </span>
              </div>

              <div
                ref={mapElementRef}
                className="rd-spatial-map"
                aria-label="Map of road damage locations in Khulna"
              />

              <div className="rd-map-legend">
                <span>
                  <i className="rd-legend-selected" />
                  Selected location
                </span>

                <span>
                  <i className="rd-legend-other" />
                  Other monitoring locations
                </span>
              </div>
            </section>

            {/* REPORT HISTORY */}
            <section className="rd-card rd-reports-card">
              <div className="rd-panel-heading">
                <h2>
                  <FileText size={17} />
                  Reported Road Damage
                </h2>

                <span className="rd-report-count">
                  {reports.length} reports
                </span>
              </div>

              {loadingReports ? (
                <div className="rd-list-message">
                  Loading reports...
                </div>
              ) : reports.length === 0 ? (
                <div className="rd-list-message">
                  No road damage reports found.
                </div>
              ) : (
                <div className="rd-report-list">
                  {reports.slice(0, 8).map((report) => (
                    <article
                      className="rd-report-item"
                      key={report.id}
                    >
                      <div className="rd-report-item-icon">
                        <AlertTriangle size={17} />
                      </div>

                      <div className="rd-report-item-content">
                        <strong>{report.damage_type}</strong>

                        <span>{report.location}</span>

                        <small>
                          {report.severity} ·{" "}
                          {report.status || "Pending"}
                        </small>

                        <small>
                          {formatDate(report.reported_at)}
                        </small>

                        {report.analysis_report?.confidence && (
                          <small>
                            AI confidence:{" "}
                            {report.analysis_report.confidence}
                          </small>
                        )}

                        {report.photo && (
                          <a
                            href={report.photo}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View uploaded photo
                          </a>
                        )}
                      </div>

                      <span className="rd-report-id">
                        #{report.id}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>

          </section>
        </div>
      </main>
    </div>
  );
}

export default RoadDamage;
