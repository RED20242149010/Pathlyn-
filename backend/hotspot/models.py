
from django.db import models


class RoadLocation(models.Model):
    name = models.CharField(max_length=150)
    area = models.CharField(max_length=150, default="Khulna")
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class AccidentRecord(models.Model):
    location = models.ForeignKey(
        RoadLocation,
        on_delete=models.CASCADE,
        related_name="accidents",
    )
    occurred_at = models.DateTimeField()
    severity = models.CharField(max_length=20, default="Unknown")
    vehicles_involved = models.PositiveIntegerField(default=1)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Accident at {self.location.name}"


class TrafficRecord(models.Model):
    location = models.ForeignKey(
        RoadLocation,
        on_delete=models.CASCADE,
        related_name="traffic_records",
    )
    recorded_at = models.DateTimeField(auto_now_add=True)
    congestion_level = models.CharField(max_length=30, default="Moderate")
    average_speed_kmh = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )
    vehicle_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"Traffic at {self.location.name}"


class WeatherRecord(models.Model):
    location = models.ForeignKey(
        RoadLocation,
        on_delete=models.CASCADE,
        related_name="weather_records",
    )
    recorded_at = models.DateTimeField(auto_now_add=True)
    condition = models.CharField(max_length=50, default="Unknown")
    temperature_c = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    rainfall_mm = models.DecimalField(
        max_digits=7, decimal_places=2, default=0
    )
    road_surface = models.CharField(max_length=50, default="Unknown")

    def __str__(self):
        return f"Weather at {self.location.name}"

