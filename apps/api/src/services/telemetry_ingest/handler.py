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
        _processor.execute_raw(uplink, uplink.payload_bytes)
        logger.info(
            f"Telemetry processed for streetlight_id={uplink.streetlight_id}"
        )
    except Exception:
        logger.exception(
            f"Error processing streetlight_id={uplink.streetlight_id}"
        )
        raise
