import json
import pytest
from unittest.mock import MagicMock, patch
from domain.streetlight.models import DownlinkCommandRecord
from infrastructure.persistence.error import PersistenceError


def make_event(
    streetlight_id=None,
    limit=None,
    tenant_id="tenant-001",
    user_id="user-001"
):
    return {
        "pathParameters": {
            "id": streetlight_id
        } if streetlight_id else {},
        "queryStringParameters": {"limit": str(limit)} if limit else {},
        "requestContext": {
            "authorizer": {
                "claims": {
                    "custom:tenant_id": tenant_id,
                    "sub": user_id,
                }
            }
        },
    }


def make_command_record(**kwargs):
    defaults = {
        "streetlight_id": "LW-00001",
        "command_id": "2026-05-26T12:00:00Z#cmd-001",
        "tenant_id": "tenant-001",
        "issued_by": "user-001",
        "command_type": "REBOOT",
        "payload": {},
        "status": "SENT",
        "created_at": "2026-05-26T12:00:00Z",
        "sent_at": "2026-05-26T12:00:01Z",
        "acknowledged_at": None,
        "reason": None,
    }
    return DownlinkCommandRecord(**{**defaults, **kwargs})


@pytest.fixture(autouse=True)
def clear_cache():
    from infrastructure.handlers import streetlights_list_commands
    streetlights_list_commands._use_case.cache_clear()
    yield
    streetlights_list_commands._use_case.cache_clear()


@pytest.fixture
def mock_use_case():
    with patch(
        "infrastructure.handlers.streetlights_list_commands._use_case"
    ) as mock:
        use_case = MagicMock()
        mock.return_value = use_case
        yield use_case


def test_list_commands_for_streetlight_returns_200(mock_use_case):
    from infrastructure.handlers.streetlights_list_commands import handler

    record = make_command_record()
    mock_use_case.for_streetlight.return_value = [record]

    response = handler(make_event(streetlight_id="LW-00001"), None)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert len(body["commands"]) == 1
    assert body["commands"][0]["streetlight_id"] == "LW-00001"
    assert body["commands"][0]["command_type"] == "REBOOT"
    mock_use_case.for_streetlight.assert_called_once_with(
        streetlight_id="LW-00001",
        limit=50,
    )


def test_list_commands_for_tenant_returns_200(mock_use_case):
    from infrastructure.handlers.streetlights_list_commands import handler

    record = make_command_record()
    mock_use_case.for_tenant.return_value = [record]

    response = handler(make_event(), None)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert len(body["commands"]) == 1
    mock_use_case.for_tenant.assert_called_once_with(
        tenant_id="tenant-001",
        limit=50,
    )


def test_list_commands_respects_limit(mock_use_case):
    from infrastructure.handlers.streetlights_list_commands import handler

    mock_use_case.for_streetlight.return_value = []

    handler(make_event(streetlight_id="LW-00001", limit=10), None)

    mock_use_case.for_streetlight.assert_called_once_with(
        streetlight_id="LW-00001",
        limit=10,
    )


def test_list_commands_returns_empty_list(mock_use_case):
    from infrastructure.handlers.streetlights_list_commands import handler

    mock_use_case.for_streetlight.return_value = []

    response = handler(make_event(streetlight_id="LW-00001"), None)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["commands"] == []


def test_list_commands_returns_401_on_auth_error(mock_use_case):
    from infrastructure.handlers.streetlights_list_commands import handler
    from domain.errors import AuthError

    mock_use_case.for_streetlight.side_effect = AuthError("unauthorized")

    response = handler(make_event(streetlight_id="LW-00001"), None)

    assert response["statusCode"] == 401


def test_list_commands_returns_400_on_invalid_limit():
    from infrastructure.handlers.streetlights_list_commands import handler

    event = make_event(streetlight_id="LW-00001")
    event["queryStringParameters"] = {"limit": "invalid"}

    response = handler(event, None)

    assert response["statusCode"] == 400


def test_list_commands_returns_500_on_persistence_error(mock_use_case):
    from infrastructure.handlers.streetlights_list_commands import handler

    mock_use_case.for_streetlight.side_effect = PersistenceError("db error")

    response = handler(make_event(streetlight_id="LW-00001"), None)

    assert response["statusCode"] == 500


def test_list_commands_returns_500_on_unexpected_error(mock_use_case):
    from infrastructure.handlers.streetlights_list_commands import handler

    mock_use_case.for_streetlight.side_effect = Exception("unexpected")

    response = handler(make_event(streetlight_id="LW-00001"), None)

    assert response["statusCode"] == 500
