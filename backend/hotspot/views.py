
from datetime import timedelta

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

from .models import (
    RoadLocation,
    AccidentRecord,
    TrafficRecord,
    WeatherRecord,
)

from road_damage.models import RoadDamageReport


# ==========================================
# RISK MAP CONFIGURATION
# ==========================================

DAMAGE_WEIGHTS = {
    "Low": 10,
    "Moderate": 20,
    "High": 30,
    "Critical": 40,
}

TRAFFIC_WEIGHTS = {
    "Low": 5,
    "Light": 5,
    "Moderate": 12,
    "Heavy": 20,
    "Dense": 25,
    "Severe": 25,
}

RISK_LEVELS = {
    "high": 70,
    "moderate": 35,
}


def get_risk_level(score):
    if score is None:
        return "Unknown"

    if score >= RISK_LEVELS["high"]:
        return "High"

    if score >= RISK_LEVELS["moderate"]:
        return "Moderate"

    return "Low"


def get_risk_color(level):
    colors = {
        "High": "#f43f5e",
        "Moderate": "#f59e0b",
        "Low": "#10b981",
        "Unknown": "#94a3b8",
    }

    return colors.get(level, "#94a3b8")


def calculate_location_risk(
    damage_reports,
    traffic,
    weather,
    accident_count,
):
    """
    Calculate a heuristic risk score using recorded data.

    This score is not a validated accident probability.
    """

    has_data = (
        bool(damage_reports)
        or traffic is not None
        or weather is not None
        or accident_count > 0
    )

    if not has_data:
        return None, {}

    damage_score = 0
    traffic_score = 0
    weather_score = 0
    accident_score = 0

    # Road damage contribution
    if damage_reports:
        highest_severity = max(
            DAMAGE_WEIGHTS.get(report.severity, 0)
            for report in damage_reports
        )

        damage_score = min(
            50,
            highest_severity + min(
                10,
                (len(damage_reports) - 1) * 3
            )
        )

    # Traffic contribution
    if traffic:
        traffic_score = TRAFFIC_WEIGHTS.get(
            traffic.congestion_level,
            8
        )

        if traffic.vehicle_count >= 100:
            traffic_score += 10
        elif traffic.vehicle_count >= 50:
            traffic_score += 5

        if (
            traffic.average_speed_kmh is not None
            and traffic.average_speed_kmh > 50
        ):
            traffic_score += 5

        traffic_score = min(35, traffic_score)

    # Weather and rainfall contribution
    if weather:
        rainfall = float(weather.rainfall_mm or 0)

        if rainfall >= 50:
            weather_score = 20
        elif rainfall >= 20:
            weather_score = 15
        elif rainfall >= 5:
            weather_score = 8
        elif rainfall > 0:
            weather_score = 3

        if "wet" in weather.road_surface.lower():
            weather_score += 5

        weather_score = min(25, weather_score)

    # Accident contribution
    accident_score = min(20, accident_count * 5)

    total_score = min(
        100,
        damage_score
        + traffic_score
        + weather_score
        + accident_score
    )

    factors = {
        "surface_damage": damage_score,
        "traffic": traffic_score,
        "weather": weather_score,
        "accidents": accident_score,
    }

    return total_score, factors


# ==========================================
# RISK MAP API
# GET /api/risk-map/
# ==========================================

