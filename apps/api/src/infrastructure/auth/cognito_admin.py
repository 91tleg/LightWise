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
    name: str = "",
) -> str:
    """
    Create a Cognito user via AdminCreateUser.
    Returns the sub of the created user.
    """
    client = _get_client()
    first_name, last_name = _split_name(name, email)
    group_name = "admin" if role == "admin" else "operators"
    try:
        response = client.admin_create_user(
            UserPoolId=user_pool_id,
            Username=email,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "given_name", "Value": first_name},
                {"Name": "family_name", "Value": last_name},
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
        client.admin_add_user_to_group(
            UserPoolId=user_pool_id,
            Username=email,
            GroupName=group_name,
        )
        return sub
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "UsernameExistsException":
            raise AuthError(f"User already exists: {email}") from e
        if code == "InvalidParameterException":
            raise AuthError(
                f"Invalid parameter creating user: {email}"
            ) from e
        raise AuthError(
            f"Failed to create Cognito user: {email}"
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
        if code == "UserNotFoundException":
            raise AuthError(
                f"User not found in Cognito: {email}"
            ) from e
        raise AuthError(
            f"Failed to delete Cognito user: {email}"
        ) from e


def _get_client():
    return boto3.client("cognito-idp")


def _split_name(name: str, email: str) -> tuple[str, str]:
    parts = [part for part in str(name or "").strip().split() if part]
    if len(parts) >= 2:
        return parts[0], " ".join(parts[1:])
    if len(parts) == 1:
        return parts[0], "-"

    local_part = str(email or "user").split("@")[0] or "user"
    fallback = local_part.replace(".", " ").replace("_", " ").replace("-", " ").strip()
    fallback_parts = [part for part in fallback.split() if part]
    if len(fallback_parts) >= 2:
        return fallback_parts[0].title(), " ".join(part.title() for part in fallback_parts[1:])
    return (fallback_parts[0].title() if fallback_parts else "User"), "-"
