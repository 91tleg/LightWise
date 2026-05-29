import json
import uuid

import boto3
import pytest
from botocore.exceptions import ClientError


DYNAMO_ENDPOINT = "http://localhost:8000"
METADATA_TABLE = "StreetlightMetadata"
COMMANDS_TABLE = "DownlinkCommands"


@pytest.fixture
def dynamodb_tables(monkeypatch):
    from libs.config import settings
    from infrastructure.persistence.dynamo import client as dynamo_client
    from infrastructure.persistence.dynamo import downlink_command_repo
    from infrastructure.persistence.dynamo import streetlight_metadata_repo
    from infrastructure.handlers import streetlights_send_command

    settings.AWS_REGION = "us-west-2"
    settings.DYNAMO_ENDPOINT = DYNAMO_ENDPOINT
    settings.DDB_TABLE_STREETLIGHT_METADATA = METADATA_TABLE
    settings.DDB_TABLE_DOWNLINK_COMMANDS = COMMANDS_TABLE
    settings.AUTH_ENABLED = True

    dynamo_client._DYNAMODB = None
    downlink_command_repo.get_downlink_command_repo.cache_clear()
    streetlight_metadata_repo.get_streetlight_metadata_repo.cache_clear()
    streetlights_send_command._use_case.cache_clear()

    db = boto3.resource(
        "dynamodb",
        region_name="us-west-2",
        endpoint_url=DYNAMO_ENDPOINT,
        aws_access_key_id="local",
        aws_secret_access_key="local",
    )

    metadata_table = db.Table(METADATA_TABLE)
    commands_table = db.Table(COMMANDS_TABLE)

    try:
        metadata_table.load()
        commands_table.load()
    except ClientError:
        pytest.skip("Local DynamoDB is not running")

    return metadata_table, commands_table


@pytest.mark.integration
def test_send_command_through_handler_use_case_repo_and_dynamodb(
    dynamodb_tables,
    monkeypatch,
):
    from infrastructure.handlers import streetlights_send_command

    metadata_table, commands_table = dynamodb_tables

    tenant_id = f"tenant-{uuid.uuid4()}"
    user_id = f"u-{uuid.uuid4()}"
    streetlight_id = f"streetlight-{uuid.uuid4()}"
    wireless_device_id = f"wireless-{uuid.uuid4()}"
    sent_payloads = []

    class FakeDownlinkSender:
        def send(self, wireless_device_id, payload):
            sent_payloads.append((wireless_device_id, payload))

    monkeypatch.setattr(
        streetlights_send_command,
        "get_downlink_sender",
        lambda: FakeDownlinkSender(),
    )
    streetlights_send_command._use_case.cache_clear()

    metadata_table.put_item(
        Item={
            "tenant_id": tenant_id,
            "streetlight_id": streetlight_id,
            "wireless_device_id": wireless_device_id,
            "site_id": "site-001",
            "model": "test-model",
            "installed_at": "2026-05-28T12:00:00Z",
        }
    )

    event = {
        "pathParameters": {
            "id": streetlight_id,
        },
        "body": json.dumps({
            "command": "REBOOT",
            "params": {},
        }),
        "requestContext": {
            "authorizer": {
                "claims": {
                    "custom:tenant_id": tenant_id,
                    "sub": user_id,
                }
            }
        },
    }

    response = streetlights_send_command.handler(event, None)

    assert response["statusCode"] == 202

    body = json.loads(response["body"])

    assert body["streetlight_id"] == streetlight_id
    assert body["command"] == "REBOOT"
    assert body["status"] == "pending"

    assert len(sent_payloads) == 1
    assert sent_payloads[0][0] == wireless_device_id
    assert isinstance(sent_payloads[0][1], bytes)

    saved = commands_table.get_item(
        Key={
            "streetlight_id": streetlight_id,
            "command_id": body["command_id"],
        }
    )

    assert saved["Item"]["tenant_id"] == tenant_id
    assert saved["Item"]["issued_by"] == user_id
    assert saved["Item"]["command_type"] == "REBOOT"
    assert saved["Item"]["status"] == "SENT"
