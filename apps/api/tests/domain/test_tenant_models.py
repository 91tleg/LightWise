import pytest
from domain.tenant.models import TenantUser


@pytest.fixture
def tenant_user():
    return TenantUser(
        tenant_id="tenant-001",
        user_id="u-123",
        email="ops@city.gov",
        role="ADMIN",
        created_at="2026-01-10T14:05:00Z",
    )


def test_to_dict_structure(tenant_user):
    result = tenant_user.to_dict()
    assert result["tenant_id"] == "tenant-001"
    assert result["user_id"] == "u-123"
    assert result["email"] == "ops@city.gov"
    assert result["role"] == "ADMIN"
    assert result["created_at"] == "2026-01-10T14:05:00Z"


def test_to_dict_all_keys_present(tenant_user):
    result = tenant_user.to_dict()
    assert set(result.keys()) == {
        "tenant_id", "user_id", "email", "role", "created_at"
    }
