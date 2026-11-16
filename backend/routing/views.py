
import math
import requests

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from hotspot.models import RoadLocation
from road_damage.models import RoadDamageReport


# ==========================================
# CONFIGURATION
# ==========================================

OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving/"

RISK_RADIUS_KM = 0.5
MAX_ROUTE_SAMPLES = 80
REQUEST_TIMEOUT = 25


# ==========================================
# DISTANCE CALCULATION
# ==========================================

def haversine_distance(lat1, lon1, lat2, lon2):
    earth_radius = 6371

    lat1 = math.radians(float(lat1))
    lon1 = math.radians(float(lon1))
    lat2 = math.radians(float(lat2))
    lon2 = math.radians(float(lon2))

    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1)
        * math.cos(lat2)
        * math.sin(delta_lon / 2) ** 2
    )

    return 2 * earth_radius * math.asin(math.sqrt(a))


# ==========================================
# ROUTE GEOMETRY
# ==========================================

def get_route_samples(coordinates):
    if not coordinates:
        return []

    total_points = len(coordinates)

    if total_points <= MAX_ROUTE_SAMPLES:
        return coordinates

    step = max(1, math.ceil(total_points / MAX_ROUTE_SAMPLES))

    samples = coordinates[::step]

    if samples[-1] != coordinates[-1]:
        samples.append(coordinates[-1])

    return samples


# ==========================================
# HAZARD SEVERITY
# ==========================================

def get_severity_weight(severity):
    value = str(severity or "").strip().lower()

    weights = {
        "low": 2,
        "minor": 2,
        "medium": 5,
        "moderate": 5,
        "high": 8,
        "severe": 10,
        "critical": 12,
        "extreme": 12,
    }

    return weights.get(value, 5)


# ==========================================
# LOAD RECORDED HAZARDS
# ==========================================

def get_hazards():
    hazards = []

    # Active hotspot locations
    locations = RoadLocation.objects.filter(is_active=True)

    for location in locations:
        try:
            latitude = float(location.latitude)
            longitude = float(location.longitude)

            hazards.append({
                "name": location.name,
                "area": location.area,
                "latitude": latitude,
                "longitude": longitude,
                "type": "Hotspot",
                "severity": "High",
                "weight": 5,
            })

        except (TypeError, ValueError):
            continue

    # Unrepaired road damage
    damage_reports = (
        RoadDamageReport.objects
        .filter(repaired=False)
        .select_related("location")
    )

    for report in damage_reports:
        location = report.location

        if not location:
            continue

        try:
            latitude = float(location.latitude)
            longitude = float(location.longitude)

            hazards.append({
                "name": location.name,
                "area": location.area,
                "latitude": latitude,
                "longitude": longitude,
                "type": "Road Damage",
                "severity": str(report.severity or "Medium"),
                "weight": get_severity_weight(report.severity),
            })

        except (TypeError, ValueError):
            continue

    return hazards


# ==========================================
# CALCULATE ROUTE RISK
# ==========================================

def calculate_route_risk(route_geometry, hazards):
    coordinates = route_geometry.get("coordinates", [])

    if not coordinates or not hazards:
        return {
            "risk_score": None,
            "risk_level": "Unknown",
            "risk_data_available": False,
            "nearby_hazards": [],
            "recorded_accidents_near_route": 0,
            "unrepaired_damage_reports_near_route": 0,
        }

    samples = get_route_samples(coordinates)

    nearby_hazards = []
    total_risk_points = 0

    accident_count = 0
    damage_count = 0

    for hazard in hazards:
        nearest_distance = float("inf")

        for coordinate in samples:
            longitude, latitude = coordinate[:2]

            distance = haversine_distance(
                latitude,
                longitude,
                hazard["latitude"],
                hazard["longitude"],
            )

            nearest_distance = min(nearest_distance, distance)

        if nearest_distance <= RISK_RADIUS_KM:
            proximity_factor = (
                1 - nearest_distance / RISK_RADIUS_KM
            )

            risk_contribution = (
                hazard["weight"] * (0.5 + proximity_factor)
            )

            total_risk_points += risk_contribution

            if hazard["type"] == "Hotspot":
                accident_count += 1
            elif hazard["type"] == "Road Damage":
                damage_count += 1

            nearby_hazards.append({
                "name": hazard["name"],
                "area": hazard["area"],
                "type": hazard["type"],
                "severity": hazard["severity"],
                "distance_km": round(nearest_distance, 3),
            })

    risk_score = min(100, round(total_risk_points * 5))

    if risk_score <= 25:
        risk_level = "Low"
    elif risk_score <= 60:
        risk_level = "Medium"
    else:
        risk_level = "High"

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_data_available": True,
        "nearby_hazards": nearby_hazards,
        "recorded_accidents_near_route": accident_count,
        "unrepaired_damage_reports_near_route": damage_count,
    }


