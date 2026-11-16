
import json
from io import BytesIO

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from google import genai
from google.genai import types

from PIL import Image, UnidentifiedImageError

from .models import RoadDamageReport
from hotspot.models import RoadLocation


MAX_IMAGE_SIZE = 10 * 1024 * 1024

ALLOWED_DAMAGE_TYPES = {
    "Pothole",
    "Crack",
    "Surface Damage",
    "Waterlogging",
    "Broken Road",
    "Other",
}

ALLOWED_SEVERITIES = {
    "Low",
    "Moderate",
    "High",
    "Critical",
}


# ==================================================
# SERIALIZE REPORT
# ==================================================

def serialize_report(request, report):
    """Convert a saved report into JSON-friendly data."""

    return {
        "id": report.id,
        "location_id": report.location.id,
        "location": report.location.name,
        "damage_type": report.damage_type,
        "severity": report.severity,
        "description": report.description,
        "photo": (
            request.build_absolute_uri(report.photo.url)
            if report.photo else None
        ),
        "analysis_report": report.analysis_report,
        "recommended_action": report.recommended_action,
        "status": report.status,
        "repaired": report.repaired,
        "reported_at": report.reported_at.isoformat(),
    }


# ==================================================
# ADMIN AUTHORIZATION
# ==================================================

def is_authorized_admin(request):
    """
    Only authenticated Django staff members or superusers
    can access admin APIs.
    """

    return (
        request.user.is_authenticated
        and (
            request.user.is_staff
            or request.user.is_superuser
        )
    )


def admin_permission_denied():
    return JsonResponse({
        "success": False,
        "message": (
            "You do not have permission to access this admin feature."
        ),
    }, status=403)


# ==================================================
# GEMINI AI IMAGE ANALYSIS
# ==================================================

