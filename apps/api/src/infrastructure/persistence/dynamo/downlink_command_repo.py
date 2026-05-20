from __future__ import annotations
from dataclasses import asdict
from functools import lru_cache
from datetime import datetime, timezone
from domain.streetlight.models import DownlinkCommandRecord
from decimal import Decimal

from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from domain.streetlight.commands import StreetlightCommand
from infrastructure.persistence.error import PersistenceError
from infrastructure.persistence.dynamo.client import get_dynamodb_resource


STATUS_PENDING = "PENDING"
STATUS_SENT = "SENT"
STATUS_ACKNOWLEDGED = "ACKNOWLEDGED"
STATUS_FAILED = "FAILED"


class DownlinkCommandRepo:
    """
    Persistence for the DownlinkCommands table.

    Covers the full command lifecycle:
      - write()         - initial PENDING record on command issuance
      - mark_sent()     - PENDING -> SENT after network server accepts
      - update_status() - PENDING/SENT -> ACKNOWLEDGED | FAILED on ACK/NACK
      - get()           - fetch a single command record
      - list_for_streetlight() - per-device command history
      - list_for_tenant()      - fleet-wide audit log via GSI
    """

    def __init__(self, table_name: str) -> None:
        self._db = get_dynamodb_resource()
        self._table = self._db.Table(table_name)
        
    def _deserialize(
        self,
        item: dict,
    ) -> DownlinkCommandRecord:
        return DownlinkCommandRecord(
            streetlight_id=item["streetlight_id"],
            command_id=item["command_id"],
            tenant_id=item["tenant_id"],
            issued_by=item["issued_by"],
            command_type=item["command_type"],
            payload=self._strip_decimals(
            item.get("payload", {})
            ),
            status=item["status"],
            created_at=item["created_at"],
            sent_at=item.get("sent_at"),
            acknowledged_at=item.get("acknowledged_at"),
            reason=item.get("reason"),
        )
        
    def _strip_decimals(self, value):
        if isinstance(value, list):
            return [self._strip_decimals(v) for v in value]

        if isinstance(value, dict):
            return {
                key: self._strip_decimals(item)
                for key, item in value.items()
            }

        if isinstance(value, Decimal):
            return int(value)

        return value

    def write(
        self,
        streetlight_id: str,
        command_id: str,
        tenant_id: str,
        issued_by: str,
        command: StreetlightCommand,
        ttl: int,
    ) -> None:
        """
        Write an initial PENDING command record.

        Called immediately when a downlink command is issued, before
        the network server call. TTL guards against stale PENDING items
        if the Lambda fails after dispatching but before writing SENT.
        """
        now = datetime.now(timezone.utc).isoformat()
        try:
            self._table.put_item(Item={
                "streetlight_id": streetlight_id,
                "command_id": command_id,
                "tenant_id": tenant_id,
                "issued_by": issued_by,
                "command_type": command.command.name,
                "payload": asdict(command.params),
                "status": STATUS_PENDING,
                "created_at": now,
                "sent_at": None,
                "acknowledged_at": None,
                "ttl": ttl,
                "echo_cmd": command.command.value,
            })
        except ClientError as e:
            raise PersistenceError(
                f"Failed to write command: {command_id}"
            ) from e

    def mark_sent(self, streetlight_id: str, command_id: str) -> None:
        """
        Transition PENDING -> SENT after the network server accepts downlink.
        """
        now = datetime.now(timezone.utc).isoformat()
        try:
            self._table.update_item(
                Key={
                    "streetlight_id": streetlight_id,
                    "command_id": command_id,
                },
                UpdateExpression="SET #s = :sent, sent_at = :now",
                ConditionExpression="#s = :pending",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":sent": STATUS_SENT,
                    ":pending": STATUS_PENDING,
                    ":now": now,
                },
            )
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "ConditionalCheckFailedException":
                return
            raise PersistenceError(
                f"Failed to mark command sent: {command_id}"
            ) from e

    def update_status(
        self,
        streetlight_id: str,
        echo_cmd: int,
        response: str,
        reason: str,
    ) -> None:
        """
        Transition PENDING/SENT -> ACKNOWLEDGED | FAILED on ACK/NACK.

        Resolves the command by finding the most recent dispatchable record
        for the streetlight matching the echo_cmd, then updates its status.

        response - "ACK" or "NACK" (ResponseCode.name)
        reason   - ReasonCode.name (e.g. "OK", "NVS_ERROR")
        """
        command = self._find_ackable_command(streetlight_id, echo_cmd)
        if not command:
            return

        final_status = (
            STATUS_ACKNOWLEDGED
            if response == "ACK"
            else STATUS_FAILED
        )
        now = datetime.now(timezone.utc).isoformat()

        try:
            self._table.update_item(
                Key={
                    "streetlight_id": streetlight_id,
                    "command_id": command["command_id"],
                },
                UpdateExpression=(
                    "SET #s = :status, "
                    "acknowledged_at = :now, "
                    "reason = :reason"
                ),
                ConditionExpression="#s IN (:pending, :sent)",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":status": final_status,
                    ":pending": STATUS_PENDING,
                    ":sent": STATUS_SENT,
                    ":now": now,
                    ":reason": reason,
                },
            )

        except ClientError as e:
            if e.response.get(
                "Error", {}
            ).get("Code") == "ConditionalCheckFailedException":
                return
            raise PersistenceError(
                "Failed to update command status for streetlight"
            ) from e

    def get(self, streetlight_id: str, command_id: str) -> DownlinkCommandRecord  | None:
        """Fetch a single command record by primary key."""
        try:
            result = self._table.get_item(
                Key={
                    "streetlight_id": streetlight_id,
                    "command_id": command_id,
                }
            )
            item = result.get("Item")
            return self._deserialize(item) if item else None

        except ClientError as e:
            raise PersistenceError(
                f"Failed to get command: {command_id}"
            ) from e

    def list_for_streetlight(
        self,
        streetlight_id: str,
        tenant_id: str | None = None,
        limit: int = 50,
    ) -> list[DownlinkCommandRecord]:
        """
        List recent commands for a single streetlight.

        Results are ordered by command_id (time-prefixed) descending
        so the most recent command is first.
        """
        query_kwargs = {
            "KeyConditionExpression": Key("streetlight_id").eq(streetlight_id),
            "ScanIndexForward": False,
            "Limit": limit,
        }

        if tenant_id:
            query_kwargs["FilterExpression"] = Attr("tenant_id").eq(tenant_id)

        try:
            result = self._table.query(**query_kwargs)
            return result.get("Items", [])

        except ClientError as e:
            raise PersistenceError(
                "Failed to list commands"
            ) from e

    def list_for_tenant(
        self,
        tenant_id: str,
        limit: int = 50,
    ) -> list[DownlinkCommandRecord]:
        """
        List recent commands across all streetlights for a tenant.

        Uses the ByTenant GSI. Results ordered by command_id descending.
        """
        try:
            result = self._table.query(
                IndexName="ByTenant",
                KeyConditionExpression=Key("tenant_id").eq(tenant_id),
                ScanIndexForward=False,
                Limit=limit,
            )
            items = result.get("Items", [])
            return [self._deserialize(item) for item in items]

        except ClientError as e:
            raise PersistenceError(
                f"Failed to list commands for tenant: {tenant_id}"
            ) from e

    def _find_ackable_command(
        self, streetlight_id: str, echo_cmd: int
    ) -> dict | None:
        try:
            result = self._table.query(
                KeyConditionExpression=Key(
                    "streetlight_id"
                ).eq(streetlight_id),
                FilterExpression=(
                    "#s IN (:pending, :sent) AND echo_cmd = :echo"
                ),
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":pending": STATUS_PENDING,
                    ":sent": STATUS_SENT,
                    ":echo": echo_cmd
                },
                ScanIndexForward=False,
                Limit=10
            )
            items = result.get("Items", [])
            return items[0] if items else None

        except ClientError as e:
            raise PersistenceError(
                "Failed to query commands"
            ) from e


@lru_cache(maxsize=1)
def get_downlink_command_repo() -> DownlinkCommandRepo:
    from libs.config import settings

    return DownlinkCommandRepo(
        table_name=settings.DDB_TABLE_DOWNLINK_COMMANDS
    )
