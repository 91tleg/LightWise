# Auth API
**Version:** 1.0  
**Last Updated:** March 13, 2026  

Authentication is handled by AWS Cognito. The backend does not issue tokens or manage sessions. All endpoints except `GET /auth/me` interact with Cognito directly from the frontend.

See [README.md](./README.md) for shared conventions.

---

## Flow

```
1. Frontend redirects to Cognito hosted UI
2. User authenticates — Cognito redirects back with ?code=
3. Frontend exchanges code for tokens via Cognito /oauth2/token
4. Frontend calls GET /auth/me with access_token to get profile and role
5. Frontend stores { name, email, role, tenant_id } in sessionStorage
6. All subsequent API calls send access_token as Authorization: Bearer <token>
7. API Gateway Cognito authorizer verifies token before any Lambda runs
```

---

## Cognito Endpoints

Called directly from the frontend — not proxied through the backend.

### Login redirect

```
GET https://{cognito_domain}/login
  ?client_id={client_id}
  &redirect_uri={redirect_uri}
  &response_type=code
  &scope=email+openid+phone
```

### Token exchange

```
POST https://{cognito_domain}/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id={client_id}
&redirect_uri={redirect_uri}
&code={code}
```

**Response**
```json
{
  "access_token": "...",
  "id_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Logout

```
GET https://{cognito_domain}/logout
  ?client_id={client_id}
  &logout_uri={redirect_uri}
```

---

## Backend Endpoints

### `GET /auth/me`

Returns the verified operator profile for the calling user. Claims are verified by the API Gateway Cognito authorizer before this endpoint runs — no token verification is performed in the Lambda.

**Headers**
| Header | Required | Description |
|---|---|---|
| `Authorization` | yes | `Bearer <access_token>` |

**Response `200`**
```json
{
  "sub":        "abc-123-def-456",
  "tenant_id":  "tenant-001",
  "first_name": "Jane",
  "last_name":  "Doe",
  "name":       "Jane Doe",
  "email":      "jane.doe@lightwise.io",
  "role":       "admin"
}
```

**Role values:** `admin`, `operator`

**Response `401`**
```json
{ "error": "Unauthorized" }
```

Returned when:
- `Authorization` header is missing
- Token is expired or invalid — rejected by API Gateway before Lambda runs
- Required Cognito claims are missing (`sub`, `custom:tenant_id`, `email`, `given_name` or `family_name`)

**Response `500`**
```json
{ "error": "Internal server error" }
```

---

## API Gateway Authorizer

A Cognito authorizer is attached to all routes except `OPTIONS` (CORS preflight).

- **Type:** Cognito User Pool authorizer
- **Token source:** `Authorization` header
- **Effect:** Invalid or missing tokens are rejected at the gateway — Lambda never runs
- **Claims injection:** Verified claims are injected into `event["requestContext"]["authorizer"]["claims"]`
- **`OPTIONS` routes:** Authorizer is disabled — preflight requests have no `Authorization` header

---

## Token Storage

| Data | Storage | Reason |
|---|---|---|
| `access_token` | Memory only (module variable) | XSS protection — not readable by injected scripts |
| `{ name, email, role, tenant_id }` | `sessionStorage` | UI display only — cleared on tab close |
| Raw `id_token` | Not stored | Not needed — profile comes from `/auth/me` |

---

## Cognito User Pool Configuration

| Attribute | Value |
|---|---|
| Required attributes | `email`, `given_name`, `family_name` |
| Custom attributes | `custom:tenant_id` |
| Groups | `admin`, `operators` |
| Hosted UI | Enabled |
| Token expiry | Access: 1h, Refresh: 30d |
