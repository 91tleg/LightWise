from libs.logging import logger
from application.websocket.disconnect_service import WebSocketDisconnectService


_service = WebSocketDisconnectService()


def handler(event, context):
    connection_id = event["requestContext"]["connectionId"]

    try:
        _service.disconnect(connection_id)

    except Exception:
        logger.exception(
            "WebSocket disconnect cleanup failed",
            extra={"connection_id": connection_id},
        )

    # Always return 200 for API Gateway
    return {"statusCode": 200}
