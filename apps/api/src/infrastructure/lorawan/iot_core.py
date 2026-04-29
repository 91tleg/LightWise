import boto3


_iot_client = boto3.client("iotwireless")


def send_downlink(wireless_device_id: str, payload: bytes) -> None:
    _iot_client.send_data_to_wireless_device(
        Id=wireless_device_id,
        TransmitMode=1,
        PayloadData=payload.hex(),
    )
