from __future__ import annotations
from functools import lru_cache

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from domain.tenant.models import Tenant, TenantUser
from infrastructure.persistence.dynamo.client import get_dynamodb_resource
from infrastructure.persistence.error import PersistenceError


class UserTenantRepo:
    TENANT_SK = "TENANT"

    def __init__(self, table_name: str) -> None:
        self._db = get_dynamodb_resource()
        self._table = self._db.Table(table_name)

    def get_tenant(self, tenant_id: str) -> Tenant | None:
        try:
            result = self._table.get_item(
                Key={"tenant_id": tenant_id, "user_id": self.TENANT_SK}
            )
            item = result.get("Item")
            if not item:
                return None
            return Tenant(
                tenant_id=item["tenant_id"],
                name=item["name"],
                owner_user_id=item["owner_user_id"],
                max_users=int(item["max_users"]),
                created_at=item["created_at"],
            )
        except ClientError as e:
            raise PersistenceError(
                f"Failed to retrieve tenant: {tenant_id}"
            ) from e

    def save_tenant(self, tenant: Tenant) -> None:
        try:
            self._table.put_item(Item={
                "tenant_id": tenant.tenant_id,
                "user_id": self.TENANT_SK,
                "name": tenant.name,
                "owner_user_id": tenant.owner_user_id,
                "max_users": tenant.max_users,
                "created_at": tenant.created_at,
            })
        except ClientError as e:
            raise PersistenceError(
                f"Failed to save tenant: {tenant.tenant_id}"
            ) from e

    def get_user(
        self, tenant_id: str, user_id: str
    ) -> TenantUser | None:
        try:
            result = self._table.get_item(
                Key={"tenant_id": tenant_id, "user_id": user_id}
            )
            item = result.get("Item")
            if not item:
                return None
            return self._item_to_user(item)
        except ClientError as e:
            raise PersistenceError(
                f"Failed to retrieve user: {user_id}"
            ) from e

    def count_users(self, tenant_id: str) -> int:
        try:
            result = self._table.query(
                KeyConditionExpression=(
                    Key("tenant_id").eq(tenant_id)
                    & Key("user_id").begins_with("u-")
                ),
                Select="COUNT",
            )
            return result.get("Count", 0)
        except ClientError as e:
            raise PersistenceError(
                f"Failed to count users for tenant: {tenant_id}"
            ) from e

    def list_users(self, tenant_id: str) -> list[TenantUser]:
        try:
            items = []
            kwargs = {
                "KeyConditionExpression": (
                    Key("tenant_id").eq(tenant_id)
                    & Key("user_id").begins_with("u-")
                )
            }
            while True:
                result = self._table.query(**kwargs)
                items.extend(result.get("Items", []))
                last = result.get("LastEvaluatedKey")
                if not last:
                    break
                kwargs["ExclusiveStartKey"] = last
            return [self._item_to_user(item) for item in items]
        except ClientError as e:
            raise PersistenceError(
                f"Failed to list users for tenant: {tenant_id}"
            ) from e

    def save_user(self, user: TenantUser) -> None:
        try:
            self._table.put_item(Item={
                "tenant_id": user.tenant_id,
                "user_id": user.user_id,
                "email": user.email,
                "role": user.role,
                "created_at": user.created_at,
            })
        except ClientError as e:
            raise PersistenceError(
                f"Failed to save user: {user.user_id}"
            ) from e

    def delete_user(self, tenant_id: str, user_id: str) -> None:
        try:
            self._table.delete_item(
                Key={"tenant_id": tenant_id, "user_id": user_id}
            )
        except ClientError as e:
            raise PersistenceError(
                f"Failed to delete user: {user_id}"
            ) from e

    @staticmethod
    def _item_to_user(item: dict) -> TenantUser:
        return TenantUser(
            tenant_id=item["tenant_id"],
            user_id=item["user_id"],
            email=item["email"],
            role=item["role"],
            created_at=item["created_at"],
        )


@lru_cache(maxsize=1)
def get_user_tenant_repo() -> UserTenantRepo:
    from libs.config import settings

    return UserTenantRepo(
        table_name=settings.DDB_TABLE_USERS_AND_TENANTS

    )
    
