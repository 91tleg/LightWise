import pytest
from domain.streetlight.health import HealthStatus
from domain.streetlight.models import Streetlight


@pytest.fixture
def streetlight():
    return Streetlight(
        streetlight_id="LW-00042",
        tenant_id="tenant-001",
        health=HealthStatus.OK,
        lat=37.7749,
        lng=-122.4194,
        name="Main Street 5th Ave",
        last_seen="2026-02-16T03:41:12+00:00",
    )


def test_to_dict_structure(streetlight):
    result = streetlight.to_dict()
    assert result["streetlight_id"] == "LW-00042"
    assert result["tenant_id"] == "tenant-001"
    assert result["health"] == HealthStatus.OK.value
    assert result["lat"] == 37.7749
    assert result["lng"] == -122.4194
    assert result["name"] == "Main Street 5th Ave"
    assert result["last_seen"] == "2026-02-16T03:41:12+00:00"


def test_to_dict_health_is_serialized():
    streetlight = Streetlight(
        streetlight_id="LW-00042",
        tenant_id="tenant-001",
        health=HealthStatus.DEGRADED,
    )
    assert streetlight.to_dict()["health"] == HealthStatus.DEGRADED.value


def test_to_dict_optional_fields_default_none():
    streetlight = Streetlight(
        streetlight_id="LW-00042",
        tenant_id="tenant-001",
        health=HealthStatus.OK,
    )
    result = streetlight.to_dict()
    assert result["lat"] is None
    assert result["lng"] is None
    assert result["name"] is None
    assert result["last_seen"] is None
