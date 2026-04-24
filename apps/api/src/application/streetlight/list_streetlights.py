from typing import Protocol

from domain.streetlight.models import StreetlightState, StreetlightMetadata
from application.streetlight.responses import StreetlightResponse


class StreetlightsRepo(Protocol):
    def list_by_tenant(
        self, tenant_id: str
    ) -> list[StreetlightState]: ...


class StreetlightMetadataRepo(Protocol):
    def list_by_tenant(
        self, tenant_id: str
    ) -> list[StreetlightMetadata]: ...


class ListStreetlights:
    """
    Orchestrates fetching both State and Metadata to provide a
    complete fleet overview for a tenant.
    """

    def __init__(
        self,
        state_repo: StreetlightsRepo,
        metadata_repo: StreetlightMetadataRepo
    ):
        self.state_repo = state_repo
        self.metadata_repo = metadata_repo

    def execute(self, tenant_id: str) -> list[StreetlightResponse]:
        states = self.state_repo.list_by_tenant(tenant_id)
        metadata_list = self.metadata_repo.list_by_tenant(tenant_id)

        meta_map = {m.streetlight_id: m for m in metadata_list}

        results = []
        for state in states:
            meta = meta_map.get(state.streetlight_id)
            results.append(
                StreetlightResponse(state=state, metadata=meta)
            )

        return sorted(
            results, key=lambda x: x.metadata.name or "" if x.metadata else ""
        )
