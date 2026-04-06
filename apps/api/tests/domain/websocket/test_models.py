import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
from dataclasses import FrozenInstanceError

from domain.websocket.models import WebSocketConnection


@pytest.fixture
def sample_connection():
    return WebSocketConnection(
        tenant_id="tenant-123",
        user_id="user-456",
        connection_id="conn-abc",
        connected_at=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    )


class TestWebSocketConnection:
    def test_initialization(self, sample_connection):
        assert sample_connection.tenant_id == "tenant-123"
        assert sample_connection.connection_id == "conn-abc"

    def test_immutability(self, sample_connection):
        with pytest.raises(FrozenInstanceError):
            sample_connection.user_id = "new-user"

    def test_is_active_true(self, sample_connection):
        now_mock = sample_connection.connected_at + timedelta(minutes=30)

        with patch("domain.websocket.models.datetime") as mock_datetime:
            mock_datetime.now.return_value = now_mock
            assert sample_connection.is_active(timeout_minutes=60) is True

    def test_is_active_false(self, sample_connection):
        now_mock = sample_connection.connected_at + timedelta(minutes=121)

        with patch("domain.websocket.models.datetime") as mock_datetime:
            mock_datetime.now.return_value = now_mock
            assert sample_connection.is_active(timeout_minutes=120) is False

    def test_default_timeout(self, sample_connection):
        # 119 minutes later -> True
        now_active = sample_connection.connected_at + timedelta(minutes=119)
        # 121 minutes later -> False
        now_expired = sample_connection.connected_at + timedelta(minutes=121)

        with patch("domain.websocket.models.datetime") as mock_datetime:
            mock_datetime.now.return_value = now_active
            assert sample_connection.is_active() is True

            mock_datetime.now.return_value = now_expired
            assert sample_connection.is_active() is False
