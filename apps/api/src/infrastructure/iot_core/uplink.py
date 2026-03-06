from functools import lru_cache
from dataclasses import dataclass
import base64
from binascii import Error as Base64Error

import boto3

from domain.iot.models import IoTUplink
from .error import InvalidUplinkEvent
from libs.config import settings


_dynamodb = boto3.resource("dynamodb")
_table = _dynamodb.Table(settings.DDB_TABLE_STREETLIGHT_METADATA)


@dataclass(frozen=True)
class _DeviceMetadata:
    streetlight_id: str
    tenant_id: str
    site_id: str


@lru_cache(maxsize=512)
def _get_device_metadata(wireless_device_id: str) -> _DeviceMetadata:
    try:
        response = _table.query(
            IndexName="WirelessDeviceIndex",
            KeyConditionExpression="wireless_device_id = :wid",
            ExpressionAttributeValues={":wid": wireless_device_id},
            Limit=1,
        )
        items = response.get("Items", [])
        if not items:
            raise InvalidUplinkEvent(
                f"No device found for WirelessDeviceId: {wireless_device_id}"
            )
        item = items[0]
        return _DeviceMetadata(
            streetlight_id=item["streetlight_id"],
            tenant_id=item["tenant_id"],
            site_id=item["site_id"],
        )
    except (KeyError, TypeError) as e:
        raise InvalidUplinkEvent(
            f"Metadata incomplete for WirelessDeviceId: {wireless_device_id}"
        ) from e


def extract_uplink(event: dict) -> IoTUplink:
    try:
        wireless_device_id = event["WirelessDeviceId"]
        payload_b64 = event["PayloadData"]
    except KeyError as e:
        raise InvalidUplinkEvent(f"Missing field in IoT event: {e}")

    if not isinstance(payload_b64, str) or not wireless_device_id:
        raise InvalidUplinkEvent("Invalid dev_eui or data type/empty")

    device = _get_device_metadata(wireless_device_id)

    try:
        payload_bytes = base64.b64decode(payload_b64)
    except Base64Error as e:
        raise InvalidUplinkEvent(
            f"Payload base64 decode failed: {e}"
        ) from e

    return IoTUplink(
        streetlight_id=device.streetlight_id,
        tenant_id=device.tenant_id,
        site_id=device.site_id,
        payload_bytes=payload_bytes,
    )
