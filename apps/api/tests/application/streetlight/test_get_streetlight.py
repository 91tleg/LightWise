import pytest
from unittest.mock import MagicMock
from typing import Optional

from domain.streetlight.health import HealthStatus
from domain.streetlight.models import Streetlight
from application.streetlight.get_streetlight import GetStreetlight


def make_state(
    streetlight_id: str = "LW-00042",
    tenant_id: str = "tenant-001",
    health: HealthStatus = HealthStatus.OK,
    last_seen: Optional[str] = "2026-02-27T03:41:12+00:00",
    motion_detected: Optional[bool] = True,
    ambient_primary_ok: Optional[bool] = True,
    ambient_secondary_ok: Optional[bool] = True,
    th_ok: Optional[bool] = True,
    motion_primary_ok: Optional[bool] = True,
    motion_secondary_ok: Optional[bool] = True,
) -> Streetlight:
    return Streetlight(
        streetlight_id=streetlight_id,
        tenant_id=tenant_id,
        health=health,
        last_seen=last_seen,
        motion_detected=motion_detected,
        ambient_primary_ok=ambient_primary_ok,
        ambient_secondary_ok=ambient_secondary_ok,
        th_ok=th_ok,
        motion_primary_ok=motion_primary_ok,
        motion_secondary_ok=motion_secondary_ok,
    )


def make_metadata(
    streetlight_id: str = "LW-00042",
    lat: float = 47.6101,
    lng: float = -122.2015,
    name: str = "Main St 5th Ave",
) -> Streetlight:
    return Streetlight(
        streetlight_id=streetlight_id,
        tenant_id="",
        health=HealthStatus.UNKNOWN,
        lat=lat,
        lng=lng,
        name=name,
    )


@pytest.fixture
def repo():
    return MagicMock()


@pytest.fixture
def metadata_repo():
    return MagicMock()


@pytest.fixture
def service(repo, metadata_repo):
    return GetStreetlight(repo=repo, metadata_repo=metadata_repo)


class TestGetStreetlight:

    def test_returns_none_when_streetlight_not_found(
        self,
        service,
        repo,
        metadata_repo
    ):
        repo.get.return_value = None

        result = service.execute(
            tenant_id="tenant-001", streetlight_id="LW-00042"
        )

        assert result is None
        metadata_repo.get.assert_not_called()

    def test_returns_streetlight_with_metadata(
        self,
        service,
        repo,
        metadata_repo
    ):
        repo.get.return_value = make_state()
        metadata_repo.get.return_value = make_metadata()

        result = service.execute(
            tenant_id="tenant-001", streetlight_id="LW-00042"
        )

        assert result is not None
        assert result.streetlight_id == "LW-00042"
        assert result.tenant_id == "tenant-001"
        assert result.lat == 47.6101
        assert result.lng == -122.2015
        assert result.name == "Main St 5th Ave"

    def test_returns_streetlight_without_metadata(
        self,
        service,
        repo,
        metadata_repo
    ):
        repo.get.return_value = make_state()
        metadata_repo.get.return_value = None

        result = service.execute(
            tenant_id="tenant-001", streetlight_id="LW-00042"
        )

        assert result is not None
        assert result.lat is None
        assert result.lng is None
        assert result.name is None

    def test_preserves_health_status(
        self,
        service,
        repo,
        metadata_repo
    ):
        repo.get.return_value = make_state(
            health=HealthStatus.DEGRADED
        )
        metadata_repo.get.return_value = None

        result = service.execute(
            tenant_id="tenant-001", streetlight_id="LW-00042"
        )

        assert result.health == HealthStatus.DEGRADED

    def test_preserves_sensor_flags(
        self,
        service,
        repo,
        metadata_repo
    ):
        repo.get.return_value = make_state(
            ambient_secondary_ok=False,
            motion_secondary_ok=False,
        )
        metadata_repo.get.return_value = None

        result = service.execute(
            tenant_id="tenant-001", streetlight_id="LW-00042"
        )

        assert result.ambient_primary_ok is True
        assert result.ambient_secondary_ok is False
        assert result.motion_primary_ok is True
        assert result.motion_secondary_ok is False

    def test_preserves_last_seen(
        self,
        service,
        repo,
        metadata_repo
    ):
        repo.get.return_value = make_state(
            last_seen="2026-02-27T03:41:12+00:00"
        )
        metadata_repo.get.return_value = None

        result = service.execute(
            tenant_id="tenant-001", streetlight_id="LW-00042"
        )

        assert result.last_seen == "2026-02-27T03:41:12+00:00"

    def test_preserves_motion_detected(
        self,
        service,
        repo,
        metadata_repo
    ):
        repo.get.return_value = make_state(
            motion_detected=True
        )
        metadata_repo.get.return_value = None

        result = service.execute(
            tenant_id="tenant-001", streetlight_id="LW-00042"
        )

        assert result.motion_detected is True

    def test_calls_repo_with_correct_keys(
        self,
        service,
        repo,
        metadata_repo
    ):
        repo.get.return_value = None

        service.execute(
            tenant_id="tenant-001", streetlight_id="LW-00042"
        )

        repo.get.assert_called_once_with("tenant-001", "LW-00042")

    def test_calls_metadata_repo_with_streetlight_id(
        self,
        service,
        repo,
        metadata_repo
    ):
        repo.get.return_value = make_state()
        metadata_repo.get.return_value = None

        service.execute(
            tenant_id="tenant-001", streetlight_id="LW-00042"
        )

        metadata_repo.get.assert_called_once_with("LW-00042")

    def test_metadata_lat_lng_overrides_none(
        self,
        service,
        repo,
        metadata_repo
    ):
        repo.get.return_value = make_state()
        metadata_repo.get.return_value = make_metadata(
            lat=37.7749, lng=-122.4194
        )

        result = service.execute(
            tenant_id="tenant-001", streetlight_id="LW-00042"
        )

        assert result.lat == 37.7749
        assert result.lng == -122.4194

    def test_different_tenant_id_passed_through(
        self,
        service,
        repo,
        metadata_repo
    ):
        repo.get.return_value = make_state(
            tenant_id="tenant-002"
        )
        metadata_repo.get.return_value = None

        result = service.execute(
            tenant_id="tenant-002", streetlight_id="LW-00042"
        )

        assert result.tenant_id == "tenant-002"
        repo.get.assert_called_once_with("tenant-002", "LW-00042")
