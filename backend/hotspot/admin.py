
from django.contrib import admin
from .models import (
    RoadLocation,
    AccidentRecord,
    TrafficRecord,
    WeatherRecord,
)


@admin.register(RoadLocation)
class RoadLocationAdmin(admin.ModelAdmin):
    list_display = ("name", "area", "latitude", "longitude", "is_active")
    search_fields = ("name", "area")
    list_filter = ("area", "is_active")


@admin.register(AccidentRecord)
class AccidentRecordAdmin(admin.ModelAdmin):
    list_display = ("location", "occurred_at", "severity", "vehicles_involved")
    list_filter = ("severity", "occurred_at")
    search_fields = ("location__name",)


@admin.register(TrafficRecord)
class TrafficRecordAdmin(admin.ModelAdmin):
    list_display = ("location", "recorded_at", "congestion_level", "average_speed_kmh")
    list_filter = ("congestion_level",)


@admin.register(WeatherRecord)
class WeatherRecordAdmin(admin.ModelAdmin):
    list_display = ("location", "recorded_at", "condition", "rainfall_mm")
    list_filter = ("condition",)

