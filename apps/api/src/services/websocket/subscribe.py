from domain.error import AuthError
from libs.logging import logger
from application.websocket.subscribe_service import WebSocketSubscribeService


_service = WebSocketSubscribeService()


def handler(event, context):
    connection_id = event["requestContext"]["connectionId"]

    try:
        connection = _service.subscribe(event)

    except AuthError as e:
        logger.warning(
            "WebSocket auth failed",
            extra={
                "connection_id": connection_id,
                "error": str(e)
            },
        )
        return {"statusCode": 401}

    except ValueError as e:
        return {"statusCode": 400, "body": str(e)}

    except Exception:
        logger.exception(
            "WebSocket subscribe failed",
            extra={"connection_id": connection_id},
        )
        return {"statusCode": 500}

    logger.info(
        "WebSocket subscribed",
        extra={
            "connection_id": connection.connection_id,
            "tenant_id": connection.tenant_id,
            "user_id": connection.user_id,
        },
    )

    return {"statusCode": 200, "body": "subscribed"}
