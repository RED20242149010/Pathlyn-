
from django.db import models
from hotspot.models import RoadLocation


class RoadDamageReport(models.Model):

    DAMAGE_TYPES = [
        ("Pothole", "Pothole"),
        ("Crack", "Road Crack"),
        ("Surface Damage", "Surface Damage"),
        ("Waterlogging", "Waterlogging"),
        ("Broken Road", "Broken Road"),
        ("Other", "Other"),
    ]

    SEVERITY_LEVELS = [
        ("Low", "Low"),
        ("Moderate", "Moderate"),
        ("High", "High"),
        ("Critical", "Critical"),
    ]

    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Under Review", "Under Review"),
        ("Resolved", "Resolved"),
        ("Dismissed", "Dismissed"),
    ]

    location = models.ForeignKey(
        RoadLocation,
        on_delete=models.CASCADE,
        related_name="damage_reports",
    )

    damage_type = models.CharField(
        max_length=100,
        choices=DAMAGE_TYPES,
    )

    severity = models.CharField(
        max_length=20,
        choices=SEVERITY_LEVELS,
        default="Moderate",
    )

    description = models.TextField(blank=True)

    photo = models.ImageField(
        upload_to="road_damage_reports/",
        blank=True,
        null=True,
    )

    # AI-generated detailed analysis
    analysis_report = models.JSONField(
        default=dict,
        blank=True,
    )

    recommended_action = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="Pending",
    )

    reported_at = models.DateTimeField(auto_now_add=True)

    repaired = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.damage_type} at {self.location.name}"

    class Meta:
        ordering = ["-reported_at"]
        verbose_name = "Road Damage Report"
        verbose_name_plural = "Road Damage Reports"
