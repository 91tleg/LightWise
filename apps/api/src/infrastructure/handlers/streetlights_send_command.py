from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timezone
from functools import lru_cache

from domain.errors import AuthError
from domain.streetlight.command_params import validate_command_params
from domain.streetlight.commands import VALID_COMMANDS, get_command_byte
from infrastructure.auth.identity import resolve_identity
from infrastructure.lorawan.iot_core import send_downlink
from infrastructure.persistence.dynamo.downlink_command_repo import (
    get_downlink_command_repo,
)
from infrastructure.persistence.dynamo.streetlight_metadata_repo import (
    get_streetlight_metadata_repo,
)
from libs.logging import logger
from libs.response import success, error


@lru_cache(maxsize=1)
def _repo():
    return get_downlink_command_repo()


@lru_cache(maxsize=1)
def _metadata_repo():
    return get_streetlight_metadata_repo()


def _encode_payload(command: str, params: dict) -> bytes:
    cmd_byte = get_command_byte(command)
    payload = bytearray([1, cmd_byte])

    if command == "SET_LEVELS":
        payload.append(params["max_level"])
        payload.append(params["dim_level"])

    elif command == "SET_MOTION_TIMEOUT":
        timeout = params["timeout_seconds"]
        payload.extend(timeout.to_bytes(2, "big"))

    elif command == "OVERRIDE_ON":
        payload.append(params["level"])

    elif command == "SET_MOTION_SENSITIVITY":
        payload.append(params["sensitivity"])

    elif command == "SET_HEARTBEAT_INTERVAL":
        payload.append(params["interval_minutes"])

    elif command == "SET_TEMP_DIM":
        payload.append(params["level"])
        payload.append(params["duration_hours"])

    return bytes(payload)


def handler(event: dict, context: object) -> dict:
    try:
        tenant_id, user_id = resolve_identity(event)
    except AuthError:
        return error(401, "Unauthorized")

    streetlight_id = (event.get("pathParameters") or {}).get("id")
    if not streetlight_id:
        return error(400, "streetlight_id is required")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return error(400, "Invalid JSON body")

    command = body.get("command")
    params = body.get("params", {})

    if not command:
        return error(400, "command is required")

    if command not in VALID_COMMANDS:
        return error(400, "Invalid command")

    if not isinstance(params, dict):
        return error(400, "params must be an object")

    try:
        validate_command_params(command, params)
    except ValueError as exc:
        return error(422, str(exc))

    metadata = _metadata_repo().get(tenant_id, streetlight_id)
    if not metadata:
        return error(404, "Streetlight not found")

    wireless_device_id = metadata.wireless_device_id
    if not wireless_device_id:
        return error(400, "wireless_device_id is missing")

    command_id = f"cmd-{uuid.uuid4()}"
    ttl = int(time.time()) + 300

    try:
        cmd_byte = get_command_byte(command)
        payload = _encode_payload(command, params)

        _repo().write(
            streetlight_id=streetlight_id,
            command_id=command_id,
            tenant_id=tenant_id,
            issued_by=user_id,
            command_type=command,
            payload=params,
            ttl=ttl,
            echo_cmd=cmd_byte,
        )

        send_downlink(wireless_device_id, payload)

        _repo().mark_sent(streetlight_id, command_id)

        return success(
            {
                "command_id": command_id,
                "streetlight_id": streetlight_id,
                "command": command,
                "status": "pending",
                "dispatched_at": datetime.now(timezone.utc).isoformat(),
            },
            status_code=202,
        )

    except Exception:
        logger.exception(
            "Failed to send streetlight command",
            extra={
                "streetlight_id": streetlight_id,
                "tenant_id": tenant_id,
                "command": command,
            },
        )
        return error(500, "Internal server error")
