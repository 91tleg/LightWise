"""
HTTP handler for listing downlink command history.
"""

from __future__ import annotations

from functools import lru_cache

from application.streetlight.list_commands import ListCommands
from application.streetlight.responses import command_to_response
from domain.errors import AuthError
from infrastructure.auth.identity import resolve_identity
from infrastructure.persistence.dynamo.downlink_command_repo import (
    get_downlink_command_repo,
)
from libs.response import success, error


@lru_cache(maxsize=1)
def _use_case():
    return ListCommands(
        command_repo=get_downlink_command_repo(),
    )


def _parse_limit(value: object) -> int | None:
    if value is None:
        return None
    return int(value)


def handler(event: dict, context: object):
    try:
        tenant_id, _ = resolve_identity(event)
        path = event.get("pathParameters") or {}
        query = event.get("queryStringParameters") or {}

        streetlight_id = path.get("streetlight_id")
        limit = _parse_limit(query.get("limit"))

        use_case = _use_case()

        if streetlight_id:
            records = use_case.for_streetlight(
                streetlight_id=streetlight_id,
                limit=limit or 50,
            )
        else:
            records = use_case.for_tenant(
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

    except Exception:
        return error(500, "Internal server error")