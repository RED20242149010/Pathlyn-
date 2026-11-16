
from django.urls import path
from . import views

urlpatterns = [
    # Public road damage APIs
    path("", views.road_damage_list, name="road_damage_list"),
    path("create/", views.create_road_damage, name="create_road_damage"),

    # Admin Panel APIs
    path(
        "admin/overview/",
        views.admin_overview,
        name="admin_overview",
    ),

    path(
        "admin/reports/<int:report_id>/action/",
        views.admin_report_action,
        name="admin_report_action",
    ),

    path(
        "admin/reports/create/",
        views.admin_create_report,
        name="admin_create_report",
    ),
]
