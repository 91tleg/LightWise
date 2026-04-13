def extract_websocket_token(event: dict) -> str | None:
    protocol_header = (
        event.get("headers") or {}
    ).get("Sec-WebSocket-Protocol", "")
    parts = [p.strip() for p in protocol_header.split(",")]
    if len(parts) == 2 and parts[0] == "Bearer" and parts[1]:
        return parts[1]
    return None