def analyze_road_image(image_bytes, content_type):
    """Analyze a road image using Gemini primary and backup models."""

    api_key = getattr(settings, "GEMINI_API_KEY", None)

    primary_model = getattr(
        settings,
        "GEMINI_PRIMARY_MODEL",
        "gemini-3.8-flash"
    )

    backup_model = getattr(
        settings,
        "GEMINI_BACKUP_MODEL",
        "gemini-3.5-flash-lite"
    )

    if not api_key:
        raise ValueError(
            "Gemini API key is missing. Check your backend .env file."
        )

    client = genai.Client(api_key=api_key)

    prompt = """
You are a road damage visual inspection assistant.

Carefully analyze the supplied road photograph.

Only report damage that is visibly supported by the image.
Do not invent measurements, exact depth, or hidden structural
conditions.

Severity is a visual estimate, not a certified engineering
assessment.

Return a valid JSON object using exactly this structure:

{
    "damage_detected": true,
    "damage_type": "Pothole",
    "severity": "Moderate",
    "confidence": "Medium",
    "visual_observations": [
        "Describe the visible damage"
    ],
    "description": "Detailed description of the visible damage.",
    "recommended_action": "A suitable maintenance recommendation.",
    "limitations": "Explain what cannot be determined from the image."
}

Allowed damage_type values:
Pothole, Crack, Surface Damage, Waterlogging, Broken Road, Other.

Allowed severity values:
Low, Moderate, High, Critical.

Confidence must be Low, Medium, or High.

If no road damage is visible, use damage_detected=false.

If the image is not a road image or cannot be assessed,
do not invent a damage report.
"""

    models_to_try = [primary_model]

    if backup_model != primary_model:
        models_to_try.append(backup_model)

    errors = []

    for model in models_to_try:
        try:
            print(f"Trying Gemini model: {model}")

            response = client.models.generate_content(
                model=model,
                contents=[
                    prompt,
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=content_type,
                    ),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )

            result_text = response.text

            if not result_text:
                raise ValueError(
                    "Gemini returned an empty analysis."
                )

            result = json.loads(result_text)

            if not isinstance(result, dict):
                raise ValueError(
                    "Gemini returned an invalid report."
                )

            print(f"Gemini analysis successful: {model}")
            break

        except Exception as error:
            print(f"Gemini model failed ({model}): {error}")
            errors.append(f"{model}: {str(error)}")

    else:
        raise RuntimeError(
            "Both Gemini models failed. " + " | ".join(errors)
        )

    if result.get("damage_detected") is not True:
        raise ValueError(
            "No assessable road damage was detected in the uploaded image."
        )

    damage_type = result.get("damage_type")

    if damage_type not in ALLOWED_DAMAGE_TYPES:
        damage_type = "Other"

    severity = result.get("severity")

    if severity not in ALLOWED_SEVERITIES:
        severity = "Moderate"

    confidence = result.get("confidence", "Low")

    if confidence not in {"Low", "Medium", "High"}:
        confidence = "Low"

    observations = result.get("visual_observations", [])

    if not isinstance(observations, list):
        observations = []

    observations = [
        str(item)[:500] for item in observations[:10]
    ]

    description = str(
        result.get("description", "")
    ).strip()[:5000]

    recommended_action = str(
        result.get("recommended_action", "")
    ).strip()[:3000]

    limitations = str(
        result.get("limitations", "")
    ).strip()[:2000]

    if not description:
        description = (
            "Visible road damage identified by Gemini AI."
        )

    if not recommended_action:
        recommended_action = (
            "Arrange an on-site inspection by a qualified road "
            "maintenance professional."
        )

    if not limitations:
        limitations = (
            "This is an AI visual estimate. Exact damage depth "
            "and hidden structural conditions cannot be determined "
            "from the photograph."
        )

    analysis_report = {
        "damage_detected": True,
        "damage_type": damage_type,
        "severity": severity,
        "confidence": confidence,
        "visual_observations": observations,
        "description": description,
        "recommended_action": recommended_action,
        "limitations": limitations,
        "assessment_type": "Gemini AI visual estimate",
    }

    return {
        "damage_type": damage_type,
        "severity": severity,
        "description": description,
        "recommended_action": recommended_action,
        "analysis_report": analysis_report,
    }


# ==================================================
# VIEW ALL ROAD DAMAGE REPORTS
# ==================================================

@require_GET
def road_damage_list(request):
    """Anyone can view submitted road damage reports."""

    reports = (
        RoadDamageReport.objects
        .select_related("location")
        .order_by("-reported_at")
    )

    data = [
        serialize_report(request, report)
        for report in reports
    ]

    return JsonResponse({
        "success": True,
        "reports": data,
    })


# ==================================================
# CREATE ROAD DAMAGE REPORT
# ==================================================

