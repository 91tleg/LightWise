from typing import Protocol
from dataclasses import replace

from domain.streetlight.models import StreetlightMetadata


class StreetlightMetadataRepo(Protocol):
    def get(
        self,
        tenant_id: str,
        streetlight_id: str,
    ) -> StreetlightMetadata | None: ...

    def save(
        self,
        tenant_id: str,
        metadata: StreetlightMetadata,
    ) -> None: ...


class UpdateStreetlightMetadata:
    def __init__(self, repo: StreetlightMetadataRepo):
        self.repo = repo

    def execute(
        self,
        tenant_id: str,
        streetlight_id: str,
        name: str | None,
        lat: float | None,
        lng: float | None,
    ) -> None:
        existing = self.repo.get(tenant_id, streetlight_id)
        if not existing:
            raise ValueError(f"Streetlight {streetlight_id} not found")

        updates = {k: v for k, v in {
            "name": name,
            "lat": lat,
            "lng": lng,
        }.items() if v is not None}

        if not updates:
            return

        updated_metadata = replace(existing, **updates)
        self.repo.save(tenant_id, updated_metadata)
