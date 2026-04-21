"""
ProcessUplink application use case.

Orchestrates the telemetry pipeline for a decoded streetlight event.
Handles all three event types: TelemetryReport, Heartbeat, CommandResponse.
"""

from __future__ import annotations
from typing import Protocol

from application.streetlight.responses import (
    heartbeat_to_ws_message,
    telemetry_to_ws_message,
)
from domain.streetlight.events import (
    CommandResponse,
    Heartbeat,
    StreetlightEvent,
    TelemetryReport,
)
from domain.streetlight.health import HealthStatus


class TelemetryWriter(Protocol):
    def write(self, report: TelemetryReport) -> None: ...


class StreetlightRepo(Protocol):
    def update_state(
        self, report: TelemetryReport, health: HealthStatus
    ) -> None: ...

    def update_last_seen(
        self, tenant_id: str, streetlight_id: str
    ) -> None: ...


class WebSocketPublisher(Protocol):
    def broadcast(self, connections: list, message: dict) -> None: ...


class WebSocketConnectionRepo(Protocol):
    def get_connections_for_streetlight(
        self,
        tenant_id: str,
        streetlight_id: str,
    ) -> list: ...


class CommandRepo(Protocol):
    def update_status(
        self,
        streetlight_id: str,
        echo_cmd: int,
        response: str,
        reason: str,
    ) -> None: ...


class ProcessUplink:
    """
    Processes a decoded streetlight event.

    Routing:
      TelemetryReport - write time-series, update device state, broadcast WS
      Heartbeat       - update last_seen only
      CommandResponse - update command audit record
    """

    def __init__(
        self,
        telemetry_writer: TelemetryWriter,
        streetlight_repo: StreetlightRepo,
        ws_publisher: WebSocketPublisher,
        ws_repo: WebSocketConnectionRepo,
        command_repo: CommandRepo,
    ) -> None:
        self._telemetry_writer = telemetry_writer
        self._streetlight_repo = streetlight_repo
        self._ws_publisher = ws_publisher
        self._ws_repo = ws_repo
        self._command_repo = command_repo

    def execute(self, event: StreetlightEvent) -> None:
        match event:
            case TelemetryReport():
                self._handle_telemetry(event)
            case Heartbeat():
                self._handle_heartbeat(event)
            case CommandResponse():
                self._handle_command_response(event)
            case _:
                raise TypeError(f"Unhandled event type: {type(event)}")

    def _handle_telemetry(self, event: TelemetryReport) -> None:
        self._telemetry_writer.write(event)

        health = event.diagnostics.evaluate_status()
        self._streetlight_repo.update_state(event, health)

        connections = self._ws_repo.get_connections_for_streetlight(
            tenant_id=event.tenant_id,
            streetlight_id=event.streetlight_id,
        )
        if connections:
            self._ws_publisher.broadcast(
                connections,
                telemetry_to_ws_message(event, health),
            )

    def _handle_heartbeat(self, event: Heartbeat) -> None:
        self._streetlight_repo.update_last_seen(
            tenant_id=event.tenant_id,
            streetlight_id=event.streetlight_id,
        )
        connections = self._ws_repo.get_connections_for_streetlight(
            tenant_id=event.tenant_id,
            streetlight_id=event.streetlight_id,
        )
        if connections:
            self._ws_publisher.broadcast(
                connections,
                heartbeat_to_ws_message(event),
            )

    def _handle_command_response(self, event: CommandResponse) -> None:
        self._command_repo.update_status(
            streetlight_id=event.streetlight_id,
            echo_cmd=event.echo_cmd,
            response=event.response.name,
            reason=event.reason.name,
        )
