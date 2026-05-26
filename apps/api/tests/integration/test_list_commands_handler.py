import json
import uuid

import boto3
import pytest
from botocore.exceptions import ClientError


DYNAMO_ENDPOINT = "http://localhost:8000"
TABLE_NAME = "DownlinkCommands"


@pytest.fixture
def downlink_table(monkeypatch):
    from libs.config import settings
    from infrastructure.persistence.dynamo import client as dynamo_client
    from infrastructure.persistence.dynamo import downlink_command_repo
    from infrastructure.handlers import streetlights_commands_list

    settings.AWS_REGION = "us-west-2"
    settings.DYNAMO_ENDPOINT = DYNAMO_ENDPOINT
    settings.DDB_TABLE_DOWNLINK_COMMANDS = TABLE_NAME
    settings.AUTH_ENABLED = True

    dynamo_client._DYNAMODB = None
    downlink_command_repo.get_downlink_command_repo.cache_clear()
    streetlights_commands_list._use_case.cache_clear()

    db = boto3.resource(
        "dynamodb",
        region_name="us-west-2",
        endpoint_url=DYNAMO_ENDPOINT,
        aws_access_key_id="local",
        aws_secret_access_key="local",
    )

    table = db.Table(TABLE_NAME)

    try:
        table.load()
    except ClientError:
        pytest.skip("Local DynamoDB is not running")

    return table


def test_list_commands_through_handler_use_case_repo_and_dynamodb(
    downlink_table,
):
    from infrastructure.handlers.streetlights_commands_list import handler

    tenant_id = "tenant-integration"
    streetlight_id = f"streetlight-{uuid.uuid4()}"
    command_id = "2026-05-26T12:00:00Z#cmd-001"

    downlink_table.put_item(
        Item={
            "streetlight_id": streetlight_id,
            "command_id": command_id,
            "tenant_id": tenant_id,
            "issued_by": "user-001",
            "command_type": "REBOOT",
            "payload": {},
            "status": "SENT",
            "created_at": "2026-05-26T12:00:00Z",
            "sent_at": "2026-05-26T12:00:01Z",
            "acknowledged_at": None,
            "reason": None,
            "ttl": 9999999999,
            "echo_cmd": 1,
        }
    )

    event = {
        "pathParameters": {
            "streetlight_id": streetlight_id,
        },
        "queryStringParameters": {
            "limit": "10",
        },
        "requestContext": {
            "authorizer": {
                "claims": {
                    "custom:tenant_id": tenant_id,
                    "sub": "user-001",
                }
            }
        },
    }

    response = handler(event, None)

    assert response["statusCode"] == 200

    body = json.loads(response["body"])
    commands = body["commands"]

    assert len(commands) == 1
    assert commands[0]["streetlight_id"] == streetlight_id
    assert commands[0]["command_id"] == command_id
    assert commands[0]["tenant_id"] == tenant_id
    assert commands[0]["command_type"] == "REBOOT"
    assert commands[0]["status"] == "SENT"
