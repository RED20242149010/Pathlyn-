# SafeRoute AI – Django Project Configuration

## Overview

The `saferoute` directory contains the main Django project configuration for the SafeRoute AI backend.

It connects the different backend applications and manages the overall server configuration.

## Key Responsibilities

- Configure Django project settings.
- Register installed Django applications.
- Configure database connections.
- Manage API URL routing.
- Configure authentication and session settings.
- Configure CORS and security settings.
- Provide WSGI and ASGI application entry points.

## Main Components

- `settings.py` – Main Django project settings.
- `urls.py` – Central URL configuration for backend applications.
- `wsgi.py` – WSGI application entry point.
- `asgi.py` – ASGI application entry point.
- `__init__.py` – Marks the directory as a Python package.

## Integrated Backend Applications

The project configuration connects the following modules:

- Accounts – User registration, login, and authentication.
- Hotspot – Road-location and hotspot management.
- Prediction – Road risk prediction.
- Routing – Safe route planning.
- Road Damage – Road damage reporting and administration.

## Technologies Used

- Python
- Django
- Django REST Framework
- SQLite3

## Part of SafeRoute AI

SafeRoute AI is an AI-based road safety monitoring and risk prediction platform designed to support safer transportation decisions in Khulna City, Bangladesh.
