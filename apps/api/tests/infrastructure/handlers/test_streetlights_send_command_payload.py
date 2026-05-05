from infrastructure.handlers.streetlights_send_command import _encode_payload


def test_encode_set_levels_payload():
    payload = _encode_payload(
        "SET_LEVELS",
        {
            "max_level": 90,
            "dim_level": 20,
        },
    )

    assert payload == bytes([1, 1, 90, 20])


def test_encode_motion_timeout_payload():
    payload = _encode_payload(
        "SET_MOTION_TIMEOUT",
        {
            "timeout_seconds": 300,
        },
    )

    assert payload == bytes([1, 2, 1, 44])