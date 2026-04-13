# Overview

This directory contains the serverless backend for managing streetlight nodes.

# Architecture

The backend uses a DDD-Lite structure: a pragmatic version of Domain-Driven Design
that keeps business logic clean without excessive abstractions.
The goal is clarity, speed, and testability.

---

## Core Principles

- **Domain is pure** — no AWS, no databases, no networking
- **Application orchestrates** — coordinates use cases via Protocols
- **Infrastructure integrates** — AWS, IoT, WebSockets, persistence
- **Dependencies point inward** — infrastructure imports domain, never the reverse

---

## Domain Layer (`domain/`)

The domain has no dependencies outside the standard library.

**Contains:**
- Entities and value objects  
- Domain events  
- Business rules — health evaluation, coordinate validation, interval coercion, timezone enforcement, etc...  
- Shared errors

**Must not contain:**
- AWS SDK or boto3
- DynamoDB, InfluxDB, or any persistence concern
- WebSocket or HTTP concepts
- JSON parsing or Lambda event shapes
- Infrastructure-specific error types

**Patterns used:**
- Frozen dataclasses for all entities and value objects — immutability is enforced,
  validation lives in `__post_init__`
- Domain errors defined here so application and infrastructure layers can raise and catch them without inverting dependencies

---

## Application Layer (`application/`)

Each use case is a class with a single `execute` method.
Use cases depend on Protocols, not concrete implementations.

**Contains:**
- Use case classes — one per system verb
- Protocols — structural interfaces defining what repos and services the use case needs
- Response DTOs — serialisers used at the handler boundary

**Must not contain:**
- AWS SDK or service-specific imports
- Raw Lambda event parsing
- DynamoDB key schemas or query logic
- Direct repo instantiation — repos are injected via `__init__`

**Patterns used:**
- Protocol-based dependency injection — use cases declare what they need via
  `typing.Protocol`; concrete implementations are wired at the handler level
- `dataclasses.replace()` for partial updates — fetch the domain object, apply
  updates via `replace()`, save the result; no partial update expressions leak
  into the use case
- Use cases raise domain errors — handlers map these
  to HTTP status codes at the boundary

---

## Infrastructure Layer (`infrastructure/`)

Infrastructure adapts the outside world to the domain.
It is the only layer that knows about AWS, DynamoDB, InfluxDB, or WebSockets.

**Contains:**
- Lambda handlers — parse events, resolve identity, call use cases, return responses
- DynamoDB repos — implement the Protocols declared in use cases
- Cognito auth — `IdentityResolver` for REST (reads injected claims),
  `CognitoVerifier` for WebSocket `$connect` (manual JWT verification)
- LoRaWAN decoder — translates binary frames to domain events
- IoT Core extractor — translates IoT Core JSON to `IoTUplink`
- WebSocket publisher — broadcasts telemetry to connected clients

**Must not contain:**
- Business rules
- Domain validation
- Direct domain model construction outside of `_from_item` repo methods

**Patterns used:**
- `lru_cache(maxsize=1)` on repo factory functions — one instance per Lambda
  container lifetime; avoids re-initializing connections on every invocation
- `_from_item` static method on every repo — single construction path from a
  DynamoDB item dict to a domain object; never duplicated across `get` and `list`

---

## Identity and Auth

Two separate auth paths exist.

| Path | Mechanism | Where |
|---|---|---|
| REST handlers | API Gateway Cognito authorizer injects claims | `IdentityResolver` reads `requestContext.authorizer.claims` |
| WebSocket `$connect` | Manual JWT verification | `CognitoVerifier` verifies token from query string |
| WebSocket post-connect | `connection_id` → tenant from DynamoDB | `WebSocketConnections` table, written at `$connect` |

`IdentityResolver` is called at the top of every REST handler.
It returns `(tenant_id, sub)` — the minimum identity needed to scope any operation.
It raises `AuthError` on missing claims; handlers map this to 401.

`CognitoClaimsMapper.to_operator_profile` is used only by `GET /auth/me`.
It maps the full Cognito claims dict to an `OperatorProfile`.
It is not used by any other handler.

---

## Adding a New Endpoint

1. **Domain** — add any new models, value objects, or rules needed
2. **Application** — add a use case class with `execute`, declare Protocols for
   any new repos or services needed
3. **Infrastructure** — implement the Protocols in the repo classes, add
   `get_by_*` methods if new access patterns are needed, add GSIs to the
   SAM template if required
4. **Handler** — resolve identity via `IdentityResolver`, parse path/query/body
   params, construct domain objects, call the use case, map exceptions to HTTP

New handlers always follow this structure:
```python
def handler(event: dict, context: object) -> dict:
    try:
        tenant_id, _ = IdentityResolver()(event)
    except AuthError:
        return error(401, "Unauthorized")

    # parse inputs
    # call use case
    # map exceptions to HTTP
    # return success(...)
```


## Running Locally (SAM + Docker)
### 1. Prerequisites

- Docker Desktop: Ensure it is running. (Windows Users: Ensure WSL2 is enabled in Docker settings.)

- AWS SAM CLI: [Install guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)

- Python 3.11: The project runtime.

### 2. Start DynamoDB Local

We use Docker Compose to run DynamoDB. Running the command below automatically creates tables and seed test data.

```Bash
# Assuming you are in apps/api
cd docker/dynamodb
docker-compose up
```
### 3. Build & Start API

Before running, you must build the functions to sync your latest code changes.

```Bash
# Build project
sam build

# Start local API
sam local start-api \
  --template template.yml \
  --warm-containers EAGER \
  --docker-network dynamodb_default
```

### Troubleshooting Connection Issues

If your API returns a 502 or Timeout error when calling DynamoDB, it is usually a networking mismatch between SAM and the Docker container.

For Windows Users (WSL2 / Compose)

If the Lambda cannot reach DynamoDB, you must tell SAM to join the Docker Compose network:

Find your network name:

```Bash
docker network ls
```
(Usually it is api_default or lightwise_default)

Run SAM with the network flag:

```Bash
sam local start-api --env-vars env.local.sam.json --docker-network <NETWORK_NAME>
```

### Connection Configuration

We use env.local.sam.json to manage local endpoints.

Mac/Windows: We use http://host.docker.internal:8000 to allow the container to talk back to the host machine.

Linux: You may need to use the specific gateway IP http://172.17.0.1:8000.

### Common Commands

| Action |Command |
|------------|------------|
| Full Reset | `docker-compose down && docker-compose up -d` |
|Re-build Code | `sam build` |
