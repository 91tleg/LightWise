import pytest
from unittest.mock import MagicMock

from domain.streetlight.models import DownlinkCommandRecord
from application.streetlight.list_commands import (
    ListCommands, DEFAULT_LIMIT, MAX_LIMIT
)


def _make_records(
    n: int, streetlight_id: str = "sl-1", tenant_id: str = "t-1"
):
    return [
        DownlinkCommandRecord(
            streetlight_id=streetlight_id,
            command_id=f"cmd-{i}",
            tenant_id=tenant_id,
            issued_by="test-user",
            command_type="DIM",
            payload={"level": 50},
            status="SENT",
            created_at="2024-01-01T00:00:00Z",
            sent_at="2024-01-01T00:00:01Z",
            acknowledged_at=None,
            reason=None,
        )
        for i in range(n)
    ]


def _repo(*, for_streetlight=None, for_tenant=None):
    repo = MagicMock()
    repo.list_for_streetlight.return_value = for_streetlight or []
    repo.list_for_tenant.return_value = for_tenant or []
    return repo


class TestForStreetlight:
    def test_returns_records_from_repo(self):
        records = _make_records(3)
        repo = _repo(for_streetlight=records)
        result = ListCommands(repo).for_streetlight("sl-1")
        assert result == records

    def test_passes_streetlight_id_to_repo(self):
        repo = _repo()
        ListCommands(repo).for_streetlight("sl-42")
        repo.list_for_streetlight.assert_called_once_with(
            streetlight_id="sl-42", limit=DEFAULT_LIMIT
        )

    def test_uses_default_limit_when_none_given(self):
        repo = _repo()
        ListCommands(repo).for_streetlight("sl-1")
        _, kwargs = repo.list_for_streetlight.call_args
        assert kwargs["limit"] == DEFAULT_LIMIT

    def test_uses_caller_supplied_limit(self):
        repo = _repo()
        ListCommands(repo).for_streetlight("sl-1", limit=5)
        _, kwargs = repo.list_for_streetlight.call_args
        assert kwargs["limit"] == 5

    def test_clamps_limit_to_max(self):
        repo = _repo()
        ListCommands(repo).for_streetlight("sl-1", limit=MAX_LIMIT + 999)
        _, kwargs = repo.list_for_streetlight.call_args
        assert kwargs["limit"] == MAX_LIMIT

    def test_limit_exactly_at_max_is_accepted(self):
        repo = _repo()
        ListCommands(repo).for_streetlight("sl-1", limit=MAX_LIMIT)
        _, kwargs = repo.list_for_streetlight.call_args
        assert kwargs["limit"] == MAX_LIMIT

    def test_limit_of_one_is_accepted(self):
        repo = _repo()
        ListCommands(repo).for_streetlight("sl-1", limit=1)
        _, kwargs = repo.list_for_streetlight.call_args
        assert kwargs["limit"] == 1

    def test_zero_limit_raises(self):
        repo = _repo()
        with pytest.raises(ValueError, match="limit must be at least 1"):
            ListCommands(repo).for_streetlight("sl-1", limit=0)

    def test_negative_limit_raises(self):
        repo = _repo()
        with pytest.raises(ValueError, match="limit must be at least 1"):
            ListCommands(repo).for_streetlight("sl-1", limit=-5)

    def test_returns_empty_list_when_repo_returns_none_records(self):
        repo = _repo(for_streetlight=[])
        result = ListCommands(repo).for_streetlight("sl-1")
        assert result == []

    def test_repo_called_exactly_once(self):
        repo = _repo()
        ListCommands(repo).for_streetlight("sl-1")
        assert repo.list_for_streetlight.call_count == 1


class TestForTenant:
    def test_returns_records_from_repo(self):
        records = _make_records(5, tenant_id="t-99")
        repo = _repo(for_tenant=records)
        result = ListCommands(repo).for_tenant("t-99")
        assert result == records

    def test_passes_tenant_id_to_repo(self):
        repo = _repo()
        ListCommands(repo).for_tenant("t-99")
        repo.list_for_tenant.assert_called_once_with(
            tenant_id="t-99", limit=DEFAULT_LIMIT
        )

    def test_uses_default_limit_when_none_given(self):
        repo = _repo()
        ListCommands(repo).for_tenant("t-1")
        _, kwargs = repo.list_for_tenant.call_args
        assert kwargs["limit"] == DEFAULT_LIMIT

    def test_uses_caller_supplied_limit(self):
        repo = _repo()
        ListCommands(repo).for_tenant("t-1", limit=10)
        _, kwargs = repo.list_for_tenant.call_args
        assert kwargs["limit"] == 10

    def test_clamps_limit_to_max(self):
        repo = _repo()
        ListCommands(repo).for_tenant("t-1", limit=MAX_LIMIT + 1)
        _, kwargs = repo.list_for_tenant.call_args
        assert kwargs["limit"] == MAX_LIMIT

    def test_zero_limit_raises(self):
        repo = _repo()
        with pytest.raises(ValueError, match="limit must be at least 1"):
            ListCommands(repo).for_tenant("t-1", limit=0)

    def test_negative_limit_raises(self):
        repo = _repo()
        with pytest.raises(ValueError, match="limit must be at least 1"):
            ListCommands(repo).for_tenant("t-1", limit=-1)

    def test_returns_empty_list_when_no_records(self):
        repo = _repo(for_tenant=[])
        result = ListCommands(repo).for_tenant("t-1")
        assert result == []

    def test_repo_called_exactly_once(self):
        repo = _repo()
        ListCommands(repo).for_tenant("t-1")
        assert repo.list_for_tenant.call_count == 1

    def test_streetlight_repo_not_called(self):
        repo = _repo()
        ListCommands(repo).for_tenant("t-1")
        repo.list_for_streetlight.assert_not_called()


class TestResolveLimit:
    def setup_method(self):
        self.uc = ListCommands(_repo())

    def test_none_returns_default(self):
        assert self.uc._resolve_limit(None) == DEFAULT_LIMIT

    def test_value_below_max_returned_as_is(self):
        assert self.uc._resolve_limit(7) == 7

    def test_value_equal_to_max_returned_as_is(self):
        assert self.uc._resolve_limit(MAX_LIMIT) == MAX_LIMIT

    def test_value_above_max_clamped(self):
        assert self.uc._resolve_limit(MAX_LIMIT + 50) == MAX_LIMIT

    def test_zero_raises(self):
        with pytest.raises(ValueError):
            self.uc._resolve_limit(0)

    def test_negative_raises(self):
        with pytest.raises(ValueError):
            self.uc._resolve_limit(-100)
