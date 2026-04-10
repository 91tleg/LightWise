import logging
import sys
import json

from libs.config import settings


class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S.%fZ"),
            "level": record.levelname,
            "message": record.getMessage(),
        }
        for key in ("tenant_id", "streetlight_id", "user_id", "request_id"):
            if hasattr(record, key):
                log_record[key] = getattr(record, key)
        return json.dumps(log_record)


handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
logger = logging.getLogger("streetlight")
log_level_name = getattr(settings, "LOG_LEVEL", "INFO").upper()
logger.setLevel(getattr(logging, log_level_name, logging.INFO))
logger.addHandler(handler)
logger.propagate = False


def bind_context(
    tenant_id=None,
    streetlight_id=None,
    user_id=None,
    request_id=None
):
    extra = {k: v for k, v in {
        "tenant_id": tenant_id,
        "streetlight_id": streetlight_id,
        "user_id": user_id,
        "request_id": request_id
    }.items() if v is not None}
    return logging.LoggerAdapter(logger, extra)
