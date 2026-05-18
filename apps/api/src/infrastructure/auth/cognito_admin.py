"""
Cognito admin operations.
Wraps AdminCreateUser and AdminDeleteUser for the invite system.
"""

from __future__ import annotations
import boto3
from botocore.exceptions import ClientError

from domain.errors import AuthError


def create_cognito_user(
    user_pool_id: str,
    email: str,
    tenant_id: str,
    role: str,
) -> str:
    """
    Create a Cognito user via AdminCreateUser.
    Returns the sub of the created user.
    """
    client = _get_client()
    try:
        response = client.admin_create_user(
            UserPoolId=user_pool_id,
            Username=email,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "custom:tenant_id", "Value": tenant_id},
            ],
            DesiredDeliveryMediums=["EMAIL"],
        )
        user = response["User"]
        sub = next(
            attr["Value"]
            for attr in user["Attributes"]
            if attr["Name"] == "sub"
        )
        return sub
    except ClientError as e:
        code = e.response["Error"]["Code"]
        message = e.response["Error"]["Message"]
        if code == "UsernameExistsException":
            raise AuthError(f"User already exists: {email}") from e
        if code == "InvalidParameterException":
            raise AuthError(
                f"Invalid parameter creating user: {email}: {message}"
            ) from e
        raise AuthError(
            f"Failed to create Cognito user: {email}: {message}"
        ) from e


def delete_cognito_user(user_pool_id: str, email: str) -> None:
    """
    Permanently delete a Cognito user via AdminDeleteUser.
    """
    client = _get_client()
    try:
        client.admin_delete_user(
            UserPoolId=user_pool_id,
            Username=email,
        )
    except ClientError as e:
        code = e.response["Error"]["Code"]
        message = e.response["Error"]["Message"]
        if code == "UserNotFoundException":
            raise AuthError(
                f"User not found in Cognito: {email}: {message}"
            ) from e
        raise AuthError(
            f"Failed to delete Cognito user: {email}: {message}"
        ) from e


def _get_client():
    return boto3.client("cognito-idp")
