import base64
from binascii import Error as Base64Error

from application.telemetry.process_telemetry import get_telemetry_processor
from infrastructure.iot_core.uplink import extract_uplink, InvalidUplinkEvent
from libs.logging import logger


_processor = get_telemetry_processor()


def handler(event, context):
    try:
        uplink = extract_uplink(event)
        raw_bytes = base64.b64decode(uplink.payload_b64)
    except InvalidUplinkEvent as e:
        logger.error(f"Invalid uplink event: {e}", extra={"event": event})
        return  # Bad IoT Core message shape — nothing we can do
    except Base64Error as e:
        logger.error(
            f"Payload decode failed for dev_eui={uplink.dev_eui}: {e}"
        )
        return  # Malformed payload — discard

    try:
        _processor.execute_raw(uplink.dev_eui, raw_bytes)
        logger.info(
            f"Telemetry processed for dev_eui={uplink.dev_eui}"
        )
    except Exception:
        logger.exception(
            f"Unhandled error processing dev_eui={uplink.dev_eui}"
        )
        raise  # Re-raise so IoT Core can retry
