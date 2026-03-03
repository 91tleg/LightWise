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
        if all(v is None for v in [name, lat, lng]):
            raise ValueError(
                "At least one field (name, lat, or lng) must be provided."
            )

        if lat is not None and not (-90 <= lat <= 90):
            raise ValueError(
                f"Invalid latitude: {lat}. Range is -90 to 90."
            )

        if lng is not None and not (-180 <= lng <= 180):
            raise ValueError(
                f"Invalid longitude: {lng}. Range is -180 to 180."
            )

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
