from .models import IoTUplink


class IoTCoreError(Exception):
    """Base class for IoT Core errors."""


class InvalidUplinkEvent(IoTCoreError):
    """Raised when an uplink event is missing required fields or malformed."""


def extract_uplink(event: dict) -> IoTUplink:
    try:
        dev_eui = event["DevEui"]
        payload_b64 = event["PayloadData"]
    except KeyError as e:
        raise InvalidUplinkEvent(f"Missing field in IoT event: {e}")

    if not isinstance(payload_b64, str) or not dev_eui:
        raise InvalidUplinkEvent("Invalid DevEui or PayloadData type/empty")

    return IoTUplink(dev_eui=dev_eui, payload_b64=payload_b64)
