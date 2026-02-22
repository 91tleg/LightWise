from __future__ import annotations
from functools import lru_cache

import boto3
from boto3.dynamodb.conditions import Key

from domain.tenant.models import Tenant
from libs.config import settings


class TenantRepositoryError(Exception):
    """Base tenant repository error."""


class TenantNotFoundError(TenantRepositoryError):
    """Raised when a tenant does not exist or no devices found."""


_DYNAMODB = boto3.resource("dynamodb", region_name=settings.AWS_REGION)


class TenantRepository:
    """
    DynamoDB-backed repository for tenants.
    Maps devices (streetlights) to tenants.
    """
    def __init__(self, table_name: str):
        self._table = _DYNAMODB.Table(table_name)

    def get_tenant_id_for_device(self, streetlight_id: str) -> str:
        """Returns just the string ID to save memory/processing."""
        response = self._table.query(
            IndexName="StreetlightIdIndex",
            KeyConditionExpression=Key("streetlight_id").eq(streetlight_id),
            ProjectionExpression="tenant_id"  # Only fetch the ID column
        )
        items = response.get("Items")
        if not items:
            raise TenantNotFoundError(
                f"Streetlight {streetlight_id} "
                "not found"
            )
        return items[0]["tenant_id"]

    def get_by_id(self, tenant_id: str) -> Tenant:
        response = self._table.get_item(Key={"tenant_id": tenant_id})
        item = response.get("Item")
        if not item:
            raise TenantNotFoundError(f"Tenant {tenant_id} not found")
        return Tenant(
            tenant_id=item["tenant_id"],
            name=item.get("name"),
            metadata=item.get("metadata")
        )

    def put(self, tenant: Tenant) -> None:
        if "tenant_id" not in tenant:
            raise ValueError("tenant_id is required")
        self._table.put_item(Item=tenant)


@lru_cache(maxsize=1)
def get_tenant_repository() -> TenantRepository:
    return TenantRepository(table_name=settings.DDB_TABLE_TENANTS)
