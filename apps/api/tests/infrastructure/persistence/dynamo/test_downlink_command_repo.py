from __future__ import annotations

from unittest.mock import MagicMock, patch

from domain.streetlight.commands import (
    DownlinkCmd,
    SetLevelsParams,
    StreetlightCommand,
)
from infrastructure.persistence.dynamo.downlink_command_repo import (
    STATUS_ACKNOWLEDGED,
    STATUS_PENDING,
    STATUS_SENT,
    DownlinkCommandRepo,
)


def _build_repo(table: MagicMock) -> DownlinkCommandRepo:
    fake_db = MagicMock()
    fake_db.Table.return_value = table

    with patch(
        "infrastructure.persistence.dynamo.downlink_command_repo"
        ".get_dynamodb_resource",
        return_value=fake_db,
    ):
        return DownlinkCommandRepo("DownlinkCommands")


def test_write_serializes_domain_command_to_dynamo_item():
    table = MagicMock()
    repo = _build_repo(table)
    command = StreetlightCommand(
        command=DownlinkCmd.SET_LEVELS,
        params=SetLevelsParams(max_level=90, dim_level=20),
    )

    repo.write(
        streetlight_id="sl-001",
        command_id="cmd-1",
        tenant_id="tenant-1",
        issued_by="user-1",
        command=command,
        ttl=1_700_000_300,
    )

    item = table.put_item.call_args.kwargs["Item"]
    assert item["command_type"] == "SET_LEVELS"
    assert item["payload"] == {"max_level": 90, "dim_level": 20}
    assert item["echo_cmd"] == 1
    assert item["status"] == STATUS_PENDING


def test_update_status_matches_pending_or_sent_command():
    table = MagicMock()
    table.query.return_value = {
        "Items": [
            {
                "streetlight_id": "sl-001",
                "command_id": "cmd-1",
                "status": STATUS_PENDING,
                "echo_cmd": 1,
            }
        ]
    }
    repo = _build_repo(table)

    repo.update_status(
        streetlight_id="sl-001",
        echo_cmd=1,
        response="ACK",
        reason="OK",
    )

    query_kwargs = table.query.call_args.kwargs
    assert query_kwargs["FilterExpression"] == (
        "#s IN (:pending, :sent) AND echo_cmd = :echo"
    )
    assert query_kwargs["ExpressionAttributeValues"][":pending"] == (
        STATUS_PENDING
    )
    assert query_kwargs["ExpressionAttributeValues"][":sent"] == STATUS_SENT
    assert query_kwargs["ScanIndexForward"] is False

    update_kwargs = table.update_item.call_args.kwargs
    assert update_kwargs["Key"] == {
        "streetlight_id": "sl-001",
        "command_id": "cmd-1",
    }
    assert update_kwargs["ConditionExpression"] == (
        "#s IN (:pending, :sent)"
    )
    assert update_kwargs["ExpressionAttributeValues"][":status"] == (
        STATUS_ACKNOWLEDGED
    )
