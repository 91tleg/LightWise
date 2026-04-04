from typing import Optional, Protocol

from domain.streetlight.models import StreetlightState, StreetlightMetadata
from application.streetlight.responses import StreetlightResponse


class StreetlightsRepo(Protocol):
    def get(
        self, tenant_id: str, streetlight_id: str
    ) -> Optional[StreetlightState]: ...


class StreetlightMetadataRepo(Protocol):
    def get(
        self, streetlight_id: str
    ) -> Optional[StreetlightMetadata]: ...


class GetStreetlight:
    def __init__(
        self,
        repo: StreetlightsRepo,
        metadata_repo: StreetlightMetadataRepo,
    ):
        self.repo = repo
        self.metadata_repo = metadata_repo

    def execute(
        self,
        tenant_id: str,
        streetlight_id: str,
    ) -> Optional[StreetlightResponse]:
        """
        Fetches the complete picture of a single streetlight.
        Returns a Response DTO containing both State and Metadata.
        """
        state = self.repo.get(tenant_id, streetlight_id)
        if not state:
            return None

        metadata = self.metadata_repo.get(streetlight_id)

        return StreetlightResponse(
            state=state,
            metadata=metadata
        )
