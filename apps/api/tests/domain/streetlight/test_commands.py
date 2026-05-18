import pytest

from domain.streetlight.commands import (
    DownlinkCmd,
    NoCommandParams,
    OverrideOnParams,
    SetHeartbeatIntervalParams,
    SetLevelsParams,
    SetMotionSensitivityParams,
    SetMotionTimeoutParams,
    SetTempDimParams,
    StreetlightCommand,
    parse_command_name,
    parse_command_params,
)


def test_from_name_returns_command_enum():
    assert DownlinkCmd.from_name("SET_LEVELS") is DownlinkCmd.SET_LEVELS


def test_from_name_accepts_existing_command_enum():
    assert (
        DownlinkCmd.from_name(DownlinkCmd.SET_LEVELS)
        is DownlinkCmd.SET_LEVELS
    )


def test_from_name_rejects_unknown_name():
    with pytest.raises(ValueError, match="Invalid command"):
        DownlinkCmd.from_name("NOPE")


def test_from_name_rejects_non_string_value():
    with pytest.raises(ValueError, match="command must be a string"):
        DownlinkCmd.from_name(1)


def test_set_levels_valid_params():
    params = SetLevelsParams(max_level=90, dim_level=20)

    assert params.max_level == 90
    assert params.dim_level == 20


def test_set_levels_invalid_params():
    with pytest.raises(ValueError, match="dim_level must be <= max_level"):
        SetLevelsParams(max_level=50, dim_level=80)


def test_motion_timeout_valid():
    params = SetMotionTimeoutParams(timeout_seconds=300)

    assert params.timeout_seconds == 300


def test_motion_timeout_invalid():
    with pytest.raises(
        ValueError, match="timeout_seconds must be between 15 and 3600"
    ):
        SetMotionTimeoutParams(timeout_seconds=5)


def test_override_on_valid():
    params = OverrideOnParams(level=50)

    assert params.level == 50


def test_set_motion_sensitivity_valid():
    params = SetMotionSensitivityParams(sensitivity=7)

    assert params.sensitivity == 7


def test_set_heartbeat_interval_valid():
    params = SetHeartbeatIntervalParams(interval_minutes=30)

    assert params.interval_minutes == 30


def test_set_temp_dim_valid():
    params = SetTempDimParams(level=25, duration_hours=2)

    assert params.level == 25
    assert params.duration_hours == 2


def test_bool_is_not_accepted_as_integer():
    with pytest.raises(
        ValueError, match="level is required and must be an integer"
    ):
        OverrideOnParams(level=True)


def test_streetlight_command_accepts_matching_params():
    command = StreetlightCommand(
        command=DownlinkCmd.SET_LEVELS,
        params=SetLevelsParams(max_level=90, dim_level=20),
    )

    assert command.command is DownlinkCmd.SET_LEVELS


def test_parse_set_levels_command():
    downlink_cmd = parse_command_name("SET_LEVELS")
    command = parse_command_params(
        downlink_cmd,
        {
            "max_level": 90,
            "dim_level": 20,
        },
    )

    assert command == StreetlightCommand(
        command=DownlinkCmd.SET_LEVELS,
        params=SetLevelsParams(max_level=90, dim_level=20),
    )


def test_parse_no_param_command():
    downlink_cmd = parse_command_name("OVERRIDE_OFF")
    command = parse_command_params(downlink_cmd, {})

    assert command.command is DownlinkCmd.OVERRIDE_OFF
    assert isinstance(command.params, NoCommandParams)


def test_no_param_command_rejects_params():
    downlink_cmd = parse_command_name("OVERRIDE_OFF")
    with pytest.raises(ValueError, match="OVERRIDE_OFF does not accept"):
        parse_command_params(downlink_cmd, {"level": 50})


def test_parse_rejects_non_object_params():
    downlink_cmd = parse_command_name("SET_LEVELS")
    with pytest.raises(ValueError, match="params must be an object"):
        parse_command_params(downlink_cmd, [])


def test_parse_invalid_command():
    with pytest.raises(ValueError, match="Invalid command"):
        parse_command_name("NOPE")
