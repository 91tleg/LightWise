import boto3
from botocore.exceptions import BotoCoreError, ClientError
from libs.config import settings
from domain.telemetry.models import TelemetryPayload
from domain.error import PersistenceError
from .client import get_write_client


class TimestreamWriter:
    """Write telemetry events to Timestream."""

    def __init__(self, database: str = settings.TS_DATABASE, table: str = settings.TS_TABLE):
        self.database = database
        self.table = table
        self.client = get_write_client()

    def write(self, event: TelemetryPayload) -> None:
        """Write a single telemetry event."""
        record = {
            "Dimensions": [
                {"Name": "tenantId", "Value": event.tenant_id},
                {"Name": "deviceId", "Value": event.device_id},
            ],
            "Time": str(int(event.timestamp.timestamp() * 1000)), # milliseconds is standard
            "MeasureName": "streetlight_telemetry",
            "MeasureValueType": "MULTI",
            "MeasureValues": [
                {"Name": "lux", "Value": str(event.lux), "Type": "DOUBLE"},
                {"Name": "temperature", "Value": str(event.temperature_c), "Type": "BIGINT"},
                {"Name": "humidity", "Value": str(event.humidity), "Type": "BIGINT"},
                {"Name": "motion", "Value": str(int(event.motion)), "Type": "BIGINT"},
                {"Name": "light_level", "Value": str(event.light_level), "Type": "BIGINT"},
            ],
        }

        try:
            self.client.write_records(
                DatabaseName=self.database,
                TableName=self.table,
                Records=[record],
            )
        except (BotoCoreError, ClientError) as exc:
            raise PersistenceError(f"Timestream write failed: {exc}") from exc
