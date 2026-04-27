from __future__ import annotations

import json
import time
import uuid
from functools import lru_cache

from domain.errors import AuthError
from infrastructure.auth.identity import resolve_identity
from infrastructure.persistence.dynamo.downlink_command_repo import (
    get_downlink_command_repo,
)
from libs.logging import logger
from libs.response import success, error


VALID_COMMANDS = {
    "SET_LEVELS",
    "SET_MOTION_TIMEOUT",
    "OVERRIDE_ON",
    "OVERRIDE_OFF",
    "RESUME_AUTO",
    "REQUEST_UPLINK",
    "REBOOT",
    "SET_MOTION_SENSITIVITY",
    "SET_HEARTBEAT_INTERVAL",
    "SET_TEMP_DIM",
}


@lru_cache(maxsize=1)
def _repo():
    return get_downlink_command_repo()


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

    command_id = f"cmd-{uuid.uuid4()}"
    ttl = int(time.time()) + 300  # 5 minutes

    try:
        _repo().write(
            streetlight_id=streetlight_id,
            command_id=command_id,
            tenant_id=tenant_id,
            issued_by=user_id,
            command_type=command,
            payload=params,
            ttl=ttl,
            echo_cmd=0,
        )

        return success(
            {
                "command_id": command_id,
                "streetlight_id": streetlight_id,
                "command": command,
                "status": "pending",
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