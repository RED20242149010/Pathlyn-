# SafeRoute AI – Road Damage Module

## Overview

The Road Damage module is an important component of the SafeRoute AI platform. It allows users to report damaged road conditions and helps administrators review and manage submitted reports.

The module supports road safety monitoring across Khulna City, Bangladesh.

## Key Features

- Submit road damage reports.
- Upload road images for damage analysis.
- AI-powered road damage image analysis using Google Gemini.
- Identify different types of road damage.
- Assign damage severity levels.
- Allow administrators to review submitted reports.
- Approve, dismiss, and resolve reports.
- Manage road damage information through the Admin Panel.

## Supported Damage Types

- Pothole
- Crack
- Surface Damage
- Waterlogging
- Broken Road
- Other

## Damage Severity Levels

- Low
- Moderate
- High
- Critical

## Report Status

- Pending
- Under Review
- Dismissed
- Resolved

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/road-damage/` | Retrieve road damage reports |
| POST | `/api/road-damage/create/` | Submit a new report |
| GET | `/api/road-damage/admin/overview/` | Retrieve admin dashboard data |
| POST | `/api/road-damage/admin/reports/<id>/action/` | Manage report status |
| POST | `/api/road-damage/admin/reports/create/` | Create an admin report |

## Technologies Used

- Python
- Django
- SQLite3
- React
- Google Gemini API
- Pillow

## Project Integration

The Road Damage module works with the SafeRoute AI backend and Admin Panel. Reported road damage information can support road-risk monitoring and safe route analysis.

## Part of SafeRoute AI

SafeRoute AI is an AI-based road safety monitoring and risk prediction platform designed to support safer transportation decisions in Khulna City, Bangladesh.
