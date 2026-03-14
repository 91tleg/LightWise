import pytest
from unittest.mock import MagicMock

from application.streetlight.update_metadata import UpdateStreetlightMetadata


@pytest.fixture
def repo():
    return MagicMock()


@pytest.fixture
def service(repo):
    return UpdateStreetlightMetadata(repo=repo)


class TestUpdateStreetlightMetadata:
    def test_raises_when_all_fields_none(self, service, repo):
        with pytest.raises(ValueError, match="At least one field"):
            service.execute(
                streetlight_id="LW-00042", name=None, lat=None, lng=None
            )
        repo.update.assert_not_called()

    def test_raises_on_lat_above_90(self, service, repo):
        with pytest.raises(ValueError, match="Invalid latitude"):
            service.execute(
                streetlight_id="LW-00042", name=None, lat=91.0, lng=None
            )
        repo.update.assert_not_called()

    def test_raises_on_lat_below_minus_90(self, service, repo):
        with pytest.raises(ValueError, match="Invalid latitude"):
            service.execute(
                streetlight_id="LW-00042", name=None, lat=-91.0, lng=None
            )
        repo.update.assert_not_called()

    def test_accepts_lat_at_boundary_90(self, service, repo):
        service.execute(
            streetlight_id="LW-00042", name=None, lat=90.0, lng=None
        )
        repo.update.assert_called_once()

    def test_accepts_lat_at_boundary_minus_90(self, service, repo):
        service.execute(
            streetlight_id="LW-00042", name=None, lat=-90.0, lng=None
        )
        repo.update.assert_called_once()

    def test_raises_on_lng_above_180(self, service, repo):
        with pytest.raises(ValueError, match="Invalid longitude"):
            service.execute(
                streetlight_id="LW-00042", name=None, lat=None, lng=181.0
            )
        repo.update.assert_not_called()

    def test_raises_on_lng_below_minus_180(self, service, repo):
        with pytest.raises(ValueError, match="Invalid longitude"):
            service.execute(
                streetlight_id="LW-00042", name=None, lat=None, lng=-181.0
            )
        repo.update.assert_not_called()

    def test_accepts_lng_at_boundary_180(self, service, repo):
        service.execute(
            streetlight_id="LW-00042", name=None, lat=None, lng=180.0
        )
        repo.update.assert_called_once()

    def test_accepts_lng_at_boundary_minus_180(self, service, repo):
        service.execute(
            streetlight_id="LW-00042", name=None, lat=None, lng=-180.0
        )
        repo.update.assert_called_once()

    def test_calls_repo_with_name_only(self, service, repo):
        service.execute(
            streetlight_id="LW-00042", name="New Name", lat=None, lng=None
        )
        repo.update.assert_called_once_with(
            streetlight_id="LW-00042",
            name="New Name",
            lat=None,
            lng=None,
        )

    def test_calls_repo_with_lat_lng_only(self, service, repo):
        service.execute(
            streetlight_id="LW-00042", name=None, lat=47.61, lng=-122.20
        )
        repo.update.assert_called_once_with(
            streetlight_id="LW-00042",
            name=None,
            lat=47.61,
            lng=-122.20,
        )

    def test_calls_repo_with_all_fields(self, service, repo):
        service.execute(
            streetlight_id="LW-00042",
            name="Main St",
            lat=47.61,
            lng=-122.20,
        )
        repo.update.assert_called_once_with(
            streetlight_id="LW-00042",
            name="Main St",
            lat=47.61,
            lng=-122.20,
        )

    def test_passes_correct_streetlight_id(self, service, repo):
        service.execute(
            streetlight_id="LW-00099", name="Test", lat=None, lng=None
        )
        repo.update.assert_called_once_with(
            streetlight_id="LW-00099",
            name="Test",
            lat=None,
            lng=None,
        )

    def test_returns_none(self, service, repo):
        result = service.execute(
            streetlight_id="LW-00042",
            name="Test",
            lat=None,
            lng=None,
        )

        assert result is None
