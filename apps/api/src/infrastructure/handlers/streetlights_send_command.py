"""
Streetlight send command API handler.

Trigger: API Gateway REST POST /streetlights/{id}/commands

Dispatches a downlink command to a streetlight over LoRaWAN.
Returns 202 Accepted immediately — device ACK/NACK is delivered
asynchronously via WebSocket command.ack push.
"""

from __future__ import annotations
import json
from datetime import datetime, timezone
from functools import lru_cache

from application.streetlight.send_command import (
    InvalidCommandError,
    InvalidCommandParamsError,
    MissingWirelessDeviceIdError,
    SendStreetlightCommand,
    StreetlightNotFoundError,
)
from domain.errors import AuthError
from infrastructure.auth.identity import resolve_identity
from infrastructure.lorawan.downlink_encoder import (
    DownlinkCommandPayloadEncoder
)
from infrastructure.lorawan.iot_core import get_downlink_sender
from infrastructure.persistence.dynamo.downlink_command_repo import (
    get_downlink_command_repo,
)
from infrastructure.persistence.dynamo.streetlight_metadata_repo import (
    get_streetlight_metadata_repo,
)
from libs.logging import logger
from libs.response import error, success


@lru_cache(maxsize=1)
def _use_case() -> SendStreetlightCommand:
    return SendStreetlightCommand(
        metadata_repo=get_streetlight_metadata_repo(),
        command_repo=get_downlink_command_repo(),
        downlink_sender=get_downlink_sender(),
        payload_encoder=DownlinkCommandPayloadEncoder(),
    )


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

    if not isinstance(body, dict):
        return error(400, "body must be an object")

    command = body.get("command")
    params = body.get("params", {})

    if not command:
        return error(400, "command is required")
    if not isinstance(params, dict):
        return error(400, "params must be an object")

    try:
        result = _use_case().execute(
            tenant_id=tenant_id,
            issued_by=user_id,
            streetlight_id=streetlight_id,
            command=command,
            params=params,
        )
    except InvalidCommandError as exc:
        return error(400, str(exc))
    except InvalidCommandParamsError as exc:
        return error(422, str(exc))
    except StreetlightNotFoundError:
        return error(404, "Streetlight not found")
    except MissingWirelessDeviceIdError:
        return error(400, "wireless_device_id is missing for this streetlight")
    except Exception:
        logger.exception(
            "Failed to send streetlight command",
            extra={
                "tenant_id": tenant_id,
                "streetlight_id": streetlight_id,
                "command": command,
            },
        )
        return error(500, "Internal server error")

    logger.info(
        "Streetlight command dispatched",
        extra={
            "tenant_id": tenant_id,
            "streetlight_id": streetlight_id,
            "command": command,
            "command_id": result.command_id,
        },
    )

    response = success({
        "command_id": result.command_id,
        "streetlight_id": result.streetlight_id,
        "command": result.command,
        "status": "pending",
        "dispatched_at": datetime.now(timezone.utc).isoformat(),
    })
    response["statusCode"] = 202
    return response