# ==========================================
# ROUTE INSTRUCTIONS
# ==========================================

def get_route_steps(route):
    steps = []

    for leg in route.get("legs", []):
        for step in leg.get("steps", []):
            maneuver = step.get("maneuver", {})

            instruction_type = maneuver.get("type", "continue")
            modifier = maneuver.get("modifier", "")

            street_name = step.get("name") or "Unnamed road"

            instruction = (
                f"{instruction_type.replace('_', ' ').title()} "
                f"{modifier} on {street_name}"
            ).strip()

            distance_km = round(
                step.get("distance", 0) / 1000, 2
            )

            duration_minutes = round(
                step.get("duration", 0) / 60, 1
            )

            steps.append({
                "road": street_name,
                "instruction": instruction,
                "distance": distance_km,
                "distance_km": distance_km,
                "duration": duration_minutes,
            })

    return steps


# ==========================================
# ROUTE PREFERENCE SELECTION
# ==========================================

def select_route_index(routes, preference):
    preference = str(preference or "Safest").strip().lower()

    if preference == "fastest":
        return min(
            range(len(routes)),
            key=lambda index: routes[index]["duration"]
        )

    scored_routes = [
        index
        for index, route in enumerate(routes)
        if (
            route["risk_data_available"]
            and route["risk_score"] is not None
        )
    ]

    if preference == "safest" and scored_routes:
        return min(
            scored_routes,
            key=lambda index: routes[index]["risk_score"]
        )

    if preference == "balanced" and scored_routes:
        max_duration = max(
            route["duration"] for route in routes
        ) or 1

        def balanced_score(index):
            route = routes[index]

            normalized_risk = route["risk_score"] / 100
            normalized_duration = route["duration"] / max_duration

            return (
                normalized_risk * 0.6
                + normalized_duration * 0.4
            )

        return min(scored_routes, key=balanced_score)

    return min(
        range(len(routes)),
        key=lambda index: routes[index]["duration"]
    )


# ==========================================
# ROUTE API
# ==========================================

