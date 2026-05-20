import logging
import sys
import json

from libs.config import settings


class JsonFormatter(logging.Formatter):
    RESERVED_ATTRS = {
        "args", "created", "exc_info", "exc_text", "filename",
        "funcName", "levelname", "levelno", "lineno", "message",
        "module", "msecs", "msg", "name", "pathname", "process",
        "processName", "relativeCreated", "stack_info", "thread",
        "threadName",
    }

    def format(self, record):
        log_record = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S.%fZ"),
            "level": record.levelname,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)

        for key, value in record.__dict__.items():
            if key not in self.RESERVED_ATTRS and not key.startswith("_"):
                log_record[key] = value

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
    request_id=None,
    error=None
):
    extra = {k: v for k, v in {
        "tenant_id": tenant_id,
        "streetlight_id": streetlight_id,
        "user_id": user_id,
        "request_id": request_id,
        "error": error
    }.items() if v is not None}
    return logging.LoggerAdapter(logger, extra)
