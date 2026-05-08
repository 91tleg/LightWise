from __future__ import annotations

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
from infrastructure.http.streetlights_send_command_request import (
    InvalidSendCommandRequest,
    decode_send_command_request,
)
from infrastructure.lorawan.downlink_encoder import (
    DownlinkCommandPayloadEncoder,
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

    try:
        request = decode_send_command_request(event)
        result = _use_case().execute(
            tenant_id=tenant_id,
            issued_by=user_id,
            streetlight_id=request.streetlight_id,
            command=request.command,
            params=request.params,
        )
    except InvalidSendCommandRequest as exc:
        return error(400, str(exc))
    except InvalidCommandError as exc:
        return error(400, str(exc))
    except InvalidCommandParamsError as exc:
        return error(422, str(exc))
    except StreetlightNotFoundError as exc:
        return error(404, str(exc))
    except MissingWirelessDeviceIdError as exc:
        return error(400, str(exc))
    except Exception:
        logger.exception(
            "Failed to send streetlight command",
            extra={"tenant_id": tenant_id},
        )
        return error(500, "Internal server error")

    response = success({
        "command_id": result.command_id,
        "streetlight_id": result.streetlight_id,
        "command": result.command,
        "status": result.status,
    })
    response["statusCode"] = 202
    return response
