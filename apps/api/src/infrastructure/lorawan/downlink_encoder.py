from __future__ import annotations

from domain.streetlight.commands import (
    DownlinkCmd,
    OverrideOnParams,
    SetHeartbeatIntervalParams,
    SetLevelsParams,
    SetMotionSensitivityParams,
    SetMotionTimeoutParams,
    SetTempDimParams,
    StreetlightCommand,
)


class DownlinkCommandPayloadEncoder:
    def encode(self, command: StreetlightCommand) -> bytes:
        return encode_downlink_command_payload(command)


def encode_downlink_command_payload(command: StreetlightCommand) -> bytes:
    payload = bytearray([1, command.command.value])

    match (command.command, command.params):
        case (
            DownlinkCmd.SET_LEVELS,
            SetLevelsParams(max_level=max_level, dim_level=dim_level),
        ):
            payload.append(max_level)
            payload.append(dim_level)

        case (
            DownlinkCmd.SET_MOTION_TIMEOUT,
            SetMotionTimeoutParams(timeout_seconds=timeout_seconds),
        ):
            payload.extend(timeout_seconds.to_bytes(2, "big"))

        case (DownlinkCmd.OVERRIDE_ON, OverrideOnParams(level=level)):
            payload.append(level)

        case (
            DownlinkCmd.SET_MOTION_SENSITIVITY,
            SetMotionSensitivityParams(sensitivity=sensitivity),
        ):
            payload.append(sensitivity)

        case (
            DownlinkCmd.SET_HEARTBEAT_INTERVAL,
            SetHeartbeatIntervalParams(
                interval_minutes=interval_minutes
            ),
        ):
            payload.append(interval_minutes)

        case (
            DownlinkCmd.SET_TEMP_DIM,
            SetTempDimParams(
                level=level,
                duration_hours=duration_hours,
            ),
        ):
            payload.append(level)
            payload.append(duration_hours)

    return bytes(payload)
