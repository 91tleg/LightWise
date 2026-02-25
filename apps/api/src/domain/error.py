from libs.errors import LightWiseError


class AuthError(LightWiseError):
    """Token is missing, invalid, or expired."""


class ValidationError(LightWiseError):
    """Invalid input or state."""


class UnauthorizedError(LightWiseError):
    """User is not authorized."""


class NotFoundError(LightWiseError):
    """Domain entity not found."""


class ConflictError(LightWiseError):
    """Business rule conflict."""