@require_POST
def create_road_damage(request):
    """Only authenticated users can submit a road damage report."""

    if not request.user.is_authenticated:
        return JsonResponse({
            "success": False,
            "message": (
                "You must log in to submit a road damage report."
            ),
        }, status=401)

    location_id = request.POST.get("location_id", "").strip()
    photo = request.FILES.get("photo")

    if not location_id:
        return JsonResponse({
            "success": False,
            "message": "Please select a road location.",
        }, status=400)

    if not photo:
        return JsonResponse({
            "success": False,
            "message": "Please upload a road damage photo.",
        }, status=400)

    if photo.size > MAX_IMAGE_SIZE:
        return JsonResponse({
            "success": False,
            "message": "Photo must be 10 MB or smaller.",
        }, status=400)

    if photo.content_type not in {"image/jpeg", "image/png"}:
        return JsonResponse({
            "success": False,
            "message": "Only JPG and PNG images are allowed.",
        }, status=400)

    try:
        photo.seek(0)
        image_bytes = photo.read()

        image = Image.open(BytesIO(image_bytes))

        if image.format not in {"JPEG", "PNG"}:
            raise ValueError("Unsupported image format.")

        image_format = image.format
        image.verify()

        content_type = (
            "image/jpeg"
            if image_format == "JPEG"
            else "image/png"
        )

        photo.seek(0)

    except (UnidentifiedImageError, OSError, ValueError):
        return JsonResponse({
            "success": False,
            "message": (
                "The uploaded file is not a valid JPG or PNG image."
            ),
        }, status=400)

    try:
        location = RoadLocation.objects.get(id=location_id)

    except (RoadLocation.DoesNotExist, ValueError):
        return JsonResponse({
            "success": False,
            "message": "Invalid road location.",
        }, status=404)

    try:
        ai_result = analyze_road_image(
            image_bytes,
            content_type,
        )

    except ValueError as error:
        return JsonResponse({
            "success": False,
            "message": str(error),
        }, status=400)

    except Exception as error:
        print(f"Road damage AI error: {error}")

        return JsonResponse({
            "success": False,
            "message": (
                "Both Gemini models failed to analyze the image. "
                "Please try again later."
            ),
        }, status=502)

    report = None

    try:
        report = RoadDamageReport(
            location=location,
            damage_type=ai_result["damage_type"],
            severity=ai_result["severity"],
            description=ai_result["description"],
            analysis_report=ai_result["analysis_report"],
            recommended_action=ai_result["recommended_action"],
            photo=photo,
        )

        report.save()

        return JsonResponse({
            "success": True,
            "message": (
                "Gemini AI road damage analysis completed and saved."
            ),
            "report": serialize_report(request, report),
        }, status=201)

    except Exception as error:
        print(f"Road damage save error: {error}")

        if report and report.photo and report.photo.name:
            try:
                default_storage.delete(report.photo.name)
            except Exception:
                pass

        return JsonResponse({
            "success": False,
            "message": "An error occurred while saving the report.",
        }, status=500)


# ==================================================
# ADMIN PANEL APIs
# ==================================================


# --------------------------------------------------
# ADMIN OVERVIEW
# GET /api/road-damage/admin/overview/
# --------------------------------------------------

@require_GET
def admin_overview(request):

    if not is_authorized_admin(request):
        return admin_permission_denied()

    User = get_user_model()

    pending_count = (
        RoadDamageReport.objects
        .filter(status="Pending")
        .count()
    )

    under_review_count = (
        RoadDamageReport.objects
        .filter(status="Under Review")
        .count()
    )

    resolved_count = (
        RoadDamageReport.objects
        .filter(status="Resolved")
        .count()
    )

    dismissed_count = (
        RoadDamageReport.objects
        .filter(status="Dismissed")
        .count()
    )

    # Return all reports for the Admin Panel tabs.
    all_reports = (
        RoadDamageReport.objects
        .select_related("location")
        .order_by("-reported_at")
    )

    active_locations = (
        RoadLocation.objects
        .filter(is_active=True)
        .order_by("name")
    )

    reports_data = [
        serialize_report(request, report)
        for report in all_reports
    ]

    locations_data = [
        {
            "id": location.id,
            "name": location.name,
            "area": location.area,
            "latitude": float(location.latitude),
            "longitude": float(location.longitude),
        }
        for location in active_locations
    ]

    return JsonResponse({
        "success": True,

        "summary": {
            "registered_users": User.objects.count(),
            "pending_reports": pending_count,
            "under_review_reports": under_review_count,
            "resolved_reports": resolved_count,
            "dismissed_reports": dismissed_count,
            "active_hotspots": active_locations.count(),
        },

        "reports": reports_data,
        "locations": locations_data,
    })


# --------------------------------------------------
# ADMIN REPORT ACTION
# POST /api/road-damage/admin/reports/<id>/action/
# --------------------------------------------------

