from functools import lru_cache
from typing import Optional

from domain.streetlight.models import Streetlight
from infrastructure.persistence.dynamo.streetlights_repo import (
    StreetlightsRepo,
    get_streetlights_repository,
)
from infrastructure.persistence.dynamo.streetlight_metadata_repo import (
    StreetlightMetadataRepo,
    get_streetlight_metadata_repo,
)


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
    ) -> Optional[Streetlight]:
        state = self.repo.get(tenant_id, streetlight_id)
        if not state:
            return None
        metadata = self.metadata_repo.get(streetlight_id)
        return Streetlight(
            streetlight_id=state.streetlight_id,
            tenant_id=state.tenant_id,
            health=state.health,
            last_seen=state.last_seen,
            motion_detected=state.motion_detected,
            ambient_primary_ok=state.ambient_primary_ok,
            ambient_secondary_ok=state.ambient_secondary_ok,
            th_ok=state.th_ok,
            motion_primary_ok=state.motion_primary_ok,
            motion_secondary_ok=state.motion_secondary_ok,
            lat=metadata.lat if metadata else None,
            lng=metadata.lng if metadata else None,
            name=metadata.name if metadata else None,
        )


@lru_cache(maxsize=1)
def get_streetlight_service() -> GetStreetlight:
    return GetStreetlight(
        repo=get_streetlights_repository(),
        metadata_repo=get_streetlight_metadata_repo(),
    )
