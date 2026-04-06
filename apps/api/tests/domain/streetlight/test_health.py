import pytest

from domain.streetlight.health import (
    HealthStatus, SensorHealth, SensorDiagnostics
)


class TestSensorHealth:
    def test_health_properties(self):
        assert SensorHealth.SYSTEM_OK.is_ok is True
        assert SensorHealth.DEGRADED.is_degraded is True
        assert SensorHealth.PRIMARY_FAIL.is_failed is True
        assert SensorHealth.TOTAL_FAILURE.is_failed is True


class TestSensorDiagnostics:
    @pytest.fixture
    def healthy_sensors(self):
        return {
            "ambient_health": SensorHealth.SYSTEM_OK,
            "mmwave_health": SensorHealth.SYSTEM_OK,
            "th_ok": True,
            "light_ok": True,
            "overall_ok": True
        }

    def test_evaluate_status_ok(self, healthy_sensors):
        diag = SensorDiagnostics(**healthy_sensors)
        assert diag.evaluate_status() == HealthStatus.OK

    def test_evaluate_status_degraded(self, healthy_sensors):
        healthy_sensors["ambient_health"] = SensorHealth.DEGRADED
        diag = SensorDiagnostics(**healthy_sensors)
        assert diag.evaluate_status() == HealthStatus.DEGRADED

    @pytest.mark.parametrize("fault_change", [
        {"overall_ok": False},
        {"light_ok": False},
        {"th_ok": False},
        {"mmwave_health": SensorHealth.PRIMARY_FAIL},
        {"ambient_health": SensorHealth.TOTAL_FAILURE}
    ])
    def test_evaluate_status_critical(self, healthy_sensors, fault_change):
        # Any single critical failure should trigger CRITICAL status
        healthy_sensors.update(fault_change)
        diag = SensorDiagnostics(**healthy_sensors)
        assert diag.evaluate_status() == HealthStatus.CRITICAL

    def test_any_sensor_failed_logic(self, healthy_sensors):
        healthy_sensors["th_ok"] = False
        diag = SensorDiagnostics(**healthy_sensors)
        assert diag.any_sensor_failed is True
        assert diag.evaluate_status() == HealthStatus.CRITICAL
