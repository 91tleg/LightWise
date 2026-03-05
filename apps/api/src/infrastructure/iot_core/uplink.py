from functools import lru_cache
import base64
from binascii import Error as Base64Error

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from domain.iot.models import IoTUplink
from .error import InvalidUplinkEvent


_iotwireless = boto3.client("iotwireless")


@lru_cache(maxsize=512)
def _get_dev_eui(wireless_device_id: str) -> str:
    try:
        response = _iotwireless.get_wireless_device(
            Identifier=wireless_device_id,
            IdentifierType="WirelessDeviceId",
        )
        return response["LoRaWAN"]["DevEui"]
    except KeyError:
        raise InvalidUplinkEvent(
            f"DevEUI not found for WirelessDeviceId: {wireless_device_id}"
        )
    except (BotoCoreError, ClientError) as e:
        raise InvalidUplinkEvent(
            f"Failed to resolve WirelessDeviceId '{wireless_device_id}': {e}"
        ) from e


def extract_uplink(event: dict) -> IoTUplink:
    try:
        wireless_device_id = event["WirelessDeviceId"]
        payload_b64 = event["PayloadData"]
    except KeyError as e:
        raise InvalidUplinkEvent(f"Missing field in IoT event: {e}")

    if not isinstance(payload_b64, str) or not wireless_device_id:
        raise InvalidUplinkEvent("Invalid dev_eui or data type/empty")

    dev_eui = _get_dev_eui(wireless_device_id)

    try:
        payload_bytes = base64.b64decode(payload_b64)
    except Base64Error as e:
        raise InvalidUplinkEvent(
            f"Payload base64 decode failed: {e}"
        ) from e

    return IoTUplink(dev_eui=dev_eui, payload_bytes=payload_bytes)
