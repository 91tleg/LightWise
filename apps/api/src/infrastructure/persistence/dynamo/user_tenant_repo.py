from typing import Optional
from functools import lru_cache

import boto3
from boto3.dynamodb.conditions import Key

from infrastructure.persistence.error import PersistenceError
from domain.tenant.models import Tenant, TenantUser
from libs.config import settings


_DYNAMODB = boto3.resource(
    "dynamodb",
    region_name=settings.AWS_REGION,
    endpoint_url=settings.DYNAMO_ENDPOINT or None,
)


class UserTenantRepo:
    TENANT_SK = "TENANT"

    def __init__(self, table_name: str):
        self.table = _DYNAMODB.Table(table_name)

    def get_tenant(self, tenant_id: str) -> Optional[Tenant]:
        try:
            result = self.table.get_item(
                Key={"tenant_id": tenant_id, "user_id": self.TENANT_SK}
            )
            item = result.get("Item")
            if not item:
                return None
            return Tenant(
                tenant_id=item["tenant_id"],
                name=item["name"],
                created_at=item["created_at"],
            )
        except Exception as e:
            raise PersistenceError(
                f"Failed to retrieve tenant data: {tenant_id}"
            ) from e

    def save_tenant(self, tenant: Tenant) -> None:
        try:
            self.table.put_item(Item={
                "tenant_id": tenant.tenant_id,
                "user_id": self.TENANT_SK,
                "name": tenant.name,
                "created_at": tenant.created_at,
            })
        except Exception as e:
            raise PersistenceError(
                f"Failed to save tenant: {tenant.tenant_id}"
            ) from e

    def get_user(self, tenant_id: str, user_id: str) -> Optional[TenantUser]:
        try:
            result = self.table.get_item(
                Key={"tenant_id": tenant_id, "user_id": user_id}
            )
            item = result.get("Item")
            if not item:
                return None
            return TenantUser(
                tenant_id=item["tenant_id"],
                user_id=item["user_id"],
                email=item["email"],
                role=item["role"],
                created_at=item["created_at"],
            )
        except Exception as e:
            raise PersistenceError(
                f"Failed to retrieve user: {user_id}"
            ) from e

    def list_users(self, tenant_id: str) -> list[TenantUser]:
        try:
            result = self.table.query(
                KeyConditionExpression=Key("tenant_id").eq(tenant_id)
                & Key("user_id").begins_with("u-")
            )
            return [
                TenantUser(
                    tenant_id=item["tenant_id"],
                    user_id=item["user_id"],
                    email=item["email"],
                    role=item["role"],
                    created_at=item["created_at"],
                )
                for item in result.get("Items", [])
            ]
        except Exception as e:
            raise PersistenceError(
                f"Failed to list users for tenant: {tenant_id}"
            ) from e

    def save_user(self, user: TenantUser) -> None:
        try:
            self.table.put_item(Item={
                "tenant_id": user.tenant_id,
                "user_id": user.user_id,
                "email": user.email,
                "role": user.role,
                "created_at": user.created_at,
            })
        except Exception as e:
            raise PersistenceError(
                f"Failed to save user: {user.user_id}"
            ) from e

    def delete_user(self, tenant_id: str, user_id: str) -> None:
        try:
            self.table.delete_item(
                Key={"tenant_id": tenant_id, "user_id": user_id}
            )
        except Exception as e:
            raise PersistenceError(
                f"Failed to delete user: {user_id}"
            ) from e


@lru_cache(maxsize=1)
def get_user_tenant_repository() -> UserTenantRepo:
    return UserTenantRepo(
        table_name=settings.DDB_TABLE_USERS_AND_TENANTS
    )
