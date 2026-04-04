from typing import Protocol


class StreetlightMetadataRepo(Protocol):
    def update(
        self,
        streetlight_id: str,
        label: str | None = None,
        lat: float | None = None,
        lng: float | None = None,
    ) -> None: ...


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
        existing = self.repo.get(streetlight_id)
        if not existing:
            raise ValueError(f"Streetlight {streetlight_id} not found")

        from dataclasses import replace

        try:
            updates = {k: v for k, v in {
                "name": name,
                "lat": lat,
                "lng": lng
            }.items() if v is not None}

            if not updates:
                return

            updated_metadata = replace(existing, **updates)

        except ValueError as e:
            raise ValueError(f"Update failed: {e}")

        self.repo.save(updated_metadata)
