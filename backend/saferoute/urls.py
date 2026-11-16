
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # Django Admin
    path("admin/", admin.site.urls),

    # User Authentication APIs
    path("api/", include("accounts.urls")),

    # Safe Route Planning API
    path("api/routes/", include("routing.urls")),

    # Risk Prediction APIs
    path("api/predictions/", include("prediction.urls")),

    # Risk Map API
    path("api/", include("hotspot.urls")),

    # Road Damage and Admin APIs
    path("api/road-damage/", include("road_damage.urls")),
]
