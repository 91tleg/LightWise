def validate_command_params(command: str, params: dict) -> None:
    if command == "SET_LEVELS":
        max_level = params.get("max_level")
        dim_level = params.get("dim_level")

        if max_level is None or not (1 <= max_level <= 100):
            raise ValueError("max_level must be between 1 and 100")
        if dim_level is None or not (0 <= dim_level <= 100):
            raise ValueError("dim_level must be between 0 and 100")
        if dim_level > max_level:
            raise ValueError("dim_level must be <= max_level")

    elif command == "SET_MOTION_TIMEOUT":
        timeout_seconds = params.get("timeout_seconds")
        if timeout_seconds is None or not (15 <= timeout_seconds <= 3600):
            raise ValueError("timeout_seconds must be between 15 and 3600")

    elif command == "OVERRIDE_ON":
        level = params.get("level")
        if level is None or not (1 <= level <= 100):
            raise ValueError("level must be between 1 and 100")

    elif command == "OVERRIDE_OFF":
        if params:
            raise ValueError("OVERRIDE_OFF does not accept params")

    elif command == "RESUME_AUTO":
        if params:
            raise ValueError("RESUME_AUTO does not accept params")

    elif command == "REQUEST_UPLINK":
        if params:
            raise ValueError("REQUEST_UPLINK does not accept params")

    elif command == "REBOOT":
        if params:
            raise ValueError("REBOOT does not accept params")

    elif command == "SET_MOTION_SENSITIVITY":
        sensitivity = params.get("sensitivity")
        if sensitivity is None or not (1 <= sensitivity <= 10):
            raise ValueError("sensitivity must be between 1 and 10")

    elif command == "SET_HEARTBEAT_INTERVAL":
        interval_minutes = params.get("interval_minutes")
        if interval_minutes is None or not (1 <= interval_minutes <= 255):
            raise ValueError("interval_minutes must be between 1 and 255")

    elif command == "SET_TEMP_DIM":
        level = params.get("level")
        duration_hours = params.get("duration_hours")

        if level is None or not (0 <= level <= 100):
            raise ValueError("level must be between 0 and 100")
        if duration_hours is None or not (1 <= duration_hours <= 24):
            raise ValueError("duration_hours must be between 1 and 24")
