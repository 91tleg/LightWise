"""
Uplink decoder errors.
"""


class UplinkError(Exception):
    """Base class for all ingestion and decoding errors."""


class InvalidUplinkEvent(UplinkError):
    """
    Infrastructure Error: The AWS IoT Core JSON is broken.
    Raised when fields are missing or the device ID isn't in DynamoDB.
    """


class DecodeError(UplinkError, ValueError):
    """
    Protocol Error: The LoRaWAN binary payload is broken.
    Raised when the bytes don't match the firmware spec (v1).
    """
