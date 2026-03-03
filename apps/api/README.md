# Overview

This directory contains the serverless backend for managing streetlight nodes.

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
sam local start-api --env-vars env.local.sam.json --warm-containers EAGER
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
