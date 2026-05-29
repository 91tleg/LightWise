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
    from infrastructure.handlers import user_invite

    settings.AWS_REGION = "us-west-2"
    settings.DYNAMO_ENDPOINT = DYNAMO_ENDPOINT
    settings.DDB_TABLE_USERS_AND_TENANTS = TABLE_NAME
    settings.AUTH_ENABLED = True
    settings.COGNITO_USER_POOL_ID = "local-user-pool"

    dynamo_client._DYNAMODB = None
    user_tenant_repo.get_user_tenant_repo.cache_clear()
    user_invite._use_case.cache_clear()

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
def test_invite_user_through_handler_use_case_repo_and_dynamodb(
    users_table,
    monkeypatch,
):
    from infrastructure.handlers import user_invite

    tenant_id = f"tenant-{uuid.uuid4()}"
    owner_user_id = f"u-owner-{uuid.uuid4()}"
    invited_user_id = f"u-invited-{uuid.uuid4()}"

    def fake_create_cognito_user(
        user_pool_id,
        email,
        tenant_id,
        role,
    ):
        return invited_user_id

    monkeypatch.setattr(
        user_invite,
        "create_cognito_user",
        fake_create_cognito_user,
    )
    user_invite._use_case.cache_clear()

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

    event = {
        "body": json.dumps({
            "email": "new.user@example.com",
            "role": "operator",
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

    response = user_invite.handler(event, None)

    assert response["statusCode"] == 201

    body = json.loads(response["body"])

    assert body["tenant_id"] == tenant_id
    assert body["user_id"] == invited_user_id
    assert body["email"] == "new.user@example.com"
    assert body["role"] == "operator"

    saved = users_table.get_item(
        Key={
            "tenant_id": tenant_id,
            "user_id": invited_user_id,
        }
    )

    assert saved["Item"]["email"] == "new.user@example.com"
    assert saved["Item"]["role"] == "operator"
