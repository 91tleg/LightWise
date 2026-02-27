from functools import lru_cache

from domain.streetlight.models import Streetlight
from infrastructure.persistence.dynamo.streetlights_repo import (
    StreetlightsRepo,
    get_streetlights_repository,
)


class ListStreetlights:
    def __init__(self, repo: StreetlightsRepo):
        self.repo = repo

    def execute(self, tenant_id: str) -> list[Streetlight]:
        return self.repo.list_by_tenant(tenant_id)


@lru_cache(maxsize=1)
def get_list_streetlights() -> ListStreetlights:
    return ListStreetlights(repo=get_streetlights_repository())
