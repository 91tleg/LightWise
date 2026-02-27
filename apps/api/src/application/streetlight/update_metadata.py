from functools import lru_cache

from infrastructure.persistence.dynamo.streetlight_metadata_repo import (
    StreetlightMetadataRepo,
    get_streetlight_metadata_repo,
)


class UpdateStreetlightMetadata:
    def __init__(self, repo: StreetlightMetadataRepo):
        self.repo = repo

    def execute(
        self,
        streetlight_id: str,
        name: str | None,
        lat: float | None,
        lng: float | None,
    ) -> None:
        self.repo.update(
            streetlight_id=streetlight_id,
            name=name,
            lat=lat,
            lng=lng,
        )


@lru_cache(maxsize=1)
def get_update_metadata_service() -> UpdateStreetlightMetadata:
    return UpdateStreetlightMetadata(
        repo=get_streetlight_metadata_repo()
    )
