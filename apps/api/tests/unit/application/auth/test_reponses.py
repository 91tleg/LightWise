import pytest

from application.auth.responses import operator_to_response


class MockOperatorProfile:
    """A mock class to simulate the OperatorProfile model."""
    def __init__(self):
        self.sub = "auth0|12345"
        self.tenant_id = "tenant-789"
        self.first_name = "Jane"
        self.last_name = "Doe"
        self.full_name = "Jane Doe"
        self.email = "jane.doe@example.com"
        self.role = "admin"


@pytest.fixture
def mock_profile():
    return MockOperatorProfile()


def test_operator_to_response_mapping(mock_profile):
    response = operator_to_response(mock_profile)

    assert response["sub"] == "auth0|12345"
    assert response["tenant_id"] == "tenant-789"
    assert response["first_name"] == "Jane"
    assert response["last_name"] == "Doe"
    assert response["name"] == "Jane Doe"
    assert response["email"] == "jane.doe@example.com"
    assert response["role"] == "admin"

    assert len(response) == 7
