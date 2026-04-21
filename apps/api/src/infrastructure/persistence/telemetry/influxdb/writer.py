from influxdb_client import Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

from domain.streetlight.events import TelemetryReport
from infrastructure.persistence.error import PersistenceError
from infrastructure.persistence.telemetry.influxdb.client import (
    InfluxClientManager
)
from libs.config import settings


class InfluxTelemetryWriter:
    def __init__(self, bucket: str = settings.INFLUX_BUCKET):
        self.bucket = bucket
        self._write_api = InfluxClientManager.get_client().write_api(
            write_options=SYNCHRONOUS
        )

    def write(self, event: TelemetryReport) -> None:
        point = (
            Point("streetlight_metrics")
            .tag("tenant_id", event.tenant_id)
            .tag("streetlight_id", event.streetlight_id)
            .tag("site_id", event.site_id)
            .field("lux", float(event.lux))
            .field("temperature_c", int(event.temperature_c))
            .field("humidity_pct", int(event.humidity))
            .field("motion", int(event.motion_detected))
            .field("light_level_pct", int(event.light_level))
            .time(int(event.timestamp.timestamp()), WritePrecision.S)
        )
        try:
            self._write_api.write(bucket=self.bucket, record=point)
        except Exception as e:
            raise PersistenceError(
                f"InfluxDB write failed: {e}"
            ) from e
