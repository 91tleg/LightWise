import boto3
import base64
from functools import lru_cache


@lru_cache(maxsize=1)
def _iot_client():
    return boto3.client("iotwireless")


def send_downlink(wireless_device_id: str, payload: bytes) -> None:
    _iot_client().send_data_to_wireless_device(
        Id=wireless_device_id,
        TransmitMode=1,
        PayloadData=base64.b64encode(payload).decode(),
    )


class IoTCoreDownlinkSender:
    def send(self, wireless_device_id: str, payload: bytes) -> None:
        send_downlink(wireless_device_id, payload)


@lru_cache(maxsize=1)
def get_downlink_sender() -> IoTCoreDownlinkSender:
    return IoTCoreDownlinkSender()
