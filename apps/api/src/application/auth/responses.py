from typing import Any
from domain.auth.models import OperatorProfile


def operator_to_response(profile: OperatorProfile) -> dict[str, Any]:
    """
    Serializes the OperatorProfile for the frontend 'Me' endpoint.
    """
    return {
        "sub": profile.sub,
        "tenant_id": profile.tenant_id,
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "name": profile.full_name,
        "email": profile.email,
        "role": profile.role,
    }
