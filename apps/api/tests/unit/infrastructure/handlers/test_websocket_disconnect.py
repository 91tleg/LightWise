from unittest.mock import patch

from infrastructure.handlers.websocket_disconnect import handler


def _event(connection_id: str = "conn-abc") -> dict:
    return {"requestContext": {"connectionId": connection_id}}


class TestDisconnectHandler:
    def _call(self, event: dict, side_effect=None):
        with patch(
            "infrastructure.handlers.websocket_disconnect._use_case"
        ) as mock_uc:
            if side_effect:
                mock_uc.return_value.execute.side_effect = side_effect
            return handler(event, None), mock_uc

    def test_returns_200_on_success(self):
        response, _ = self._call(_event())
        assert response["statusCode"] == 200

    def test_returns_200_on_cleanup_failure(self):
        response, _ = self._call(
            _event(), side_effect=RuntimeError("db error")
        )
        assert response["statusCode"] == 200

    def test_passes_connection_id_to_use_case(self):
        _, mock_uc = self._call(_event("conn-xyz"))
        mock_uc.return_value.execute.assert_called_once_with("conn-xyz")

    def test_always_returns_200_regardless_of_error(self):
        for exc in [
            RuntimeError("boom"), ValueError("bad"), Exception("unknown")
        ]:
            response, _ = self._call(_event(), side_effect=exc)
            assert response["statusCode"] == 200
