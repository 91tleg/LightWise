"""
Streetlight telemetry query API handler.

Trigger: API Gateway REST GET /streetlights/{id}/telemetry

Query parameters:
  from     - ISO 8601 start datetime (required)
  to       - ISO 8601 end datetime (required)
  interval - aggregation interval (optional, default 5m)
"""

from __future__ import annotations
from datetime import datetime, timezone
from functools import lru_cache

from application.streetlight.query_telemetry import QueryTelemetry
from domain.streetlight.interval import TelemetryInterval
from domain.error import AuthError
from infrastructure.auth.identity import IdentityResolver
from infrastructure.persistence.telemetry.provider import get_reader
from libs.logging import logger
from libs.response import error, success


@lru_cache(maxsize=1)
def _use_case() -> QueryTelemetry:
    return QueryTelemetry(reader=get_reader())


def handler(event: dict, context: object) -> dict:
    streetlight_id = (event.get("pathParameters") or {}).get("id")
    if not streetlight_id:
        return error(400, "streetlight_id is required")

    try:
        tenant_id, _ = IdentityResolver()(event)
    except AuthError:
        return error(401, "Unauthorized")

    params = event.get("queryStringParameters") or {}
    from_str = params.get("from")
    to_str = params.get("to")

    if not from_str or not to_str:
        return error(400, "from and to are required")

    from_dt = _parse_dt(from_str)
    to_dt = _parse_dt(to_str)
    if from_dt is None or to_dt is None:
        return error(400, "from and to must be ISO 8601 format")

    if from_dt >= to_dt:
        return error(400, "from must be before to")

    try:
        interval = TelemetryInterval(
            params.get("interval", TelemetryInterval.DEFAULT)
        )
    except ValueError as exc:
        return error(400, str(exc))

    try:
        data = _use_case().execute(
            tenant_id=tenant_id,
            streetlight_id=streetlight_id,
            from_dt=from_dt,
            to_dt=to_dt,
            interval=interval,
        )
        return success(
            {
                "streetlight_id": streetlight_id,
                "data": data
            }
        )
    except Exception:
        logger.exception(
            "Failed to query telemetry",
            extra={
                "streetlight_id": streetlight_id,
                "tenant_id": tenant_id
            },
        )
        return error(500, "Internal server error")


def _parse_dt(value: str) -> datetime | None:
    """
    Parse an ISO 8601 datetime string.
    Naive datetimes (no timezone) are assumed UTC.
    Returns None if the string cannot be parsed.
    """
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None
