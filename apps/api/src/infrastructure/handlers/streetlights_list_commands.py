"""
Streetlight command history API handler.

Trigger: API Gateway REST GET /streetlights/{id}/commands

Returns recent downlink command records for the selected streetlight so
the admin console can show pending, ACKed, NACKed, and timed-out commands.
"""

from __future__ import annotations
from functools import lru_cache

from application.streetlight.list_commands import ListCommands
from application.streetlight.responses import command_to_response
from domain.errors import AuthError
from infrastructure.persistence.error import PersistenceError
from infrastructure.auth.identity import resolve_identity
from infrastructure.persistence.dynamo.downlink_command_repo import (
    get_downlink_command_repo,
)
from libs.response import success, error
from libs.logging import logger


@lru_cache(maxsize=1)
def _use_case():
    return ListCommands(
        command_repo=get_downlink_command_repo(),
    )


def _parse_limit(value: object) -> int | None:
    if value is None:
        return None
    return int(value)


def handler(event: dict, context: object) -> dict:
    try:
        tenant_id, _ = resolve_identity(event)
        path = event.get("pathParameters") or {}
        query = event.get("queryStringParameters") or {}
        streetlight_id = path.get("id")
        limit = _parse_limit(query.get("limit"))
        if streetlight_id:
            records = _use_case().for_streetlight(
                streetlight_id=streetlight_id,
                limit=limit or 50,
            )
        else:
            records = _use_case().for_tenant(
                tenant_id=tenant_id,
                limit=limit or 50,
            )
        return success({
            "commands": [
                command_to_response(record)
                for record in records
            ]
        })
    except AuthError as exc:
        return error(401, str(exc))

    except ValueError as exc:
        return error(400, str(exc))

    except PersistenceError:
        logger.exception(
            "Failed to list streetlight commands",
            extra={"tenant_id": tenant_id, "streetlight_id": streetlight_id},
        )
        return error(500, "Internal server error")

    except Exception:
        logger.exception(
            "Unexpected error listing streetlight commands",
            extra={"tenant_id": tenant_id, "streetlight_id": streetlight_id},
        )
        return error(500, "Internal server error")
