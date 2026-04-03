from typing import Optional
from functools import lru_cache
from decimal import Decimal

from infrastructure.persistence.dynamo.client import get_dynamodb_resource
from infrastructure.persistence.error import PersistenceError
from domain.streetlight.health import HealthStatus
from domain.streetlight.models import Streetlight


class StreetlightMetadataRepo:
    def __init__(self, table_name: str):
        self._db = get_dynamodb_resource()
        self._table = self._db.Table(table_name)

    def get(self, streetlight_id: str) -> Optional[Streetlight]:
        try:
            resp = self._table.get_item(
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
        except Exception as e:
            raise PersistenceError(
                f"Failed to retrieve metadata: {streetlight_id}"
            ) from e

    def update(
        self,
        streetlight_id: str,
        name: str | None = None,
        lat: float | None = None,
        lng: float | None = None,
    ) -> None:
        updates = {}
        if name is not None:
            updates["#n"] = (":n", name, "name")
        if lat is not None:
            updates["lat"] = (":lat", Decimal(str(lat)), "lat")
        if lng is not None:
            updates["lng"] = (":lng", Decimal(str(lng)), "lng")

        if not updates:
            return

        set_expr = "SET " + ", ".join(
            f"{'#n' if k == '#n' else k} = {v[0]}"
            for k, v in updates.items()
        )
        expr_values = {v[0]: v[1] for v in updates.values()}
        expr_names = {"#n": "name"} if "#n" in updates else {}

        kwargs = {
            "Key": {
                "streetlight_id": streetlight_id,
                "SK": "METADATA",
            },
            "UpdateExpression": set_expr,
            "ExpressionAttributeValues": expr_values,
        }
        if expr_names:
            kwargs["ExpressionAttributeNames"] = expr_names
        try:
            self._table.update_item(**kwargs)
        except Exception as e:
            raise PersistenceError(
                f"Failed to update metadata: {streetlight_id}"
            ) from e


@lru_cache(maxsize=1)
def get_streetlight_metadata_repo() -> StreetlightMetadataRepo:
    from libs.config import settings

    return StreetlightMetadataRepo(
        table_name=settings.DDB_TABLE_STREETLIGHT_METADATA
    )
