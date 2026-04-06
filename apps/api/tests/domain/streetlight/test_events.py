import pytest
from datetime import datetime, timezone

from domain.streetlight.events import (
    TelemetryReport,
    SensorReadings,
    Heartbeat,
    CommandResponse,
    ResponseCode,
    ReasonCode
)
from domain.streetlight.health import SensorDiagnostics, SensorHealth


AWARE_TS = datetime(2026, 4, 5, 12, 0, 0, tzinfo=timezone.utc)
NAIVE_TS = datetime(2026, 4, 5, 12, 0, 0)


@pytest.fixture
def valid_diagnostics():
    return SensorDiagnostics(
        ambient_health=SensorHealth.SYSTEM_OK,
        mmwave_health=SensorHealth.SYSTEM_OK,
        th_ok=True,
        light_ok=True,
        overall_ok=True
    )


class TestSensorReadings:
    def test_valid_readings(self):
        readings = SensorReadings(
            lux=500.5,
            temperature_c=25,
            humidity=50,
            light_level=100,
            motion=True
        )
        assert readings.lux == 500.5
        assert readings.temperature_c == 25

    @pytest.mark.parametrize("field, value, expected_msg", [
        ("lux", -1, "Lux must be 0 and 1000"),
        ("lux", 1001, "Lux must be 0 and 1000"),
        ("temperature_c", -129, "Temperature must be -128 to 127"),
        ("temperature_c", 128, "Temperature must be -128 to 127"),
        ("humidity", -1, "Humidity must be 0-100%"),
        ("humidity", 101, "Humidity must be 0-100%"),
        ("light_level", -1, "Light level must be 0-100%"),
        ("light_level", 101, "Light level must be 0-100%"),
    ])
    def test_invalid_ranges(self, field, value, expected_msg):
        data = {
            "lux": 100,
            "temperature_c": 20,
            "humidity": 50,
            "light_level": 50,
            "motion": False
        }
        data[field] = value
        with pytest.raises(ValueError, match=expected_msg):
            SensorReadings(**data)


class TestTelemetryReport:
    def test_timestamp_tz_validation(self, valid_diagnostics):
        readings = SensorReadings(10, 20, 30, 40, False)
        with pytest.raises(
            ValueError, match="timestamp must be timezone aware"
        ):
            TelemetryReport(
                "L-1", "T-1", "S-1", NAIVE_TS, readings, valid_diagnostics
            )

    def test_convenience_properties(self, valid_diagnostics):
        readings = SensorReadings(
            lux=1.5,
            temperature_c=10,
            humidity=20,
            light_level=30,
            motion=True
        )
        report = TelemetryReport(
            "L-1", "T-1", "S-1", AWARE_TS, readings, valid_diagnostics
        )

        assert report.lux == 1.5
        assert report.temperature_c == 10
        assert report.motion is True


class TestHeartbeat:
    def test_valid_heartbeat(self):
        hb = Heartbeat("L-1", "T-1", "S-1", AWARE_TS)
        assert hb.streetlight_id == "L-1"

    def test_invalid_heartbeat_timestamp(self):
        with pytest.raises(
            ValueError, match="timestamp must be timezone aware"
        ):
            Heartbeat("L-1", "T-1", "S-1", NAIVE_TS)


class TestCommandResponse:
    def test_ack_logic(self):
        res = CommandResponse(
            "L-1", "T-1",
            AWARE_TS, ResponseCode.ACK, 0x01, ReasonCode.OK
        )
        assert res.is_ack is True
        assert res.is_nack is False

    def test_nack_logic(self):
        res = CommandResponse(
            "L-1", "T-1",
            AWARE_TS, ResponseCode.NACK, 0x01, ReasonCode.FSM_ERROR
        )
        assert res.is_nack is True
        assert res.is_ack is False

    def test_invalid_nack_with_ok_reason(self):
        with pytest.raises(
            ValueError, match="NACK requires a non-OK reason"
        ):
            CommandResponse(
                "L-1", "T-1",
                AWARE_TS, ResponseCode.NACK, 0x01, ReasonCode.OK
            )

    def test_immutability(self):
        res = CommandResponse(
            "L-1", "T-1", AWARE_TS, ResponseCode.ACK, 0x01, ReasonCode.OK
        )
        with pytest.raises(AttributeError):
            res.response = ResponseCode.NACK
