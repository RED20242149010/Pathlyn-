
from django.urls import path
from . import views

urlpatterns = [
    path(
        "risk-map/",
        views.risk_map_data,
        name="risk_map_data",
    ),
]
