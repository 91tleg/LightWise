from __future__ import annotations

import json
from dataclasses import dataclass


class InvalidSendCommandRequest(ValueError):
    pass


@dataclass(frozen=True)
class SendCommandRequest:
    streetlight_id: str
    command: str
    params: dict


def decode_send_command_request(event: dict) -> SendCommandRequest:
    streetlight_id = (event.get("pathParameters") or {}).get("id")
    if not streetlight_id:
        raise InvalidSendCommandRequest("streetlight_id is required")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError as exc:
        raise InvalidSendCommandRequest("Invalid JSON body") from exc
    if not isinstance(body, dict):
        raise InvalidSendCommandRequest("body must be an object")

    command = body.get("command")
    params = body.get("params", {})

    if not command:
        raise InvalidSendCommandRequest("command is required")
    if not isinstance(params, dict):
        raise InvalidSendCommandRequest("params must be an object")

    return SendCommandRequest(
        streetlight_id=streetlight_id,
        command=command,
        params=params,
    )
