from application.telemetry.process_telemetry import (
    get_telemetry_processor
)
from infrastructure.iot_core.uplink import extract_uplink
from infrastructure.iot_core.error import InvalidUplinkEvent
from libs.logging import logger


_processor = get_telemetry_processor()


def handler(event, context):
    try:
        uplink = extract_uplink(event)
    except InvalidUplinkEvent as e:
        logger.error(
            f"Invalid uplink event: {e}", extra={"event": event}
        )
        return

    try:
        _processor.execute_raw(uplink.dev_eui, uplink.payload_bytes)
        logger.info(
            f"Telemetry processed for dev_eui={uplink.dev_eui}"
        )
    except Exception:
        logger.exception(
            f"Unhandled error processing dev_eui={uplink.dev_eui}"
        )
        raise  # Re-raise so IoT Core can retry
