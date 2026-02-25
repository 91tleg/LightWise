from functools import lru_cache
from domain.telemetry.health import HealthStatus
from domain.telemetry.models import TelemetryPayload

from infrastructure.persistence.dynamo.device_state_repo import (
    DeviceStateRepo,
    get_device_state_repository,
)
from infrastructure.persistence.dynamo.tenant_repo import (
    TenantRepository,
    get_tenant_repository,
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
        device_state_repo: DeviceStateRepo,
        websocket_publisher: SensorEventPublisher,
        tenant_repo: TenantRepository,
        ws_repo: WebSocketConnectionRepo
    ):
        self.timestream = timestream_writer
        self.device_state_repo = device_state_repo
        self.websocket = websocket_publisher
        self.tenant_repo = tenant_repo
        self.ws_repo = ws_repo

    def execute_raw(self, dev_eui: str, raw_bytes: bytes) -> None:
        """
        Entry point for raw uplink data.
        Translates infrastructure input into a domain event and
        delegates processing.
        """
        # 1. Resolve Identity
        tenant_id = self.tenant_repo.get_tenant_for_device(dev_eui)

        # 2. Decode Infrastructure bytes into Domain Payload
        # IDs are injected so the domain event is self-contained
        event = decode_uplink(
            tenant_id=tenant_id,
            device_id=dev_eui,
            bytes_payload=raw_bytes
        )

        # 3. Hand off to the standard execution logic
        self.execute(event)

    def execute(self, event: TelemetryPayload) -> None:
        """Processes a validated and decoded TelemetryPayload."""
        # Archive to Timestream
        self.timestream.write(event)

        # Update Current State
        health = self._evaluate_health(event)
        self.device_state_repo.update(event.device_id, event, health)

        # Broadcast to WebSockets
        msg = event.to_dict()
        msg["health"] = health.value

        connections = self.ws_repo.get_connections_for_streetlight(
            event.device_id,
            event.tenant_id
        )

        self.websocket.broadcast(connections, msg)

    @staticmethod
    def _evaluate_health(event: TelemetryPayload) -> HealthStatus:
        """
        Derives a coarse-grained health status from telemetry signals.
        """
        if not event.overall_ok or event.system_degraded:
            return HealthStatus.CRITICAL

        if not event.ambient_secondary_ok or not event.motion_secondary_ok:
            return HealthStatus.DEGRADED

        return HealthStatus.OK


@lru_cache(maxsize=1)
def get_telemetry_processor() -> ProcessTelemetry:
    """
    Application service factory.
    Wires infrastructure adapters to the telemetry use case.
    """
    return ProcessTelemetry(
        timestream_writer=TimestreamWriter(),
        device_state_repo=get_device_state_repository(),
        websocket_publisher=SensorEventPublisher(),
        tenant_repo=get_tenant_repository(),
        ws_repo=get_websocket_connection_repository()
    )
