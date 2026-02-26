import pytest
from datetime import datetime, timezone, timedelta
from domain.websocket.models import WebSocketConnection


@pytest.fixture
def connection():
    return WebSocketConnection(
        tenant_id="tenant-001",
        user_id="u-123",
        connection_id="abc123==",
        connected_at=datetime.now(timezone.utc),
    )


def test_is_active_fresh_connection(connection):
    assert connection.is_active() is True


def test_is_active_within_timeout():
    connected_at = datetime.now(timezone.utc) - timedelta(minutes=60)
    conn = WebSocketConnection(
        tenant_id="tenant-001",
        user_id="u-123",
        connection_id="abc123==",
        connected_at=connected_at,
    )
    assert conn.is_active() is True


def test_is_active_expired():
    connected_at = datetime.now(timezone.utc) - timedelta(minutes=121)
    conn = WebSocketConnection(
        tenant_id="tenant-001",
        user_id="u-123",
        connection_id="abc123==",
        connected_at=connected_at,
    )
    assert conn.is_active() is False


def test_is_active_exactly_at_timeout():
    connected_at = datetime.now(timezone.utc) - timedelta(minutes=120)
    conn = WebSocketConnection(
        tenant_id="tenant-001",
        user_id="u-123",
        connection_id="abc123==",
        connected_at=connected_at,
    )
    assert conn.is_active() is False


def test_is_active_custom_timeout(connection):
    assert connection.is_active(timeout_minutes=1) is True


def test_is_active_custom_timeout_expired():
    connected_at = datetime.now(timezone.utc) - timedelta(minutes=31)
    conn = WebSocketConnection(
        tenant_id="tenant-001",
        user_id="u-123",
        connection_id="abc123==",
        connected_at=connected_at,
    )
    assert conn.is_active(timeout_minutes=30) is False
