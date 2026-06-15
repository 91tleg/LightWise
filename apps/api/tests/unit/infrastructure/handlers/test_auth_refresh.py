from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import patch

from infrastructure.handlers import auth_refresh


def test_refresh_uses_cognito_token_url_without_duplicate_scheme():
    config = SimpleNamespace(
        client_id="client-1",
        token_url="https://auth.example.com/oauth2/token",
    )

    with patch.object(auth_refresh, "_config", config), patch(
        "urllib.request.urlopen"
    ) as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.read.return_value = (
            json.dumps({"access_token": "access-1"}).encode()
        )

        tokens = auth_refresh._refresh("refresh-1")

    request = mock_urlopen.call_args.args[0]
    assert request.full_url == "https://auth.example.com/oauth2/token"
    assert tokens == {"access_token": "access-1"}
