from __future__ import annotations
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from application.streetlight.update_metadata import UpdateStreetlightMetadata
from domain.streetlight.models import StreetlightMetadata


_INSTALLED = datetime(2023, 6, 1, 0, 0, 0, tzinfo=timezone.utc)

_EXISTING = StreetlightMetadata(
    streetlight_id="sl-001",
    wireless_device_id="dev-001",
    site_id="site-1",
    lat=37.77,
    lng=-122.41,
    name="Old Name",
    model="LUM-MAX-200",
    installed_at=_INSTALLED,
)


def _use_case(
    existing: StreetlightMetadata | None
) -> tuple[UpdateStreetlightMetadata, MagicMock]:
    repo = MagicMock()
    repo.get.return_value = existing
    return UpdateStreetlightMetadata(repo=repo), repo


class TestNotFound:
    def test_raises_when_streetlight_not_found(self):
        use_case, _ = _use_case(existing=None)
        with pytest.raises(ValueError, match="not found"):
            use_case.execute(
                "tenant-1", "sl-001", name="New", lat=None, lng=None
            )

    def test_save_not_called_when_not_found(self):
        use_case, repo = _use_case(existing=None)
        with pytest.raises(ValueError):
            use_case.execute(
                "tenant-1", "sl-001", name="New", lat=None, lng=None
            )
        repo.save.assert_not_called()


class TestNoOp:
    def test_save_not_called_when_no_updates(self):
        use_case, repo = _use_case(_EXISTING)
        use_case.execute(
            "tenant-1", "sl-001", name=None, lat=None, lng=None
        )
        repo.save.assert_not_called()


class TestPartialUpdates:
    def test_name_updated(self):
        use_case, repo = _use_case(_EXISTING)
        use_case.execute(
            "tenant-1", "sl-001", name="New Name", lat=None, lng=None
        )
        saved = repo.save.call_args[0][1]
        assert saved.name == "New Name"
        assert saved.lat == _EXISTING.lat
        assert saved.lng == _EXISTING.lng

    def test_lat_lng_updated(self):
        use_case, repo = _use_case(_EXISTING)
        use_case.execute(
            "tenant-1", "sl-001", name=None, lat=51.5, lng=-0.1
        )
        saved = repo.save.call_args[0][1]
        assert saved.lat == 51.5
        assert saved.lng == -0.1
        assert saved.name == _EXISTING.name

    def test_all_fields_updated(self):
        use_case, repo = _use_case(_EXISTING)
        use_case.execute(
            "tenant-1", "sl-001", name="Full Update", lat=1.0, lng=2.0
        )
        saved = repo.save.call_args[0][1]
        assert saved.name == "Full Update"
        assert saved.lat == 1.0
        assert saved.lng == 2.0

    def test_immutable_fields_preserved(self):
        use_case, repo = _use_case(_EXISTING)
        use_case.execute(
            "tenant-1", "sl-001", name="Updated", lat=None, lng=None
        )
        saved = repo.save.call_args[0][1]
        assert saved.streetlight_id == _EXISTING.streetlight_id
        assert saved.wireless_device_id == _EXISTING.wireless_device_id
        assert saved.model == _EXISTING.model
        assert saved.installed_at == _EXISTING.installed_at


class TestValidation:
    def test_invalid_lat_raises(self):
        use_case, repo = _use_case(_EXISTING)
        with pytest.raises(ValueError):
            use_case.execute(
                "tenant-1", "sl-001", name=None, lat=91.0, lng=None
            )
        repo.save.assert_not_called()

    def test_invalid_lng_raises(self):
        use_case, repo = _use_case(_EXISTING)
        with pytest.raises(ValueError):
            use_case.execute(
                "tenant-1", "sl-001", name=None, lat=None, lng=181.0
            )
        repo.save.assert_not_called()


class TestTenantScoping:
    def test_get_called_with_tenant_id(self):
        use_case, repo = _use_case(_EXISTING)
        use_case.execute(
            "tenant-1", "sl-001", name="X", lat=None, lng=None
        )
        repo.get.assert_called_once_with("tenant-1", "sl-001")

    def test_save_called_with_tenant_id(self):
        use_case, repo = _use_case(_EXISTING)
        use_case.execute(
            "tenant-1", "sl-001", name="X", lat=None, lng=None
        )
        assert repo.save.call_args[0][0] == "tenant-1"

    def test_different_tenant_gets_own_record(self):
        repo = MagicMock()
        repo.get.return_value = None
        use_case = UpdateStreetlightMetadata(repo=repo)
        with pytest.raises(ValueError, match="not found"):
            use_case.execute(
                "tenant-2", "sl-001", name="X", lat=None, lng=None
            )
        repo.get.assert_called_once_with("tenant-2", "sl-001")
