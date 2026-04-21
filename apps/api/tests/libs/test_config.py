from libs.config import Config


def test_cognito_client_id_reads_deployed_env_name(monkeypatch):
    monkeypatch.setenv("COGNITO_CLIENT_ID", "client-from-template")
    monkeypatch.delenv("COGNITO_APP_CLIENT_ID", raising=False)

    config = Config()

    assert config.COGNITO_CLIENT_ID == "client-from-template"
    assert config.COGNITO_APP_CLIENT_ID == "client-from-template"


def test_cognito_client_id_falls_back_to_legacy_env_name(monkeypatch):
    monkeypatch.delenv("COGNITO_CLIENT_ID", raising=False)
    monkeypatch.setenv("COGNITO_APP_CLIENT_ID", "legacy-client")

    config = Config()

    assert config.COGNITO_CLIENT_ID == "legacy-client"
    assert config.COGNITO_APP_CLIENT_ID == "legacy-client"
