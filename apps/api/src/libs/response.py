import json
import os


_ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "http://localhost:3001")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": _ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type,Cookie",
    "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,PATCH,OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
}


def success(body):
    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps(body)
    }


def error(status_code, message):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps({"error": message})
    }
