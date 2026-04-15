import boto3
import os

DYNAMO_ENDPOINT = os.getenv("DYNAMO_ENDPOINT", "http://localhost:8000")

client = boto3.client(
    "dynamodb",
    region_name="us-west-2",
    endpoint_url=DYNAMO_ENDPOINT,
    aws_access_key_id="local",
    aws_secret_access_key="local",
)

TABLES = [
    {
        "TableName": "Streetlights",
        "AttributeDefinitions": [
            {"AttributeName": "tenant_id",      "AttributeType": "S"},
            {"AttributeName": "streetlight_id", "AttributeType": "S"},
        ],
        "KeySchema": [
            {"AttributeName": "tenant_id",      "KeyType": "HASH"},
            {"AttributeName": "streetlight_id", "KeyType": "RANGE"},
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "StreetlightIndex",
                "KeySchema": [
                    {"AttributeName": "streetlight_id", "KeyType": "HASH"},
                ],
                "Projection": {
                    "ProjectionType": "INCLUDE",
                    "NonKeyAttributes": ["tenant_id"],
                },
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": 1,
                    "WriteCapacityUnits": 1
                },
            }
        ],
        "BillingMode": "PAY_PER_REQUEST",
    },
    {
        "TableName": "StreetlightMetadata",
        "AttributeDefinitions": [
            {"AttributeName": "tenant_id", "AttributeType": "S"},
            {"AttributeName": "streetlight_id", "AttributeType": "S"},
            {"AttributeName": "wireless_device_id", "AttributeType": "S"},
        ],
        "KeySchema": [
            {"AttributeName": "tenant_id", "KeyType": "HASH"},
            {"AttributeName": "streetlight_id", "KeyType": "RANGE"},
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "WirelessDeviceIndex",
                "KeySchema": [
                    {
                        "AttributeName": "wireless_device_id",
                        "KeyType": "HASH",
                    },
                ],
                "Projection": {
                    "ProjectionType": "INCLUDE",
                    "NonKeyAttributes": [
                        "streetlight_id",
                        "tenant_id",
                        "site_id",
                    ],
                },
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": 1,
                    "WriteCapacityUnits": 1,
                },
            }
        ],
        "BillingMode": "PAY_PER_REQUEST",
    },
    {
        "TableName": "UsersAndTenants",
        "AttributeDefinitions": [
            {"AttributeName": "tenant_id", "AttributeType": "S"},
            {"AttributeName": "user_id",   "AttributeType": "S"},
        ],
        "KeySchema": [
            {"AttributeName": "tenant_id", "KeyType": "HASH"},
            {"AttributeName": "user_id",   "KeyType": "RANGE"},
        ],
        "BillingMode": "PAY_PER_REQUEST",
    },
    {
        "TableName": "WebSocketConnections",
        "AttributeDefinitions": [
            {"AttributeName": "connection_id",  "AttributeType": "S"},
            {"AttributeName": "streetlight_id", "AttributeType": "S"},
            {"AttributeName": "tenant_id",      "AttributeType": "S"},
        ],
        "KeySchema": [
            {"AttributeName": "connection_id", "KeyType": "HASH"},
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "StreetlightIndex",
                "KeySchema": [
                    {"AttributeName": "streetlight_id", "KeyType": "HASH"},
                    {"AttributeName": "tenant_id",      "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": 1,
                    "WriteCapacityUnits": 1
                },
            }
        ],
        "BillingMode": "PAY_PER_REQUEST",
    },
]


def delete_table(name):
    try:
        client.delete_table(TableName=name)
        waiter = client.get_waiter("table_not_exists")
        waiter.wait(TableName=name)
    except client.exceptions.ResourceNotFoundException:
        pass  # already gone


def create_table(definition):
    client.create_table(**definition)
    waiter = client.get_waiter("table_exists")
    waiter.wait(TableName=definition["TableName"])


def main():
    for table in TABLES:
        name = table["TableName"]
        delete_table(name)
        create_table(table)
        print(f"Created: {name}")


if __name__ == "__main__":
    main()
