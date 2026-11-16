# SafeRoute AI – Routing Module

## Overview

The Routing module is a core component of the SafeRoute AI platform. It helps users find suitable routes between locations while considering road safety conditions.

It uses road-location, hotspot, and road damage information to support safer route planning across Khulna City, Bangladesh.

## Key Features

- Find routes between a starting point and destination.
- Generate alternative routes.
- Evaluate road safety risks along routes.
- Consider nearby road damage reports.
- Consider recorded accident and hotspot information.
- Compare routes based on safety, distance, and estimated travel time.

## Route Preferences

The system supports three route preferences:

- **Safest:** Prioritizes routes with lower estimated road risk.
- **Balanced:** Considers both route safety and travel efficiency.
- **Fastest:** Prioritizes shorter estimated travel time.

## Technologies Used

- Python
- Django
- SQLite3
- OSRM Routing API

## API Endpoint

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/routes/find/` | Find routes and evaluate route risks |

## Route Information

The routing system can provide information such as:

- Estimated distance in kilometers.
- Estimated travel duration.
- Route risk score.
- Recorded accidents near the route.
- Unrepaired road damage reports near the route.
- Alternative route information.

## Project Integration

The Routing module integrates with the Hotspot and Road Damage modules to support road-risk evaluation.

It also works with the Safe Routes frontend page to display route alternatives and their estimated risk information on an interactive map.

## Part of SafeRoute AI

SafeRoute AI is an AI-based road safety monitoring and risk prediction platform designed to support safer transportation decisions in Khulna City, Bangladesh.
