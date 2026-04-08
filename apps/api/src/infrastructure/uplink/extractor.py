"""
IoT Core uplink extractor.

Translates a raw IoT Core rule event into an IoTUplink object.
"""

from __future__ import annotations
import base64
from binascii import Error as Base64Error
from datetime import datetime, timezone

from infrastructure.uplink.models import IoTUplink
from infrastructure.uplink.errors import InvalidUplinkEvent
from infrastructure.persistence.dynamo.streetlight_metadata_repo import (
    StreetlightMetadataRepo,
)


class UplinkExtractor:
    """
    Parses an IoT Core rule event and resolves device identity.
    """

    def __init__(self, metadata_repo: StreetlightMetadataRepo) -> None:
        self._metadata_repo = metadata_repo

    def extract(self, event: dict) -> IoTUplink:
        wireless_id, payload_b64, received_at, rssi, snr = self._parse_event(
            event
        )
        payload_bytes = self._decode_payload(payload_b64)
        device = self._resolve_device(wireless_id)

        return IoTUplink(
            streetlight_id=device.streetlight_id,
            tenant_id=device.tenant_id,
            site_id=device.site_id,
            payload_bytes=payload_bytes,
            received_at=received_at,
            rssi=rssi,
            snr=snr,
        )

    @staticmethod
    def _parse_event(
        event: dict,
    ) -> tuple[str, str, datetime, int | None, float | None]:
        try:
            wireless_device_id = event["WirelessDeviceId"]
            payload_b64 = event["PayloadData"]
        except KeyError as exc:
            raise InvalidUplinkEvent(
                f"Missing field in IoT event: {exc}"
            ) from exc

        if not isinstance(payload_b64, str) or not wireless_device_id:
            raise InvalidUplinkEvent(
                "WirelessDeviceId or PayloadData is empty or wrong type"
            )

        lorawan = (
            event.get("WirelessMetadata", {}).get("LoRaWAN", {})
        )

        received_at = _parse_timestamp(lorawan.get("Timestamp"))
        rssi = _parse_int(lorawan.get("Rssi"))
        snr = _parse_float(lorawan.get("Snr"))

        return wireless_device_id, payload_b64, received_at, rssi, snr

    @staticmethod
    def _decode_payload(payload_b64: str) -> bytes:
        try:
            return base64.b64decode(payload_b64)
        except Base64Error as exc:
            raise InvalidUplinkEvent(
                f"Payload base64 decode failed: {exc}"
            ) from exc

    def _resolve_device(self, wireless_device_id: str) -> object:
        device = self._metadata_repo.get_by_wireless_device_id(
            wireless_device_id
        )
        if device is None:
            raise InvalidUplinkEvent(
                f"No device found for WirelessDeviceId: {wireless_device_id}"
            )
        return device


def _parse_timestamp(value: str | None) -> datetime:
    """
    Parse the LoRaWAN timestamp from the IoT Core event.
    Falls back to utcnow() if absent or malformed.
    """
    if not value:
        return datetime.now(timezone.utc)
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return datetime.now(timezone.utc)


def _parse_int(value: object) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _parse_float(value: object) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None
