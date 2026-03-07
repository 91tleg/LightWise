from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
import pytest

from domain.iot.models import IoTUplink
from domain.streetlight.health import HealthStatus
from domain.telemetry.models import TelemetryPayload
from application.telemetry.process_telemetry import (
    ProcessTelemetry
)


@pytest.fixture
def mock_telemetry_writer():
    return MagicMock()


@pytest.fixture
def mock_streetlights_repo():
    return MagicMock()


@pytest.fixture
def mock_websocket_publisher():
    return MagicMock()


@pytest.fixture
def mock_ws_repo():
    return MagicMock()


@pytest.fixture
def processor(
    mock_telemetry_writer,
    mock_streetlights_repo,
    mock_websocket_publisher,
    mock_ws_repo,
):
    return ProcessTelemetry(
        telemetry_writer=mock_telemetry_writer,
        streetlights_repo=mock_streetlights_repo,
        websocket_publisher=mock_websocket_publisher,
        ws_repo=mock_ws_repo,
    )


@pytest.fixture
def uplink():
    return IoTUplink(
        streetlight_id="LW-00001",
        tenant_id="TENANT#abc",
        site_id="CITY#SF",
        payload_bytes=b"\x01\x02\x03",
    )


def make_payload(
    overall_ok=True,
    system_degraded=False,
    ambient_secondary_ok=True,
    motion_secondary_ok=True,
) -> TelemetryPayload:
    return TelemetryPayload(
        tenant_id="TENANT#abc",
        streetlight_id="LW-00001",
        lux=134.2,
        temperature_c=22,
        humidity=48,
        motion=False,
        light_level=80,
        timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc),
        overall_ok=overall_ok,
        system_degraded=system_degraded,
        ambient_secondary_ok=ambient_secondary_ok,
        motion_secondary_ok=motion_secondary_ok,
    )


class TestExecuteRaw:
    def test_decodes_and_delegates_to_execute(
        self, processor, uplink
    ):
        payload = make_payload()
        with patch(
            "application.telemetry.process_telemetry.decode_uplink",
            return_value=payload,
        ) as mock_decode:
            processor.execute_raw(uplink, uplink.payload_bytes)

            mock_decode.assert_called_once_with(
                tenant_id=uplink.tenant_id,
                streetlight_id=uplink.streetlight_id,
                bytes_payload=uplink.payload_bytes,
            )

    def test_calls_execute_with_decoded_payload(
        self, processor, uplink
    ):
        payload = make_payload()
        with patch(
            "application.telemetry.process_telemetry.decode_uplink",
            return_value=payload,
        ):
            with patch.object(processor, "execute") as mock_execute:
                processor.execute_raw(uplink, uplink.payload_bytes)
                mock_execute.assert_called_once_with(payload)


class TestExecute:
    def test_writes_telemetry(
        self, processor, mock_telemetry_writer
    ):
        payload = make_payload()
        processor.mock_ws_repo = processor.ws_repo
        processor.ws_repo.get_connections_for_streetlight.return_value = []

        processor.execute(payload)

        mock_telemetry_writer.write.assert_called_once_with(payload)

    def test_updates_streetlight_repo(
        self, processor, mock_streetlights_repo
    ):
        payload = make_payload()
        processor.ws_repo.get_connections_for_streetlight.return_value = []

        processor.execute(payload)

        mock_streetlights_repo.update.assert_called_once_with(
            payload, HealthStatus.OK
        )

    def test_broadcasts_to_websocket(
        self, processor, mock_websocket_publisher, mock_ws_repo
    ):
        payload = make_payload()
        connections = ["conn-1", "conn-2"]
        get_conns = mock_ws_repo.get_connections_for_streetlight
        get_conns.return_value = connections

        processor.execute(payload)

        get_conns.assert_called_once_with(
            tenant_id=payload.tenant_id,
            streetlight_id=payload.streetlight_id,
        )
        mock_websocket_publisher.broadcast.assert_called_once()
        args = mock_websocket_publisher.broadcast.call_args
        assert args[0][0] == connections

    def test_broadcast_message_includes_health(
        self, processor, mock_websocket_publisher, mock_ws_repo
    ):
        payload = make_payload()
        mock_ws_repo.get_connections_for_streetlight.return_value = []

        processor.execute(payload)

        msg = mock_websocket_publisher.broadcast.call_args[0][1]
        assert "health" in msg
        assert msg["health"] == HealthStatus.OK.value

    def test_no_broadcast_when_no_connections(
        self, processor, mock_websocket_publisher, mock_ws_repo
    ):
        payload = make_payload()
        mock_ws_repo.get_connections_for_streetlight.return_value = []

        processor.execute(payload)

        mock_websocket_publisher.broadcast.assert_called_once_with(
            [], payload.to_dict() | {"health": HealthStatus.OK.value}
        )


class TestEvaluateHealth:
    def test_ok_when_all_flags_healthy(self):
        payload = make_payload()
        assert ProcessTelemetry._evaluate_health(
            payload
        ) == HealthStatus.OK

    def test_critical_when_overall_not_ok(self):
        payload = make_payload(overall_ok=False)
        assert ProcessTelemetry._evaluate_health(
            payload
        ) == HealthStatus.CRITICAL

    def test_critical_when_system_degraded(self):
        payload = make_payload(system_degraded=True)
        assert ProcessTelemetry._evaluate_health(
            payload
        ) == HealthStatus.CRITICAL

    def test_degraded_when_ambient_secondary_not_ok(self):
        payload = make_payload(ambient_secondary_ok=False)
        assert ProcessTelemetry._evaluate_health(
            payload
        ) == HealthStatus.DEGRADED

    def test_degraded_when_motion_secondary_not_ok(self):
        payload = make_payload(motion_secondary_ok=False)
        assert ProcessTelemetry._evaluate_health(
            payload
        ) == HealthStatus.DEGRADED

    def test_critical_takes_priority_over_degraded(self):
        payload = make_payload(
            overall_ok=False, ambient_secondary_ok=False
        )
        assert ProcessTelemetry._evaluate_health(
            payload
        ) == HealthStatus.CRITICAL
