from __future__ import annotations
from typing import Dict, Any
import boto3
from libs.config import settings


class UserRepositoryError(Exception):
    """Base user repository error."""


class UserNotFoundError(UserRepositoryError):
    """Raised when a user does not exist."""


_DYNAMODB = boto3.resource("dynamodb", region_name=settings.AWS_REGION)


class UserRepository:
    """
    DynamoDB-backed repository for users.
    """
    def __init__(self, table_name: str):
        self._table = _DYNAMODB.Table(table_name)

    def get_by_id(self, user_id: str) -> Dict[str, Any]:
        response = self._table.get_item(Key={"user_id": user_id})
        item = response.get("Item")
        if item is None:
            raise UserNotFoundError(f"User {user_id} not found")
        return item


    def put(self, user: Dict[str, Any]) -> None:
        if "user_id" not in user:
            raise ValueError("user_id is required")
        self._table.put_item(Item=user)


    def update_fields(self, user_id: str, fields: Dict[str, Any]) -> None:
        if not fields:
            return
        update_expr = []
        expr_values = {}
        for key, value in fields.items():
            placeholder = f":{key}"
            update_expr.append(f"{key} = {placeholder}")
            expr_values[placeholder] = value
        self._table.update_item(
            Key={"user_id": user_id},
            UpdateExpression="SET " + ", ".join(update_expr),
            ExpressionAttributeValues=expr_values,
        )


    def delete(self, user_id: str) -> None:
        self._table.delete_item(Key={"user_id": user_id})


from functools import lru_cache

@lru_cache(maxsize=1)
def get_user_repository() -> UserRepository:
    return UserRepository(table_name=settings.DDB_TABLE_USERS)
