from django.contrib import admin
from .models import RoadDamageReport


@admin.register(RoadDamageReport)
class RoadDamageReportAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "location",
        "damage_type",
        "severity",
        "status",
        "reported_at",
        "repaired",
    )

    list_filter = ("severity", "status", "repaired")
    search_fields = ("location__name", "damage_type", "description")
    readonly_fields = ("reported_at",)