@require_POST
def admin_report_action(request, report_id):

    if not is_authorized_admin(request):
        return admin_permission_denied()

    try:
        data = json.loads(request.body or "{}")

    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "message": "Invalid JSON data.",
        }, status=400)

    action = data.get("action")

    if not isinstance(action, str):
        return JsonResponse({
            "success": False,
            "message": "Please provide a valid action.",
        }, status=400)

    action = action.strip().lower()

    try:
        report = (
            RoadDamageReport.objects
            .select_related("location")
            .get(id=report_id)
        )

    except RoadDamageReport.DoesNotExist:
        return JsonResponse({
            "success": False,
            "message": "Road damage report not found.",
        }, status=404)

    # Only these status transitions are permitted.
    allowed_transitions = {
        ("Pending", "approve"): (
            "Under Review",
            False,
            "Report approved and moved to Under Review successfully.",
        ),

        ("Pending", "dismiss"): (
            "Dismissed",
            False,
            "Report dismissed successfully.",
        ),

        ("Under Review", "resolve"): (
            "Resolved",
            True,
            "Report marked as resolved successfully.",
        ),
    }

    current_status = report.status

    transition = allowed_transitions.get(
        (current_status, action)
    )

    if transition is None:
        return JsonResponse({
            "success": False,
            "message": (
                f"Action '{action}' is not allowed for a "
                f"report with status '{current_status}'."
            ),
            "current_status": current_status,
        }, status=409)

    new_status, repaired, message = transition

    report.status = new_status
    report.repaired = repaired

    report.save(
        update_fields=["status", "repaired"]
    )

    return JsonResponse({
        "success": True,
        "message": message,
        "report": serialize_report(request, report),
    }, status=200)


# --------------------------------------------------
# ADMIN MANUAL REPORT CREATION
# POST /api/road-damage/admin/reports/create/
# --------------------------------------------------

@require_POST
def admin_create_report(request):

    if not is_authorized_admin(request):
        return admin_permission_denied()

    try:
        data = json.loads(request.body or "{}")

    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "message": "Invalid JSON data.",
        }, status=400)

    location_id = data.get("location_id")
    damage_type = data.get("damage_type")
    severity = data.get("severity")
    description = data.get("description", "")
    confidence = data.get("confidence", 0)

    try:
        location_id = int(location_id)

    except (TypeError, ValueError):
        return JsonResponse({
            "success": False,
            "message": "Please select a valid road location.",
        }, status=400)

    try:
        location = RoadLocation.objects.get(
            id=location_id,
            is_active=True,
        )

    except RoadLocation.DoesNotExist:
        return JsonResponse({
            "success": False,
            "message": (
                "The selected road location does not exist or is inactive."
            ),
        }, status=404)

    if damage_type not in ALLOWED_DAMAGE_TYPES:
        return JsonResponse({
            "success": False,
            "message": "Please select a valid damage type.",
        }, status=400)

    if severity not in ALLOWED_SEVERITIES:
        return JsonResponse({
            "success": False,
            "message": "Please select a valid severity level.",
        }, status=400)

    if not isinstance(description, str):
        return JsonResponse({
            "success": False,
            "message": "Description must be text.",
        }, status=400)

    description = description.strip()[:5000]

    try:
        confidence = int(confidence)

    except (TypeError, ValueError):
        return JsonResponse({
            "success": False,
            "message": (
                "Confidence must be a number between 0 and 100."
            ),
        }, status=400)

    if not 0 <= confidence <= 100:
        return JsonResponse({
            "success": False,
            "message": "Confidence must be between 0 and 100.",
        }, status=400)

    report = RoadDamageReport.objects.create(
        location=location,
        damage_type=damage_type,
        severity=severity,
        description=description,
        recommended_action=(
            "Arrange an inspection and appropriate road maintenance."
        ),
        analysis_report={
            "assessment_type": "Manual admin assessment",
            "confidence": confidence,
        },
        status="Pending",
        repaired=False,
    )

    return JsonResponse({
        "success": True,
        "message": "New road damage entry created successfully.",
        "report": serialize_report(request, report),
    }, status=201)
