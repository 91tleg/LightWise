from domain.auth.claims import profile_from_claims
from domain.error import AuthError
from libs.logging import logger
from libs.response import success, error


def handler(event, context):
    """
    Returns the verified operator profile for the calling user.
    API Gateway Cognito authorizer must be attached — claims are
    injected into requestContext before this handler runs.
    No token verification is performed here.
    """
    try:
        claims = (
            event
            .get("requestContext", {})
            .get("authorizer", {})
            .get("claims")
        )
        if not claims or not isinstance(claims, dict):
            logger.error("Access denied: No claims found in authorizer")
            return error(401, "Unauthorized: Missing authentication context")

        profile = profile_from_claims(claims)
        logger.info("operator_profile_retrieved")
        return success(profile.to_dict())

    except AuthError as e:
        logger.warning("AuthError: %s", str(e))
        return error(401, str(e))

    except Exception as e:
        logger.exception("Unexpected error: %s", str(e))
        return error(500, "Internal server error")
