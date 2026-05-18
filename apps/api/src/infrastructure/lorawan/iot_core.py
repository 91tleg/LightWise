"""
IoT Core for LoRaWAN downlink dispatch.
Wraps send_data_to_wireless_device for sending downlink commands
to a specific wireless device via the LoRaWAN network server.
"""

from __future__ import annotations
import base64
from functools import lru_cache

import boto3
from botocore.exceptions import ClientError


class DispatchError(Exception):
    """Raised when a downlink command cannot be delivered via IoT Core."""


@lru_cache(maxsize=1)
def _iot_client():
    return boto3.client("iotwireless")


def send_downlink(wireless_device_id: str, payload: bytes) -> None:
    try:
        _iot_client().send_data_to_wireless_device(
            Id=wireless_device_id,
            TransmitMode=0,
            PayloadData=base64.b64encode(payload).decode(),
            WirelessMetadata={
                "LoRaWAN": {
                    "FPort": 1,
                }
            },
        )
    except ClientError as e:
        raise DispatchError(
            f"IoT Core downlink failed for device {wireless_device_id}"
        ) from e


class IoTCoreDownlinkSender:
    def send(self, wireless_device_id: str, payload: bytes) -> None:
        send_downlink(wireless_device_id, payload)


@lru_cache(maxsize=1)
def get_downlink_sender() -> IoTCoreDownlinkSender:
    return IoTCoreDownlinkSender()
