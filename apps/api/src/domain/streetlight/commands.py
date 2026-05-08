from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum
from typing import TypeAlias


class DownlinkCmd(IntEnum):
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
    def from_name(cls, value: object) -> "DownlinkCmd":
        if isinstance(value, cls):
            return value
        if not isinstance(value, str):
            raise ValueError("Invalid command")
        try:
            return cls[value]
        except KeyError:
            raise ValueError("Invalid command") from None


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _validate_int_range(
    value: object,
    field_name: str,
    minimum: int,
    maximum: int,
) -> None:
    if not _is_int(value) or not (minimum <= value <= maximum):
        raise ValueError(
            f"{field_name} must be between {minimum} and {maximum}"
        )


@dataclass(frozen=True)
class SetLevelsParams:
    max_level: int | None = None
    dim_level: int | None = None

    def __post_init__(self) -> None:
        _validate_int_range(self.max_level, "max_level", 1, 100)
        _validate_int_range(self.dim_level, "dim_level", 0, 100)
        if self.dim_level > self.max_level:
            raise ValueError("dim_level must be <= max_level")


@dataclass(frozen=True)
class SetMotionTimeoutParams:
    timeout_seconds: int | None = None

    def __post_init__(self) -> None:
        _validate_int_range(
            self.timeout_seconds, "timeout_seconds", 15, 3600
        )


@dataclass(frozen=True)
class OverrideOnParams:
    level: int | None = None

    def __post_init__(self) -> None:
        _validate_int_range(self.level, "level", 1, 100)


@dataclass(frozen=True)
class NoCommandParams:
    pass


@dataclass(frozen=True)
class SetMotionSensitivityParams:
    sensitivity: int | None = None

    def __post_init__(self) -> None:
        _validate_int_range(self.sensitivity, "sensitivity", 1, 10)


@dataclass(frozen=True)
class SetHeartbeatIntervalParams:
    interval_minutes: int | None = None

    def __post_init__(self) -> None:
        _validate_int_range(
            self.interval_minutes, "interval_minutes", 1, 255
        )


@dataclass(frozen=True)
class SetTempDimParams:
    level: int | None = None
    duration_hours: int | None = None

    def __post_init__(self) -> None:
        _validate_int_range(self.level, "level", 0, 100)
        _validate_int_range(
            self.duration_hours, "duration_hours", 1, 24
        )


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
    command: DownlinkCmd
    params: CommandParams

    def __post_init__(self) -> None:
        match (self.command, self.params):
            case (DownlinkCmd.SET_LEVELS, SetLevelsParams()):
                return
            case (
                DownlinkCmd.SET_MOTION_TIMEOUT,
                SetMotionTimeoutParams(),
            ):
                return
            case (DownlinkCmd.OVERRIDE_ON, OverrideOnParams()):
                return
            case (
                DownlinkCmd.OVERRIDE_OFF
                | DownlinkCmd.RESUME_AUTO
                | DownlinkCmd.REQUEST_UPLINK
                | DownlinkCmd.REBOOT,
                NoCommandParams(),
            ):
                return
            case (
                DownlinkCmd.SET_MOTION_SENSITIVITY,
                SetMotionSensitivityParams(),
            ):
                return
            case (
                DownlinkCmd.SET_HEARTBEAT_INTERVAL,
                SetHeartbeatIntervalParams(),
            ):
                return
            case (DownlinkCmd.SET_TEMP_DIM, SetTempDimParams()):
                return
            case _:
                raise ValueError(
                    f"{self.command.name} received incompatible params"
                )


def parse_streetlight_command(
    command: object, params: object
) -> StreetlightCommand:
    if not isinstance(params, dict):
        raise ValueError("params must be an object")

    downlink_cmd = DownlinkCmd.from_name(command)

    match downlink_cmd:
        case DownlinkCmd.SET_LEVELS:
            command_params = SetLevelsParams(
                max_level=params.get("max_level"),
                dim_level=params.get("dim_level"),
            )
        case DownlinkCmd.SET_MOTION_TIMEOUT:
            command_params = SetMotionTimeoutParams(
                timeout_seconds=params.get("timeout_seconds")
            )
        case DownlinkCmd.OVERRIDE_ON:
            command_params = OverrideOnParams(level=params.get("level"))
        case (
            DownlinkCmd.OVERRIDE_OFF
            | DownlinkCmd.RESUME_AUTO
            | DownlinkCmd.REQUEST_UPLINK
            | DownlinkCmd.REBOOT
        ):
            if params:
                raise ValueError(f"{downlink_cmd.name} does not accept params")
            command_params = NoCommandParams()
        case DownlinkCmd.SET_MOTION_SENSITIVITY:
            command_params = SetMotionSensitivityParams(
                sensitivity=params.get("sensitivity")
            )
        case DownlinkCmd.SET_HEARTBEAT_INTERVAL:
            command_params = SetHeartbeatIntervalParams(
                interval_minutes=params.get("interval_minutes")
            )
        case DownlinkCmd.SET_TEMP_DIM:
            command_params = SetTempDimParams(
                level=params.get("level"),
                duration_hours=params.get("duration_hours"),
            )

    return StreetlightCommand(command=downlink_cmd, params=command_params)
