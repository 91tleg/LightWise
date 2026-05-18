"""
Streetlight downlink command domain objects.

Covers command name enumeration, per-command parameter validation,
and the factory function that parses and validates a raw command
request into a typed StreetlightCommand.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum
from typing import TypeAlias


class DownlinkCmd(IntEnum):
    """
    Downlink command identifiers.
    Integer values are the CMD bytes sent over the LoRaWAN wire,
    they must match the firmware downlink spec exactly.
    Use .name for human-readable strings (DynamoDB, API responses).
    """
    SET_LEVELS = 1
    SET_MOTION_TIMEOUT = 2
    OVERRIDE_ON = 3
    OVERRIDE_OFF = 4
    RESUME_AUTO = 5
    REQUEST_UPLINK = 6
    REBOOT = 7
    SET_MOTION_SENSITIVITY = 8
    SET_HEARTBEAT_INTERVAL = 9
    SET_TEMP_DIM = 10

    @classmethod
    def from_name(cls, value: object) -> DownlinkCmd:
        if isinstance(value, cls):
            return value
        if not isinstance(value, str):
            raise ValueError("command must be a string")
        try:
            return cls[value]
        except KeyError:
            raise ValueError(f"Invalid command: {value!r}") from None


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _validate_int_range(
    value: object,
    field_name: str,
    minimum: int,
    maximum: int,
) -> None:
    if not _is_int(value):
        raise ValueError(f"{field_name} is required and must be an integer")
    if not (minimum <= value <= maximum):
        raise ValueError(
            f"{field_name} must be between {minimum} and {maximum}"
        )


@dataclass(frozen=True)
class SetLevelsParams:
    max_level: int
    dim_level: int

    def __post_init__(self) -> None:
        _validate_int_range(self.max_level, "max_level", 1, 100)
        _validate_int_range(self.dim_level, "dim_level", 0, 100)
        if self.dim_level > self.max_level:
            raise ValueError("dim_level must be <= max_level")


@dataclass(frozen=True)
class SetMotionTimeoutParams:
    timeout_seconds: int

    def __post_init__(self) -> None:
        _validate_int_range(self.timeout_seconds, "timeout_seconds", 15, 3600)


@dataclass(frozen=True)
class OverrideOnParams:
    level: int

    def __post_init__(self) -> None:
        _validate_int_range(self.level, "level", 1, 100)


@dataclass(frozen=True)
class NoCommandParams:
    pass


@dataclass(frozen=True)
class SetMotionSensitivityParams:
    sensitivity: int

    def __post_init__(self) -> None:
        _validate_int_range(self.sensitivity, "sensitivity", 1, 10)


@dataclass(frozen=True)
class SetHeartbeatIntervalParams:
    interval_minutes: int

    def __post_init__(self) -> None:
        _validate_int_range(self.interval_minutes, "interval_minutes", 1, 255)


@dataclass(frozen=True)
class SetTempDimParams:
    level: int
    duration_hours: int

    def __post_init__(self) -> None:
        _validate_int_range(self.level, "level", 0, 100)
        _validate_int_range(self.duration_hours, "duration_hours", 1, 24)


CommandParams: TypeAlias = (
    SetLevelsParams
    | SetMotionTimeoutParams
    | OverrideOnParams
    | NoCommandParams
    | SetMotionSensitivityParams
    | SetHeartbeatIntervalParams
    | SetTempDimParams
)


@dataclass(frozen=True)
class StreetlightCommand:
    """
    A validated downlink command with typed params.
    Constructed exclusively via parse_streetlight_command — do not
    instantiate directly.
    """
    command: DownlinkCmd
    params: CommandParams


def parse_command_name(command: object) -> DownlinkCmd:
    return DownlinkCmd.from_name(command)


def parse_command_params(
    downlink_cmd: DownlinkCmd,
    params: object,
) -> StreetlightCommand:
    if not isinstance(params, dict):
        raise ValueError("params must be an object")

    match downlink_cmd:
        case DownlinkCmd.SET_LEVELS:
            command_params = SetLevelsParams(
                max_level=params.get("max_level"),
                dim_level=params.get("dim_level"),
            )
        case DownlinkCmd.SET_MOTION_TIMEOUT:
            command_params = SetMotionTimeoutParams(
                timeout_seconds=params.get("timeout_seconds"),
            )
        case DownlinkCmd.OVERRIDE_ON:
            command_params = OverrideOnParams(
                level=params.get("level"),
            )
        case (
            DownlinkCmd.OVERRIDE_OFF
            | DownlinkCmd.RESUME_AUTO
            | DownlinkCmd.REQUEST_UPLINK
            | DownlinkCmd.REBOOT
        ):
            if params:
                raise ValueError(
                    f"{downlink_cmd.name} does not accept params"
                )
            command_params = NoCommandParams()
        case DownlinkCmd.SET_MOTION_SENSITIVITY:
            command_params = SetMotionSensitivityParams(
                sensitivity=params.get("sensitivity"),
            )
        case DownlinkCmd.SET_HEARTBEAT_INTERVAL:
            command_params = SetHeartbeatIntervalParams(
                interval_minutes=params.get("interval_minutes"),
            )
        case DownlinkCmd.SET_TEMP_DIM:
            command_params = SetTempDimParams(
                level=params.get("level"),
                duration_hours=params.get("duration_hours"),
            )
        case _:
            raise ValueError(
                f"Unhandled command: {downlink_cmd.name}"
            )

    return StreetlightCommand(command=downlink_cmd, params=command_params)
