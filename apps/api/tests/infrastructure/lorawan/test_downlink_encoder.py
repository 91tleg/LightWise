from domain.streetlight.commands import (
    DownlinkCmd,
    SetLevelsParams,
    SetMotionTimeoutParams,
    StreetlightCommand,
)
from infrastructure.lorawan.downlink_encoder import (
    encode_downlink_command_payload,
)


def test_encode_set_levels_payload():
    payload = encode_downlink_command_payload(
        StreetlightCommand(
            command=DownlinkCmd.SET_LEVELS,
            params=SetLevelsParams(max_level=90, dim_level=20),
        ),
    )

    assert payload == bytes([1, 1, 90, 20])


def test_encode_motion_timeout_payload():
    payload = encode_downlink_command_payload(
        StreetlightCommand(
            command=DownlinkCmd.SET_MOTION_TIMEOUT,
            params=SetMotionTimeoutParams(timeout_seconds=300),
        ),
    )

    assert payload == bytes([1, 2, 1, 44])
