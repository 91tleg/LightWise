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
    from infrastructure.handlers import user_remove

    settings.AWS_REGION = "us-west-2"
    settings.DYNAMO_ENDPOINT = DYNAMO_ENDPOINT
    settings.DDB_TABLE_USERS_AND_TENANTS = TABLE_NAME
    settings.AUTH_ENABLED = True
    settings.COGNITO_USER_POOL_ID = "local-user-pool"

    dynamo_client._DYNAMODB = None
    user_tenant_repo.get_user_tenant_repo.cache_clear()
    user_remove._use_case.cache_clear()

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
def test_remove_user_through_handler_use_case_repo_and_dynamodb(
    users_table,
    monkeypatch,
):
    from infrastructure.handlers import user_remove

    tenant_id = f"tenant-{uuid.uuid4()}"
    owner_user_id = f"u-owner-{uuid.uuid4()}"
    remove_user_id = f"u-remove-{uuid.uuid4()}"
    deleted_emails = []

    def fake_delete_cognito_user(user_pool_id, email):
        deleted_emails.append(email)

    monkeypatch.setattr(
        user_remove,
        "delete_cognito_user",
        fake_delete_cognito_user,
    )
    user_remove._use_case.cache_clear()

    users_table.put_item(
        Item={
            "tenant_id": tenant_id,
            "user_id": "TENANT#META",
            "name": "Test Tenant",
            "owner_user_ids": [owner_user_id],
            "max_users": 5,
            "created_at": "2026-05-28T12:00:00Z",
        }
    )

    users_table.put_item(
        Item={
            "tenant_id": tenant_id,
            "user_id": f"USER#{remove_user_id}",
            "email": "remove.user@example.com",
            "role": "operator",
            "created_at": "2026-05-28T12:05:00Z",
        }
    )

    event = {
        "pathParameters": {
            "id": remove_user_id,
        },
        "requestContext": {
            "authorizer": {
                "claims": {
                    "custom:tenant_id": tenant_id,
                    "sub": owner_user_id,
                }
            }
        },
    }

    response = user_remove.handler(event, None)

    assert response["statusCode"] == 200

    body = json.loads(response["body"])
    assert body["message"] == "User removed"
    assert deleted_emails == ["remove.user@example.com"]

    saved = users_table.get_item(
        Key={
            "tenant_id": tenant_id,
            "user_id": f"USER#{remove_user_id}",
        }
    )

    assert "Item" not in saved
