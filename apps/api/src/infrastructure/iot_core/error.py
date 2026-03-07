class IoTCoreError(Exception):
    """Base class for IoT Core errors."""


class InvalidUplinkEvent(IoTCoreError):
    """Raised when an uplink event is missing required fields or malformed."""