@require_GET
def risk_map_data(request):

    locations = RoadLocation.objects.filter(
        is_active=True
    ).order_by("name")

    thirty_days_ago = timezone.now() - timedelta(days=30)

    results = []

    for location in locations:

        # Latest traffic record
        traffic = (
            TrafficRecord.objects
            .filter(location=location)
            .order_by("-recorded_at")
            .first()
        )

        # Latest weather record
        weather = (
            WeatherRecord.objects
            .filter(location=location)
            .order_by("-recorded_at")
            .first()
        )

        # Unresolved road damage reports
        damage_reports = list(
            RoadDamageReport.objects
            .filter(
                location=location,
                repaired=False,
            )
            .exclude(status="Resolved")
        )

        # Accidents recorded during the last 30 days
        accident_count = AccidentRecord.objects.filter(
            location=location,
            occurred_at__gte=thirty_days_ago,
        ).count()

        # Calculate risk
        risk_score, risk_factors = calculate_location_risk(
            damage_reports,
            traffic,
            weather,
            accident_count,
        )

        risk_level = get_risk_level(risk_score)

        # Surface damage information
        damage_data = [
            {
                "id": report.id,
                "damage_type": report.damage_type,
                "severity": report.severity,
                "description": report.description,
                "status": report.status,
                "reported_at": report.reported_at.isoformat(),
                "repaired": report.repaired,
            }
            for report in damage_reports
        ]

        # Traffic information
        traffic_data = None

        if traffic:
            traffic_data = {
                "congestion_level": traffic.congestion_level,
                "average_speed_kmh": (
                    float(traffic.average_speed_kmh)
                    if traffic.average_speed_kmh is not None
                    else None
                ),
                "vehicle_count": traffic.vehicle_count,
                "recorded_at": traffic.recorded_at.isoformat(),
            }

        # Weather information
        weather_data = None

        if weather:
            weather_data = {
                "condition": weather.condition,
                "temperature_c": (
                    float(weather.temperature_c)
                    if weather.temperature_c is not None
                    else None
                ),
                "rainfall_mm": float(weather.rainfall_mm or 0),
                "road_surface": weather.road_surface,
                "recorded_at": weather.recorded_at.isoformat(),
            }

        # Layer-specific information
        waterlogging_reports = [
            report for report in damage_reports
            if report.damage_type == "Waterlogging"
        ]

        velocity_spike = (
            traffic is not None
            and traffic.average_speed_kmh is not None
            and float(traffic.average_speed_kmh) > 50
        )

        results.append({
            "id": location.id,
            "name": location.name,
            "area": location.area,
            "latitude": float(location.latitude),
            "longitude": float(location.longitude),
            "description": location.description,

            "risk_score": risk_score,
            "risk_level": risk_level,
            "risk_color": get_risk_color(risk_level),
            "risk_factors": risk_factors,

            "accident_count_30_days": accident_count,

            "surface_integrity_failures": {
                "active": len(damage_reports) > 0,
                "count": len(damage_reports),
                "reports": damage_data,
            },

            "volatile_traffic_densities": {
                "active": traffic is not None,
                "data": traffic_data,
            },

            "localized_monsoon_water_pooling": {
                "active": (
                    bool(waterlogging_reports)
                    or (
                        weather is not None
                        and float(weather.rainfall_mm or 0) > 0
                    )
                ),
                "waterlogging_count": len(waterlogging_reports),
                "rainfall_mm": (
                    float(weather.rainfall_mm or 0)
                    if weather
                    else None
                ),
            },

            "anomalous_vehicle_velocity_spikes": {
                "active": velocity_spike,
                "average_speed_kmh": (
                    float(traffic.average_speed_kmh)
                    if traffic
                    and traffic.average_speed_kmh is not None
                    else None
                ),
            },

            "traffic": traffic_data,
            "weather": weather_data,
            "damage_reports": damage_data,
        })

    # Summary information
    known_scores = [
        item["risk_score"]
        for item in results
        if item["risk_score"] is not None
    ]

    high_risk_count = sum(
        1 for item in results
        if item["risk_level"] == "High"
    )

    moderate_risk_count = sum(
        1 for item in results
        if item["risk_level"] == "Moderate"
    )

    low_risk_count = sum(
        1 for item in results
        if item["risk_level"] == "Low"
    )

    return JsonResponse({
        "success": True,
        "generated_at": timezone.now().isoformat(),

        "summary": {
            "total_locations": len(results),
            "locations_with_data": len(known_scores),
            "high_risk": high_risk_count,
            "moderate_risk": moderate_risk_count,
            "low_risk": low_risk_count,
            "average_risk_score": (
                round(sum(known_scores) / len(known_scores), 1)
                if known_scores
                else None
            ),
        },

        "locations": results,
    })

