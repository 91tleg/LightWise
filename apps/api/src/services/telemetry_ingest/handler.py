import base64
from binascii import Error as Base64Error
from infrastructure.iot_core.uplink import extract_uplink, InvalidUplinkEvent
from application.telemetry.process_telemetry import get_telemetry_processor
from libs.logging import logger


def handler(event, context):
    try:
        uplink = extract_uplink(event)
        raw_bytes = base64.b64decode(uplink.payload_b64)
    except (InvalidUplinkEvent, Base64Error) as e:
        logger.error(f"Ingestion error: {e}")
        return

    processor = get_telemetry_processor()

    try:
        processor.execute_raw(uplink.dev_eui, raw_bytes)
    except Exception as e:
        logger.error(f"Process failed: {e}")
