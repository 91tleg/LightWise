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
    from infrastructure.handlers import user_list

    settings.AWS_REGION = "us-west-2"
    settings.DYNAMO_ENDPOINT = DYNAMO_ENDPOINT
    settings.DDB_TABLE_USERS_AND_TENANTS = TABLE_NAME
    settings.AUTH_ENABLED = True

    dynamo_client._DYNAMODB = None
    user_tenant_repo.get_user_tenant_repo.cache_clear()
    user_list._use_case.cache_clear()

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


@pytest.mark.integration
def test_list_users_through_handler_use_case_repo_and_dynamodb(
    users_table,
):
    from infrastructure.handlers.user_list import handler

    tenant_id = f"tenant-{uuid.uuid4()}"
    user_id = f"u-{uuid.uuid4()}"

    users_table.put_item(
        Item={
            "tenant_id": tenant_id,
            "user_id": user_id,
            "email": "test.user@example.com",
            "role": "admin",
            "created_at": "2026-05-28T12:00:00Z",
        }
    )

    event = {
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

    users = json.loads(response["body"])

    assert len(users) == 1
    assert users[0]["tenant_id"] == tenant_id
    assert users[0]["user_id"] == user_id
    assert users[0]["email"] == "test.user@example.com"
    assert users[0]["role"] == "admin"
    assert users[0]["created_at"] == "2026-05-28T12:00:00Z"
