import pytest

from domain.streetlight.command_params import validate_command_params


def test_set_levels_valid_params():
    params = {
        "max_level": 90,
        "dim_level": 20,
    }

    validate_command_params("SET_LEVELS", params)


def test_set_levels_invalid_params():
    params = {
        "max_level": 50,
        "dim_level": 80,
    }

    with pytest.raises(ValueError):
        validate_command_params("SET_LEVELS", params)


def test_motion_timeout_valid():
    params = {
        "timeout_seconds": 300,
    }

    validate_command_params("SET_MOTION_TIMEOUT", params)


def test_motion_timeout_invalid():
    params = {
        "timeout_seconds": 5,
    }

    with pytest.raises(ValueError):
        validate_command_params("SET_MOTION_TIMEOUT", params)


def test_override_off_valid():
    validate_command_params("OVERRIDE_OFF", {})


def test_override_off_invalid():
    params = {"level": 50}

    with pytest.raises(ValueError):
        validate_command_params("OVERRIDE_OFF", params)