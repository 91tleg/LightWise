import logging
import sys
import json

class JsonFormatter(logging.Formatter):
    """Formats logs as JSON"""
    def format(self, record):
        log_record = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S.%fZ"),
            "level": record.levelname,
            "message": record.getMessage(),
        }

        if hasattr(record, "extra") and isinstance(record.extra, dict):
            log_record.update(record.extra)
        return json.dumps(log_record)

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
logger = logging.getLogger("streetlight")
logger.setLevel(logging.INFO)
logger.addHandler(handler)
logger.propagate = False

# Helper to bind contextual info
def bind_context(tenant_id=None, streetlight_id=None, user_id=None, request_id=None):
    extra = {k: v for k, v in {
        "tenant_id": tenant_id,
        "streetlight_id": streetlight_id,
        "user_id": user_id,
        "request_id": request_id
    }.items() if v is not None}
    
    return logging.LoggerAdapter(logger, {"extra": extra})
