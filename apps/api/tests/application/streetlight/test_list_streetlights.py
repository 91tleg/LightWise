import pytest
from unittest.mock import MagicMock

from domain.streetlight.health import HealthStatus
from domain.streetlight.models import Streetlight
from application.streetlight.list_streetlights import ListStreetlights


def make_streetlight(
    streetlight_id: str,
    health: HealthStatus = HealthStatus.OK
) -> Streetlight:
    return Streetlight(
        streetlight_id=streetlight_id,
        tenant_id="tenant-001",
        health=health,
        last_seen="2026-02-27T03:41:12+00:00",
        motion_detected=False,
        ambient_primary_ok=True,
        ambient_secondary_ok=True,
        th_ok=True,
        motion_primary_ok=True,
        motion_secondary_ok=True,
    )


@pytest.fixture
def repo():
    return MagicMock()


@pytest.fixture
def service(repo):
    return ListStreetlights(repo=repo)


class TestListStreetlights:

    def test_returns_empty_list_when_no_streetlights(self, service, repo):
        repo.list_by_tenant.return_value = []

        result = service.execute(tenant_id="tenant-001")

        assert result == []

    def test_returns_all_streetlights_for_tenant(self, service, repo):
        repo.list_by_tenant.return_value = [
            make_streetlight("LW-00100"),
            make_streetlight("LW-00043"),
        ]

        result = service.execute(tenant_id="tenant-001")

        assert len(result) == 2
        assert result[0].streetlight_id == "LW-00100"
        assert result[1].streetlight_id == "LW-00043"

    def test_calls_repo_with_correct_tenant_id(self, service, repo):
        repo.list_by_tenant.return_value = []

        service.execute(tenant_id="tenant-001")

        repo.list_by_tenant.assert_called_once_with("tenant-001")

    def test_passes_through_different_tenant_id(self, service, repo):
        repo.list_by_tenant.return_value = []

        service.execute(tenant_id="tenant-002")

        repo.list_by_tenant.assert_called_once_with("tenant-002")

    def test_returns_streetlights_with_mixed_health(self, service, repo):
        repo.list_by_tenant.return_value = [
            make_streetlight("LW-00100", health=HealthStatus.OK),
            make_streetlight("LW-00043", health=HealthStatus.DEGRADED),
            make_streetlight("LW-00044", health=HealthStatus.CRITICAL),
        ]

        result = service.execute(tenant_id="tenant-001")

        assert result[0].health == HealthStatus.OK
        assert result[1].health == HealthStatus.DEGRADED
        assert result[2].health == HealthStatus.CRITICAL

    def test_returns_repo_result_directly(self, service, repo):
        expected = [make_streetlight("LW-00100")]
        repo.list_by_tenant.return_value = expected

        result = service.execute(tenant_id="tenant-001")

        assert result is expected

