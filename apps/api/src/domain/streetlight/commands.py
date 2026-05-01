from enum import Enum


class DownlinkCmd(Enum):
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


VALID_COMMANDS = {cmd.name for cmd in DownlinkCmd}


def get_command_byte(command: str) -> int:
    return DownlinkCmd[command].value
