import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
from dataclasses import FrozenInstanceError

from domain.websocket.models import WebSocketConnection


@pytest.fixture
def connection():
    return WebSocketConnection(
        tenant_id="tenant-123",
        user_id="user-456",
        connection_id="conn-abc",
        connected_at=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc),
    )


class TestWebSocketConnection:
    def test_fields(self, connection):
        assert connection.tenant_id == "tenant-123"
        assert connection.user_id == "user-456"
        assert connection.connection_id == "conn-abc"

    def test_immutable(self, connection):
        with pytest.raises(FrozenInstanceError):
            connection.user_id = "new-user"

    def test_naive_datetime_raises(self):
        with pytest.raises(ValueError, match="timezone aware"):
            WebSocketConnection(
                tenant_id="t",
                user_id="u",
                connection_id="c",
                connected_at=datetime(2026, 1, 1, 12, 0),  # naive
            )


class TestIsActive:
    def _make(self, connected_at: datetime) -> WebSocketConnection:
        return WebSocketConnection(
            tenant_id="t",
            user_id="u",
            connection_id="c",
            connected_at=connected_at,
        )

    def _now(
        self,
        connection: WebSocketConnection,
        offset_minutes: int
    ) -> datetime:
        return connection.connected_at + timedelta(minutes=offset_minutes)

    def test_active_within_window(self, connection):
        with patch("domain.websocket.models.datetime") as mock_dt:
            mock_dt.now.return_value = self._now(connection, 30)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            assert connection.is_active(timeout_minutes=60) is True

    def test_expired_outside_window(self, connection):
        with patch("domain.websocket.models.datetime") as mock_dt:
            mock_dt.now.return_value = self._now(connection, 121)
            assert connection.is_active(timeout_minutes=120) is False

    def test_exact_boundary_is_inactive(self, connection):
        with patch("domain.websocket.models.datetime") as mock_dt:
            mock_dt.now.return_value = self._now(connection, 120)
            assert connection.is_active(timeout_minutes=120) is False

    def test_default_timeout_active(self, connection):
        with patch("domain.websocket.models.datetime") as mock_dt:
            mock_dt.now.return_value = self._now(connection, 119)
            assert connection.is_active() is True

    def test_default_timeout_expired(self, connection):
        with patch("domain.websocket.models.datetime") as mock_dt:
            mock_dt.now.return_value = self._now(connection, 121)
            assert connection.is_active() is False