@require_GET
def find_routes(request):
    """
    API:
    /api/routes/find/

    Required:
    start_lon
    start_lat
    end_lon
    end_lat

    Optional:
    preference = Safest / Balanced / Fastest
    """

    try:
        # ----------------------------------
        # 1. READ PARAMETERS
        # ----------------------------------

        start_lon = float(request.GET.get("start_lon"))
        start_lat = float(request.GET.get("start_lat"))

        end_lon = float(request.GET.get("end_lon"))
        end_lat = float(request.GET.get("end_lat"))

        preference = request.GET.get("preference", "Safest")

        if not (
            -180 <= start_lon <= 180
            and -90 <= start_lat <= 90
            and -180 <= end_lon <= 180
            and -90 <= end_lat <= 90
        ):
            return JsonResponse({
                "success": False,
                "message": "Invalid geographic coordinates.",
            }, status=400)

        # ----------------------------------
        # 2. REQUEST ALTERNATIVE ROUTES
        # ----------------------------------

        coordinates = (
            f"{start_lon},{start_lat};"
            f"{end_lon},{end_lat}"
        )

        osrm_url = OSRM_BASE_URL + coordinates

        response = requests.get(
            osrm_url,
            params={
                "overview": "full",
                "geometries": "geojson",
                "alternatives": "3",
                "steps": "true",
            },
            timeout=REQUEST_TIMEOUT,
        )

        response.raise_for_status()

        osrm_data = response.json()

        if osrm_data.get("code") != "Ok":
            return JsonResponse({
                "success": False,
                "message": (
                    osrm_data.get("message")
                    or "No driving route was found."
                ),
            }, status=404)

        osrm_routes = osrm_data.get("routes", [])

        if not osrm_routes:
            return JsonResponse({
                "success": False,
                "message": "No routes were returned by the routing service.",
            }, status=404)

        # ----------------------------------
        # 3. LOAD HAZARDS
        # ----------------------------------

        hazards = get_hazards()

        # ----------------------------------
        # 4. PROCESS EVERY ROUTE
        # ----------------------------------

        processed_routes = []

        for index, item in enumerate(osrm_routes):
            geometry = item.get("geometry")

            if (
                not geometry
                or not geometry.get("coordinates")
                or len(geometry["coordinates"]) < 2
            ):
                continue

            risk = calculate_route_risk(
                geometry,
                hazards
            )

            distance_km = round(
                item.get("distance", 0) / 1000, 2
            )

            duration_minutes = round(
                item.get("duration", 0) / 60, 1
            )

            processed_routes.append({
                "originalIndex": index,

                # Each route has its own geometry.
                "geometry": geometry,

                "distance": distance_km,
                "duration": duration_minutes,

                "distance_km": distance_km,
                "duration_minutes": duration_minutes,

                "risk_score": risk["risk_score"],
                "risk_level": risk["risk_level"],
                "risk_data_available": risk["risk_data_available"],

                "nearby_hazards": risk["nearby_hazards"],

                "recorded_accidents_near_route":
                    risk["recorded_accidents_near_route"],

                "unrepaired_damage_reports_near_route":
                    risk["unrepaired_damage_reports_near_route"],

                "steps": get_route_steps(item),
            })

        if not processed_routes:
            return JsonResponse({
                "success": False,
                "message": "No usable route geometry was returned.",
            }, status=404)

        # ----------------------------------
        # 5. SELECT PREFERRED ROUTE
        # ----------------------------------

        selected_index = select_route_index(
            processed_routes,
            preference
        )

        selected_route = processed_routes[selected_index]

        # ----------------------------------
        # 6. RETURN RESPONSE
        # ----------------------------------

        return JsonResponse({
            "success": True,
            "message": "Routes calculated successfully.",

            "preference": preference,
            "selected_route": selected_index,

            # Both count fields support the frontend.
            "route_count": len(processed_routes),
            "routes_found": len(processed_routes),

            # Selected route information.
            "geometry": selected_route["geometry"],

            "distance": selected_route["distance"],
            "duration": selected_route["duration"],

            "distance_km": selected_route["distance_km"],
            "duration_minutes": selected_route["duration_minutes"],

            "risk_score": selected_route["risk_score"],
            "risk_level": selected_route["risk_level"],
            "risk_data_available": selected_route["risk_data_available"],

            "nearby_hazards": selected_route["nearby_hazards"],

            "recorded_accidents_near_route":
                selected_route["recorded_accidents_near_route"],

            "unrepaired_damage_reports_near_route":
                selected_route["unrepaired_damage_reports_near_route"],

            "steps": selected_route["steps"],

            # Every returned route has independent geometry and risk data.
            "alternatives": processed_routes,

            "hazard_data_count": len(hazards),

            "explanation": (
                "The selected route was evaluated using "
                "available recorded road hazards and travel time."
            ),

            "warning": (
                "Risk scores are heuristic estimates based on recorded "
                "hazard data. They are not validated probabilities or "
                "guarantees of road safety."
            ),

            "source": "OSRM routing and recorded SafeRoute hazard database",

        }, status=200)

    except (TypeError, ValueError):
        return JsonResponse({
            "success": False,
            "message": "Please provide valid start and destination coordinates.",
        }, status=400)

    except requests.exceptions.Timeout:
        return JsonResponse({
            "success": False,
            "message": "The routing service timed out. Please try again.",
        }, status=504)

    except requests.exceptions.RequestException as error:
        return JsonResponse({
            "success": False,
            "message": (
                f"Could not connect to the routing service: {str(error)}"
            ),
        }, status=502)

    except Exception as error:
        return JsonResponse({
            "success": False,
            "message": f"An unexpected server error occurred: {str(error)}",
        }, status=500)
