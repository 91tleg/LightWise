# LightWise API Documentation
**Version:** 1.0  
**Last Updated:** March 13, 2026  

---

## Documents

| Document | Description |
|---|---|
| [auth.md](./auth.md) | Cognito auth flow, `GET /auth/me`, token storage, authorizer setup |
| [http.md](./http.md) | Streetlight REST endpoints |
| [websocket.md](./websocket.md) | WebSocket connect, subscribe, server push |
| [iotcore.md](./iotcore.md) | IoT Core uplink format |

---

## Authentication

All HTTP and WebSocket endpoints require a valid Cognito access token except where noted.

**HTTP:** Pass token as `Authorization: Bearer <access_token>` header.  
**WebSocket `$connect`:** Pass `tenant_id` as query parameter (demo only — will move to Cognito token before production).

See [auth.md](./auth.md) for the full auth flow.

---

## Shared Conventions

**Error format — all endpoints:**
```json
{ "error": "Description of the error" }
```

**Status codes:**
| Code | Meaning |
|---|---|
| `200` | Success |
| `204` | Success — no content |
| `400` | Bad request — missing or invalid parameters |
| `401` | Unauthorised — token missing, expired, or invalid |
| `404` | Resource not found |
| `500` | Internal server error |

**Timestamps:** ISO 8601 UTC — `2026-02-27T03:41:12+00:00`  
**Health values:** `OK`, `DEGRADED`, `CRITICAL`  
**Tenant isolation:** All endpoints are scoped to the tenant in the verified Cognito claims. `tenant_id` query parameter is demo only and will be removed before production.
