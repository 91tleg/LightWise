from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class WebSocketAuth:
    token: str
    selected_protocol: str


def _get_header(headers: dict, name: str) -> str:
    for key, value in headers.items():
        if str(key).lower() == name.lower():
            return str(value or "")
    return ""


def extract_websocket_auth(event: dict) -> WebSocketAuth | None:
    protocol_header = _get_header(
        event.get("headers") or {},
        "Sec-WebSocket-Protocol",
    )
    parts = [p.strip() for p in protocol_header.split(",") if p.strip()]

    if len(parts) == 2 and parts[0].lower() == "bearer":
        return WebSocketAuth(token=parts[1], selected_protocol=parts[0])

    if len(parts) == 1 and parts[0].lower() != "bearer":
        return WebSocketAuth(token=parts[0], selected_protocol=parts[0])

    return None


def extract_websocket_token(event: dict) -> str | None:
    auth = extract_websocket_auth(event)
    return auth.token if auth else None
