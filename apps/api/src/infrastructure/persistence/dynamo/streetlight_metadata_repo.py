from typing import Optional
from functools import lru_cache

import boto3

from domain.streetlight.health import HealthStatus
from domain.streetlight.models import Streetlight
from libs.config import settings


_DYNAMODB = boto3.resource(
    "dynamodb",
    region_name=settings.AWS_REGION,
    endpoint_url=settings.DYNAMO_ENDPOINT or None,
)


class StreetlightMetadataRepo:
    def __init__(self, table_name: str):
        self.table = _DYNAMODB.Table(table_name)

    def get(self, streetlight_id: str) -> Optional[Streetlight]:
        resp = self.table.get_item(
            Key={
                "streetlight_id": streetlight_id,
                "SK": "METADATA",
            }
        )
        item = resp.get("Item")
        if not item:
            return None
        return Streetlight(
            tenant_id="",
            streetlight_id=item["streetlight_id"],
            health=HealthStatus.UNKNOWN,
            lat=float(item["lat"]),
            lng=float(item["lng"]),
            name=item.get("name"),
        )


@lru_cache(maxsize=1)
def get_streetlight_metadata_repo() -> StreetlightMetadataRepo:
    return StreetlightMetadataRepo(
        table_name=settings.DDB_TABLE_STREETLIGHT_METADATA
    )
