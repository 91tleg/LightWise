"""
List downlink command history for streetlights.
"""

from __future__ import annotations

from typing import Protocol

from domain.streetlight.models import DownlinkCommandRecord


DEFAULT_LIMIT = 20
MAX_LIMIT = 100


class DownlinkCommandRepo(Protocol):
    def list_for_streetlight(
        self,
        streetlight_id: str,
        limit: int,
    ) -> list[DownlinkCommandRecord]: ...

    def list_for_tenant(
        self,
        tenant_id: str,
        limit: int,
    ) -> list[DownlinkCommandRecord]: ...


class ListCommands:
    def __init__(
        self,
        command_repo: DownlinkCommandRepo,
    ) -> None:
        self._command_repo = command_repo

    def _resolve_limit(self, limit: int | None) -> int:
        resolved = limit if limit is not None else DEFAULT_LIMIT

        if resolved < 1:
            raise ValueError("limit must be at least 1")

        return min(resolved, MAX_LIMIT)

    def for_streetlight(
        self,
        streetlight_id: str,
        limit: int | None = None,
    ) -> list[DownlinkCommandRecord]:
        return self._command_repo.list_for_streetlight(
            streetlight_id=streetlight_id,
            limit=self._resolve_limit(limit),
        )

    def for_tenant(
        self,
        tenant_id: str,
        limit: int | None = None,
    ) -> list[DownlinkCommandRecord]:
        return self._command_repo.list_for_tenant(
            tenant_id=tenant_id,
            limit=self._resolve_limit(limit),
        )
