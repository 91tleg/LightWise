from functools import lru_cache
from decimal import Decimal
from dataclasses import dataclass
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from domain.streetlight.models import StreetlightMetadata
from infrastructure.persistence.dynamo.client import get_dynamodb_resource
from infrastructure.persistence.error import PersistenceError


LEGACY_METADATA_SK = "METADATA"


def _optional(key: str, value, transform=None):
    if value is None:
        return {}
    return {key: transform(value) if transform else value}


def _is_legacy_schema_error(exc: Exception) -> bool:
    if not isinstance(exc, ClientError):
        return False

    error = exc.response.get("Error", {})
    message = str(error.get("Message", ""))
    if error.get("Code") != "ValidationException":
        return False

    return (
        "key schema" in message.lower()
        or "Query condition missed key schema element" in message
        or "provided key element does not match the schema" in message
        or "index not found" in message.lower()
    )


def _parse_datetime(value: object) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(
            tzinfo=timezone.utc
        )

    if isinstance(value, str) and value.strip():
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return (
                parsed if parsed.tzinfo is not None else parsed.replace(
                    tzinfo=timezone.utc
                )
            )
        except ValueError:
            pass

    return datetime(1970, 1, 1, tzinfo=timezone.utc)


@dataclass(frozen=True)
class ResolvedStreetlightDevice:
    tenant_id: str
    streetlight_id: str
    site_id: str
    wireless_device_id: str


class StreetlightMetadataRepo:
    def __init__(self, table_name: str):
        self._db = get_dynamodb_resource()
        self._table = self._db.Table(table_name)

    def get(
        self, tenant_id: str, streetlight_id: str
    ) -> StreetlightMetadata | None:
        try:
            resp = self._table.get_item(
                Key={
                    "tenant_id": tenant_id,
                    "streetlight_id": streetlight_id,
                }
            )
        except Exception as e:
            if not _is_legacy_schema_error(e):
                raise PersistenceError(
                    f"Failed to retrieve metadata: {streetlight_id}"
                ) from e

            try:
                resp = self._table.get_item(
                    Key={
                        "streetlight_id": streetlight_id,
                        "SK": LEGACY_METADATA_SK,
                    }
                )
            except Exception as legacy_error:
                raise PersistenceError(
                    f"Failed to retrieve metadata: {streetlight_id}"
                ) from legacy_error

        try:
            item = resp.get("Item")
            if not item:
                return None
            return self._from_item(item)
        except Exception as e:
            raise PersistenceError(
                f"Failed to retrieve metadata: {streetlight_id}"
            ) from e

    def save(self, tenant_id: str, metadata: StreetlightMetadata) -> None:
        item = {
            "tenant_id": tenant_id,
            "streetlight_id": metadata.streetlight_id,
            "wireless_device_id": metadata.wireless_device_id,
            "site_id": metadata.site_id,
            "model": metadata.model,
            "installed_at": metadata.installed_at.isoformat(),
            **_optional("name", metadata.name),
            **_optional("lat", metadata.lat, lambda v: Decimal(str(v))),
            **_optional("lng", metadata.lng, lambda v: Decimal(str(v))),
        }
        try:
            self._table.put_item(Item=item)
        except Exception as e:
            if not _is_legacy_schema_error(e):
                raise PersistenceError(
                    f"Failed to save metadata: {metadata.streetlight_id}"
                ) from e

            try:
                self._table.put_item(
                    Item={
                        **item,
                        "SK": LEGACY_METADATA_SK,
                    }
                )
                return
            except Exception as legacy_error:
                raise PersistenceError(
                    f"Failed to save metadata: {metadata.streetlight_id}"
                ) from legacy_error

    def get_by_wireless_device_id(
        self, wireless_device_id: str
    ) -> ResolvedStreetlightDevice | None:
        try:
            response = self._table.query(
                IndexName="WirelessDeviceIndex",
                KeyConditionExpression=Key("wireless_device_id").eq(
                    wireless_device_id
                ),
                Limit=1,
            )
            items = response.get("Items", [])
        except Exception as e:
            if not _is_legacy_schema_error(e):
                raise PersistenceError(
                    "Failed to resolve streetlight metadata by wireless device"
                ) from e

            try:
                response = self._table.scan(
                    FilterExpression=Attr("wireless_device_id").eq(
                        wireless_device_id
                    )
                )
                items = response.get("Items", [])
            except Exception as legacy_error:
                raise PersistenceError(
                    "Failed to resolve streetlight metadata by wireless device"
                ) from legacy_error

        if not items:
            return None

        item = items[0]
        return ResolvedStreetlightDevice(
            tenant_id=str(item.get("tenant_id", "") or ""),
            streetlight_id=item["streetlight_id"],
            site_id=str(item.get("site_id", "") or ""),
            wireless_device_id=str(
                item.get("wireless_device_id", wireless_device_id) or ""
            ),
        )

    def list_by_tenant(self, tenant_id: str) -> list[StreetlightMetadata]:
        items = []
        kwargs = {"KeyConditionExpression": Key("tenant_id").eq(tenant_id)}
        try:
            while True:
                response = self._table.query(**kwargs)
                items.extend(response.get("Items", []))
                last = response.get("LastEvaluatedKey")
                if not last:
                    break
                kwargs["ExclusiveStartKey"] = last
        except Exception as e:
            if not _is_legacy_schema_error(e):
                raise PersistenceError(
                    f"Could not retrieve metadata for tenant {tenant_id}"
                ) from e

            try:
                scan_kwargs = {}
                while True:
                    response = self._table.scan(**scan_kwargs)
                    items.extend(
                        item
                        for item in response.get("Items", [])
                        if item.get("tenant_id") == tenant_id
                    )
                    last = response.get("LastEvaluatedKey")
                    if not last:
                        break
                    scan_kwargs["ExclusiveStartKey"] = last
            except Exception as legacy_error:
                raise PersistenceError(
                    f"Could not retrieve metadata for tenant {tenant_id}"
                ) from legacy_error

        try:
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
            wireless_device_id=str(item.get("wireless_device_id", "") or ""),
            site_id=str(item.get("site_id", "") or ""),
            name=item.get("name"),
            lat=float(raw_lat) if raw_lat is not None else None,
            lng=float(raw_lng) if raw_lng is not None else None,
            model=str(item.get("model", "") or ""),
            installed_at=_parse_datetime(item.get("installed_at")),
        )


@lru_cache(maxsize=1)
def get_streetlight_metadata_repo() -> StreetlightMetadataRepo:
    from libs.config import settings

    return StreetlightMetadataRepo(
        table_name=settings.DDB_TABLE_STREETLIGHT_METADATA
    )
