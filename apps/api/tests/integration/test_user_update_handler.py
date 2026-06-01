import json
import uuid

import boto3
import pytest
from botocore.exceptions import ClientError


DYNAMO_ENDPOINT = "http://localhost:8000"
TABLE_NAME = "UsersAndTenants"


@pytest.fixture
def users_table(monkeypatch):
    from libs.config import settings
    from infrastructure.persistence.dynamo import client as dynamo_client
    from infrastructure.persistence.dynamo import user_tenant_repo
    from infrastructure.handlers import user_update

    settings.AWS_REGION = "us-west-2"
    settings.DYNAMO_ENDPOINT = DYNAMO_ENDPOINT
    settings.DDB_TABLE_USERS_AND_TENANTS = TABLE_NAME
    settings.AUTH_ENABLED = True

    dynamo_client._DYNAMODB = None
    user_tenant_repo.get_user_tenant_repo.cache_clear()
    user_update._use_case.cache_clear()

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


def test_update_user_name_through_handler_use_case_repo_and_dynamodb(
    users_table,
):
    from infrastructure.handlers.user_update import handler

    tenant_id = f"tenant-{uuid.uuid4()}"
    owner_user_id = f"u-owner-{uuid.uuid4()}"
    update_user_id = f"u-user-{uuid.uuid4()}"

    users_table.put_item(
        Item={
            "tenant_id": tenant_id,
            "user_id": "TENANT",
            "name": "Test Tenant",
            "owner_user_ids": [owner_user_id],
            "max_users": 5,
            "created_at": "2026-05-28T12:00:00Z",
        }
    )

    users_table.put_item(
        Item={
            "tenant_id": tenant_id,
            "user_id": update_user_id,
            "name": "Old Name",
            "email": "update.user@example.com",
            "role": "operator",
            "created_at": "2026-05-28T12:05:00Z",
        }
    )

    event = {
        "pathParameters": {
            "id": update_user_id,
        },
        "body": json.dumps({
            "name": "New Name",
        }),
        "requestContext": {
            "authorizer": {
                "claims": {
                    "custom:tenant_id": tenant_id,
                    "sub": owner_user_id,
                }
            }
        },
    }

    response = handler(event, None)

    assert response["statusCode"] == 200

    body = json.loads(response["body"])

    assert body["tenant_id"] == tenant_id
    assert body["user_id"] == update_user_id
    assert body["name"] == "New Name"
    assert body["email"] == "update.user@example.com"
    assert body["role"] == "operator"

    saved = users_table.get_item(
        Key={
            "tenant_id": tenant_id,
            "user_id": update_user_id,
        }
    )

    assert saved["Item"]["name"] == "New Name"
