"""
Streetlight command history API handler.

Trigger: API Gateway REST GET /streetlights/{id}/commands

Returns recent downlink command records for the selected streetlight so
the admin console can show pending, ACKed, NACKed, and timed-out commands.
"""

from __future__ import annotations

from decimal import Decimal
from functools import lru_cache

from domain.errors import AuthError
from infrastructure.auth.identity import resolve_identity
from infrastructure.persistence.dynamo.downlink_command_repo import (
    get_downlink_command_repo,
)
from infrastructure.persistence.error import PersistenceError
from libs.logging import logger
from libs.response import error, success

DEFAULT_LIMIT = 20
MAX_LIMIT = 100


@lru_cache(maxsize=1)
def _command_repo():
    return get_downlink_command_repo()


def _parse_limit(event: dict) -> int:
    query = event.get("queryStringParameters") or {}
    raw_limit = query.get("limit")

    if raw_limit in (None, ""):
        return DEFAULT_LIMIT

    try:
        limit = int(raw_limit)
    except (TypeError, ValueError):
        raise ValueError("limit must be an integer") from None

    if limit < 1:
        raise ValueError("limit must be at least 1")

    return min(limit, MAX_LIMIT)


def _json_safe(value):
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    return value


def _normalize_command(item: dict) -> dict:
    status = str(item.get("status") or "PENDING")
    acknowledged_at = item.get("acknowledged_at") or ""
    reason = item.get("reason") or ""
    response = None

    if acknowledged_at or reason:
        response = {
            "received_at": acknowledged_at,
            "response_code": "ACK" if status == "ACKNOWLEDGED" else "NACK",
            "reason_code": reason,
        }

    return {
        "command_id": item.get("command_id") or "",
        "streetlight_id": item.get("streetlight_id") or "",
        "command": item.get("command_type") or item.get("command") or "",
        "params": _json_safe(item.get("payload") or item.get("params") or {}),
        "status": status,
        "dispatched_at": item.get("sent_at") or item.get("created_at") or "",
        "response": response,
    }


def handler(event: dict, context: object) -> dict:
    try:
        tenant_id, _user_id = resolve_identity(event)
    except AuthError:
        return error(401, "Unauthorized")

    streetlight_id = (event.get("pathParameters") or {}).get("id")
    if not streetlight_id:
        return error(400, "streetlight_id is required")

    try:
        limit = _parse_limit(event)
    except ValueError as exc:
        return error(400, str(exc))

    try:
        items = _command_repo().list_for_streetlight(
            streetlight_id=streetlight_id,
            tenant_id=tenant_id,
            limit=limit,
        )
    except PersistenceError:
        logger.exception(
            "Failed to list streetlight commands",
            extra={"tenant_id": tenant_id, "streetlight_id": streetlight_id},
        )
        return error(500, "Failed to list command history")
    except Exception:
        logger.exception(
            "Unexpected error listing streetlight commands",
            extra={"tenant_id": tenant_id, "streetlight_id": streetlight_id},
        )
        return error(500, "Internal server error")

    return success({
        "streetlight_id": streetlight_id,
        "commands": [_normalize_command(item) for item in items],
    })
