from functools import lru_cache

from domain.streetlight.health import HealthStatus
from domain.telemetry.models import TelemetryPayload
from infrastructure.persistence.dynamo.streetlights_repo import (
    StreetlightsRepo,
    get_streetlights_repository,
)
from infrastructure.persistence.dynamo.websocket_connection_repo import (
    WebSocketConnectionRepo,
    get_websocket_connection_repository,
)
from infrastructure.persistence.timestream.writer import TimestreamWriter
from infrastructure.websocket.publisher import SensorEventPublisher
from infrastructure.telemetry.lorawan_decoder import decode_uplink


class ProcessTelemetry:
    def __init__(
        self,
        timestream_writer: TimestreamWriter,
        streetlights_repo: StreetlightsRepo,
        websocket_publisher: SensorEventPublisher,
        ws_repo: WebSocketConnectionRepo,
    ):
        self.timestream = timestream_writer
        self.streetlight_repo = streetlights_repo
        self.websocket = websocket_publisher
        self.ws_repo = ws_repo

    def execute_raw(self, dev_eui: str, raw_bytes: bytes) -> None:
        """
        Entry point for raw uplink data.
        Translates infrastructure input into a domain event and
        delegates processing.
        """
        tenant_id = self.streetlight_repo.get_tenant_id(dev_eui)
        event = decode_uplink(
            tenant_id=tenant_id,
            streetlight_id=dev_eui,
            bytes_payload=raw_bytes,
        )
        self.execute(event)

    def execute(self, event: TelemetryPayload) -> None:
        """Processes a validated and decoded TelemetryPayload."""
        self.timestream.write(event)

        health = self._evaluate_health(event)
        self.streetlight_repo.update(event, health)

        msg = event.to_dict()
        msg["health"] = health.value

        connections = self.ws_repo.get_connections_for_streetlight(
            tenant_id=event.tenant_id,
            streetlight_id=event.streetlight_id,
        )
        self.websocket.broadcast(connections, msg)

    @staticmethod
    def _evaluate_health(event: TelemetryPayload) -> HealthStatus:
        if not event.overall_ok or event.system_degraded:
            return HealthStatus.CRITICAL
        if not event.ambient_secondary_ok or not event.motion_secondary_ok:
            return HealthStatus.DEGRADED
        return HealthStatus.OK


@lru_cache(maxsize=1)
def get_telemetry_processor() -> ProcessTelemetry:
    return ProcessTelemetry(
        timestream_writer=TimestreamWriter(),
        streetlights_repo=get_streetlights_repository(),
        websocket_publisher=SensorEventPublisher(),
        ws_repo=get_websocket_connection_repository(),
    )
