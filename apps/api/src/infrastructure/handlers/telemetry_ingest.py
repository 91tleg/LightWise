"""
Telemetry ingest Lambda handler.

Trigger: IoT Core message rule.

Responsibilities:
  - Parse and validate the IoT Core event
  - Decode the raw LoRaWAN payload into a domain event
  - Delegate to the ProcessUplink use case
"""

from __future__ import annotations
from functools import lru_cache

from application.streetlight.process_uplink import ProcessUplink
from infrastructure.uplink.errors import (
    InvalidUplinkEvent, DecodeError, UplinkError
)
from infrastructure.uplink.extractor import UplinkExtractor
from infrastructure.uplink.decoder import decode_uplink
from infrastructure.persistence.dynamo.downlink_command_repo import (
    get_downlink_command_repo
)
from infrastructure.persistence.dynamo.streetlight_metadata_repo import (
    get_streetlight_metadata_repo,
)
from infrastructure.persistence.dynamo.streetlights_repo import (
    get_streetlights_repo
)
from infrastructure.persistence.dynamo.websocket_connection_repo import (
    get_websocket_connection_repo,
)
from infrastructure.persistence.telemetry.provider import get_writer
from infrastructure.websocket.publisher import get_websocket_publisher
from libs.logging import logger


@lru_cache(maxsize=1)
def _extractor() -> UplinkExtractor:
    return UplinkExtractor(
        metadata_repo=get_streetlight_metadata_repo()
    )


@lru_cache(maxsize=1)
def _use_case() -> ProcessUplink:
    return ProcessUplink(
        telemetry_writer=get_writer(),
        streetlight_repo=get_streetlights_repo(),
        ws_publisher=get_websocket_publisher(),
        ws_repo=get_websocket_connection_repo(),
        command_repo=get_downlink_command_repo(),
    )


def handler(event: dict, context: object) -> None:
    try:
        uplink = _extractor().extract(event)
        frame = decode_uplink(uplink)
        _use_case().execute(frame)

        logger.info(
            "Uplink processed",
            extra={
                "streetlight_id": uplink.streetlight_id,
                "frame_type": type(frame).__name__,
            },
        )

    except InvalidUplinkEvent as exc:
        logger.error(
            "Infrastructure failure", extra={"reason": str(exc)}
        )

    except DecodeError as exc:
        logger.warning(
            "Payload corruption", extra={"reason": str(exc)}
        )

    except UplinkError:
        logger.exception("General uplink failure")

    except Exception:
        logger.exception("Unexpected error processing uplink")
        raise
