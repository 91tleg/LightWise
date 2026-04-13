from functools import lru_cache
from decimal import Decimal
from datetime import datetime

from boto3.dynamodb.conditions import Key

from domain.streetlight.models import StreetlightMetadata
from infrastructure.persistence.dynamo.client import get_dynamodb_resource
from infrastructure.persistence.error import PersistenceError


def _optional(key: str, value, transform=None):
    if value is None:
        return {}
    return {key: transform(value) if transform else value}


class StreetlightMetadataRepo:
    def __init__(self, table_name: str):
        self._db = get_dynamodb_resource()
        self._table = self._db.Table(table_name)

    def get(
        self, tenant_id: str, streetlight_id: str
    ) -> StreetlightMetadata | None:
        try:
            resp = self._table.get_item(Key={
                "tenant_id": tenant_id,
                "streetlight_id": streetlight_id,
            })
            item = resp.get("Item")
            if not item:
                return None
            return self._from_item(item)
        except Exception as e:
            raise PersistenceError(
                f"Failed to retrieve metadata: {streetlight_id}"
            ) from e

    def save(self, tenant_id: str, metadata: StreetlightMetadata) -> None:
        try:
            self._table.put_item(Item={
                "tenant_id": tenant_id,
                "streetlight_id": metadata.streetlight_id,
                "wireless_device_id": metadata.wireless_device_id,
                "site_id": metadata.site_id,
                "model": metadata.model,
                "installed_at": metadata.installed_at.isoformat(),
                **_optional("name", metadata.name),
                **_optional("lat", metadata.lat, lambda v: Decimal(str(v))),
                **_optional("lng", metadata.lng, lambda v: Decimal(str(v))),
            })
        except Exception as e:
            raise PersistenceError(
                f"Failed to save metadata: {metadata.streetlight_id}"
            ) from e

    def list_by_tenant(self, tenant_id: str) -> list[StreetlightMetadata]:
        try:
            items = []
            kwargs = {"KeyConditionExpression": Key("tenant_id").eq(tenant_id)}
            while True:
                response = self._table.query(**kwargs)
                items.extend(response.get("Items", []))
                last = response.get("LastEvaluatedKey")
                if not last:
                    break
                kwargs["ExclusiveStartKey"] = last
            return [self._from_item(item) for item in items]
        except Exception as e:
            raise PersistenceError(
                f"Could not retrieve metadata for tenant {tenant_id}"
            ) from e

    @staticmethod
    def _from_item(item: dict) -> StreetlightMetadata:
        raw_lat = item.get("lat")
        raw_lng = item.get("lng")
        return StreetlightMetadata(
            streetlight_id=item["streetlight_id"],
            wireless_device_id=item["wireless_device_id"],
            site_id=item["site_id"],
            name=item.get("name"),
            lat=float(raw_lat) if raw_lat is not None else None,
            lng=float(raw_lng) if raw_lng is not None else None,
            model=item["model"],
            installed_at=datetime.fromisoformat(item["installed_at"]),
        )


@lru_cache(maxsize=1)
def get_streetlight_metadata_repo() -> StreetlightMetadataRepo:
    from libs.config import settings

    return StreetlightMetadataRepo(
        table_name=settings.DDB_TABLE_STREETLIGHT_METADATA
    )
