from __future__ import annotations

from functools import lru_cache

from domain.errors import AuthError
from infrastructure.auth.identity import resolve_identity
from infrastructure.persistence.dynamo.downlink_command_repo import (
    get_downlink_command_repo,
)
from infrastructure.persistence.dynamo.streetlight_metadata_repo import (
    get_streetlight_metadata_repo,
)
from libs.logging import logger
from libs.response import error, success


@lru_cache(maxsize=1)
def _repo():
    return get_downlink_command_repo()


@lru_cache(maxsize=1)
def _metadata_repo():
    return get_streetlight_metadata_repo()


def _status_for_api(value: str) -> str:
    status = str(value or "").upper()
    if status == "PENDING":
        return "pending"
    if status == "SENT":
        return "pending"
    if status == "ACKNOWLEDGED":
        return "acked"
    if status == "FAILED":
        return "nacked"
    if status == "TIMEOUT":
        return "timeout"
    return status.lower() or "pending"


def _command_response(item: dict) -> dict:
    status = _status_for_api(item.get("status"))
    acknowledged_at = item.get("acknowledged_at")
    reason = item.get("reason")
    response = None

    if acknowledged_at or reason:
        response = {
            "received_at": acknowledged_at,
            "response_code": "ACK" if status == "acked" else "NACK",
            "reason_code": reason,
        }

    return {
        "command_id": item.get("command_id"),
        "dispatched_at": item.get("sent_at") or item.get("created_at"),
        "command": item.get("command_type"),
        "params": item.get("payload") or {},
        "status": status,
        "response": response,
    }


def _matches_query(command: dict, query: dict) -> bool:
    from_ts = query.get("from")
    to_ts = query.get("to")
    status = query.get("status")
    dispatched_at = command.get("dispatched_at") or ""

    if from_ts and dispatched_at and dispatched_at < from_ts:
        return False
    if to_ts and dispatched_at and dispatched_at > to_ts:
        return False
    if status and command.get("status") != status:
        return False

    return True


def handler(event: dict, context: object) -> dict:
    try:
        tenant_id, _ = resolve_identity(event)
    except AuthError:
        return error(401, "Unauthorized")

    streetlight_id = (event.get("pathParameters") or {}).get("id")
    if not streetlight_id:
        return error(400, "streetlight_id is required")

    metadata = _metadata_repo().get(tenant_id, streetlight_id)
    if not metadata:
        return error(404, "Streetlight not found")

    query = event.get("queryStringParameters") or {}

    try:
        commands = [
            item
            for item in (_command_response(row) for row in _repo().list_for_streetlight(streetlight_id))
            if _matches_query(item, query)
        ]
    except Exception:
        logger.exception(
            "Failed to list streetlight commands",
            extra={"tenant_id": tenant_id, "streetlight_id": streetlight_id},
        )
        return error(500, "Internal server error")

    return success({
        "streetlight_id": streetlight_id,
        "commands": commands,
    })
