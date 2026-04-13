from __future__ import annotations
from datetime import datetime, timezone
from unittest.mock import MagicMock
import pytest

from application.streetlight.process_uplink import ProcessUplink
from domain.streetlight.events import (
    CommandResponse,
    Heartbeat,
    ReasonCode,
    ResponseCode,
    SensorReadings,
    TelemetryReport,
)
from domain.streetlight.health import (
    HealthStatus,
    SensorDiagnostics,
    SensorHealth,
)


_NOW = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

_DIAGNOSTICS_OK = SensorDiagnostics(
    ambient_health=SensorHealth.SYSTEM_OK,
    mmwave_health=SensorHealth.SYSTEM_OK,
    th_ok=True,
    light_ok=True,
    overall_ok=True,
)

_READINGS = SensorReadings(
    lux=123.4,
    temperature_c=22,
    humidity=55,
    light_level=80,
    motion_detected=False,
)

_TELEMETRY = TelemetryReport(
    streetlight_id="sl-001",
    tenant_id="tenant-1",
    site_id="site-1",
    timestamp=_NOW,
    readings=_READINGS,
    diagnostics=_DIAGNOSTICS_OK,
    rssi=-70,
    snr=8.0,
)

_HEARTBEAT = Heartbeat(
    streetlight_id="sl-001",
    tenant_id="tenant-1",
    site_id="site-1",
    timestamp=_NOW,
)

_ACK = CommandResponse(
    streetlight_id="sl-001",
    tenant_id="tenant-1",
    timestamp=_NOW,
    response=ResponseCode.ACK,
    echo_cmd=0x01,
    reason=ReasonCode.OK,
)

_NACK = CommandResponse(
    streetlight_id="sl-001",
    tenant_id="tenant-1",
    timestamp=_NOW,
    response=ResponseCode.NACK,
    echo_cmd=0x01,
    reason=ReasonCode.INVALID_CMD,
)


def _use_case(
    connections: list | None = None
) -> tuple[ProcessUplink, MagicMock, MagicMock,
           MagicMock, MagicMock, MagicMock]:
    telemetry_writer = MagicMock()
    streetlight_repo = MagicMock()
    ws_publisher = MagicMock()
    ws_repo = MagicMock()
    ws_repo.get_connections_for_streetlight.return_value = (
        connections if connections is not None else []
    )
    command_repo = MagicMock()
    use_case = ProcessUplink(
        telemetry_writer=telemetry_writer,
        streetlight_repo=streetlight_repo,
        ws_publisher=ws_publisher,
        ws_repo=ws_repo,
        command_repo=command_repo,
    )
    return (use_case, telemetry_writer, streetlight_repo,
            ws_publisher, ws_repo, command_repo)


class TestTelemetryReport:
    def test_writes_to_influx(self):
        use_case, writer, _, _, _, _ = _use_case()
        use_case.execute(_TELEMETRY)
        writer.write.assert_called_once_with(_TELEMETRY)

    def test_updates_streetlight_state(self):
        use_case, _, repo, _, _, _ = _use_case()
        use_case.execute(_TELEMETRY)
        repo.update_state.assert_called_once()
        args = repo.update_state.call_args
        assert args[0][0] == _TELEMETRY
        assert isinstance(args[0][1], HealthStatus)

    def test_health_derived_from_diagnostics(self):
        use_case, _, repo, _, _, _ = _use_case()
        use_case.execute(_TELEMETRY)
        _, health = repo.update_state.call_args[0]
        assert health == _DIAGNOSTICS_OK.evaluate_status()

    def test_broadcasts_when_connections_exist(self):
        connections = [{"connection_id": "conn-1"}]
        use_case, _, _, publisher, _, _ = _use_case(connections=connections)
        use_case.execute(_TELEMETRY)
        publisher.broadcast.assert_called_once()
        call_connections, _ = publisher.broadcast.call_args[0]
        assert call_connections == connections

    def test_no_broadcast_when_no_connections(self):
        use_case, _, _, publisher, _, _ = _use_case(connections=[])
        use_case.execute(_TELEMETRY)
        publisher.broadcast.assert_not_called()

    def test_ws_repo_queried_with_correct_identity(self):
        use_case, _, _, _, ws_repo, _ = _use_case()
        use_case.execute(_TELEMETRY)
        ws_repo.get_connections_for_streetlight.assert_called_once_with(
            tenant_id="tenant-1",
            streetlight_id="sl-001",
        )

    def test_heartbeat_repos_not_called(self):
        use_case, _, repo, _, _, command_repo = _use_case()
        use_case.execute(_TELEMETRY)
        repo.update_last_seen.assert_not_called()
        command_repo.update_status.assert_not_called()


class TestHeartbeat:
    def test_updates_last_seen(self):
        use_case, _, repo, _, _, _ = _use_case()
        use_case.execute(_HEARTBEAT)
        repo.update_last_seen.assert_called_once_with(
            tenant_id="tenant-1",
            streetlight_id="sl-001",
        )

    def test_telemetry_not_written(self):
        use_case, writer, _, _, _, _ = _use_case()
        use_case.execute(_HEARTBEAT)
        writer.write.assert_not_called()

    def test_ws_not_broadcast(self):
        use_case, _, _, publisher, _, _ = _use_case()
        use_case.execute(_HEARTBEAT)
        publisher.broadcast.assert_not_called()

    def test_command_repo_not_called(self):
        use_case, _, _, _, _, command_repo = _use_case()
        use_case.execute(_HEARTBEAT)
        command_repo.update_status.assert_not_called()


class TestCommandResponse:
    def test_ack_updates_command_status(self):
        use_case, _, _, _, _, command_repo = _use_case()
        use_case.execute(_ACK)
        command_repo.update_status.assert_called_once_with(
            streetlight_id="sl-001",
            echo_cmd=0x01,
            response="ACK",
            reason="OK",
        )

    def test_nack_updates_command_status(self):
        use_case, _, _, _, _, command_repo = _use_case()
        use_case.execute(_NACK)
        command_repo.update_status.assert_called_once_with(
            streetlight_id="sl-001",
            echo_cmd=0x01,
            response="NACK",
            reason="INVALID_CMD",
        )

    def test_telemetry_not_written(self):
        use_case, writer, _, _, _, _ = _use_case()
        use_case.execute(_ACK)
        writer.write.assert_not_called()

    def test_last_seen_not_updated(self):
        use_case, _, repo, _, _, _ = _use_case()
        use_case.execute(_ACK)
        repo.update_last_seen.assert_not_called()


class TestUnhandledEvent:
    def test_raises_type_error_for_unknown_event(self):
        use_case, _, _, _, _, _ = _use_case()
        with pytest.raises(TypeError, match="Unhandled event type"):
            use_case.execute("not_an_event")
