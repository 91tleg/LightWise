"""
SendStreetlightCommand application use case.

Coordinates business validation, command audit persistence, payload
encoding, and downlink dispatch through protocol-based dependencies.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Protocol

from domain.streetlight.commands import (
    StreetlightCommand,
    parse_command_name,
    parse_command_params,
)
from domain.streetlight.models import StreetlightMetadata


class InvalidCommandError(ValueError):
    """The requested command name is not recognised."""


class InvalidCommandParamsError(ValueError):
    """The requested command parameters failed domain validation."""


class StreetlightNotFoundError(ValueError):
    """The streetlight does not exist in the tenant scope."""


class MissingWirelessDeviceIdError(ValueError):
    """The streetlight cannot receive downlink without wireless device id."""


@dataclass(frozen=True)
class DispatchedCommand:
    """
    Result of a successfully dispatched command.
    Status is always 'pending' at dispatch time — the device ACK/NACK
    arrives later via WebSocket command.ack push.
    """
    command_id: str
    streetlight_id: str
    command: str
    status: str = "pending"


class StreetlightMetadataRepo(Protocol):
    def get(
        self, tenant_id: str, streetlight_id: str
    ) -> StreetlightMetadata | None: ...


class DownlinkCommandRepo(Protocol):
    def write(
        self,
        streetlight_id: str,
        command_id: str,
        tenant_id: str,
        issued_by: str,
        command: StreetlightCommand,
        ttl: int,
    ) -> None: ...

    def mark_sent(self, streetlight_id: str, command_id: str) -> None: ...


class DownlinkSender(Protocol):
    def send(self, wireless_device_id: str, payload: bytes) -> None: ...


class DownlinkPayloadEncoder(Protocol):
    def encode(self, command: StreetlightCommand) -> bytes: ...


def _default_command_id() -> str:
    return f"cmd-{time.time_ns():020d}-{uuid.uuid4().hex}"


def _default_epoch_seconds() -> int:
    return int(time.time())


class SendStreetlightCommand:
    def __init__(
        self,
        metadata_repo: StreetlightMetadataRepo,
        command_repo: DownlinkCommandRepo,
        downlink_sender: DownlinkSender,
        payload_encoder: DownlinkPayloadEncoder,
        command_id_factory=_default_command_id,
        epoch_seconds=_default_epoch_seconds,
        pending_ttl_seconds: int = 300,
    ) -> None:
        self._metadata_repo = metadata_repo
        self._command_repo = command_repo
        self._downlink_sender = downlink_sender
        self._payload_encoder = payload_encoder
        self._command_id_factory = command_id_factory
        self._epoch_seconds = epoch_seconds
        self._pending_ttl_seconds = pending_ttl_seconds

    def execute(
        self,
        tenant_id: str,
        issued_by: str,
        streetlight_id: str,
        command: str,
        params: object,
    ) -> DispatchedCommand:
        try:
            downlink_cmd = parse_command_name(command)
        except ValueError as exc:
            raise InvalidCommandError(str(exc)) from exc

        try:
            streetlight_command = parse_command_params(downlink_cmd, params)
        except ValueError as exc:
            raise InvalidCommandParamsError(str(exc)) from exc

        metadata = self._metadata_repo.get(tenant_id, streetlight_id)
        if not metadata:
            raise StreetlightNotFoundError("Streetlight not found")

        wireless_device_id = metadata.wireless_device_id
        if not wireless_device_id:
            raise MissingWirelessDeviceIdError(
                "wireless_device_id is missing for this streetlight"
            )

        payload = self._payload_encoder.encode(streetlight_command)

        command_id = self._command_id_factory()
        ttl = self._epoch_seconds() + self._pending_ttl_seconds

        self._command_repo.write(
            streetlight_id=streetlight_id,
            command_id=command_id,
            tenant_id=tenant_id,
            issued_by=issued_by,
            command=streetlight_command,
            ttl=ttl,
        )

        self._downlink_sender.send(wireless_device_id, payload)

        self._command_repo.mark_sent(streetlight_id, command_id)

        return DispatchedCommand(
            command_id=command_id,
            streetlight_id=streetlight_id,
            command=streetlight_command.command.name,
        )
