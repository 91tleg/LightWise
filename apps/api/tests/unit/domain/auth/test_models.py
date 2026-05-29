import pytest
from domain.auth.models import OperatorProfile


def test_operator_profile_full_name_construction():
    profile = OperatorProfile(
        sub="123",
        tenant_id="T1",
        first_name="  Jane  ",
        last_name="Doe",
        email="jane@example.com",
        role="admin"
    )
    assert profile.full_name == "Jane Doe"


def test_operator_profile_is_immutable():
    profile = OperatorProfile(
        sub="123", tenant_id="T1", first_name="A",
        last_name="B", email="a@b.com", role="operator"
    )
    with pytest.raises(AttributeError):
        profile.role = "admin"


def test_full_name_with_missing_parts():
    profile = OperatorProfile(
        sub="123", tenant_id="T1", first_name="Jane",
        last_name="", email="p@example.com", role="operator"
    )
    assert profile.full_name == "Jane"
