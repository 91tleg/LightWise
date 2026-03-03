# Architecture

The backend uses a DDD-Lite structure: a pragmatic version of Domain-Driven Design that keeps business logic clean without excessive abstractions.  
The goal is clarity, speed, and testability.  

### Core Principles
- Domain is pure: no AWS, no databases, no networking
- Application orchestrates: coordinates use cases
- Infrastructure integrates: AWS, IoT, WebSockets, persistence

```
src/
├── domain/           # Business concepts & rules
├── application/      # Use cases (orchestration)
└── infrastructure/   # AWS, DBs, WebSockets,decoders
```
### Domain Layer (`domain/`)
What it contains:  
- Entities (e.g. Telemetry)
- Value objects
- Business rules (health evaluation, validation)  

What it must NOT contain:  
- AWS SDK
- DynamoDB, Timestream
 -WebSockets
- JSON / Lambda event parsing

### Application Layer (`application/`)
What it does:  
- Implements use cases
- Coordinates domain + infrastructure
- Contains the system’s “verbs”  
What it must NOT do:
- Know AWS details
- Contain sensor decoding logic
- Store raw Lambda events

### Infrastructure Layer (`infrastructure/`)
What it does:  
- Talks to the outside world
- Adapts AWS/services to the application layer
- Infrastructure depends on the domain, never the other way around.  
