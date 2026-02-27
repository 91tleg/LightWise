import boto3


dynamo = boto3.resource(
    "dynamodb",
    region_name="us-west-2",
    endpoint_url="http://localhost:8000",
)

dynamo.create_table(
    TableName="Streetlights",
    BillingMode="PAY_PER_REQUEST",
    AttributeDefinitions=[
        {"AttributeName": "tenant_id", "AttributeType": "S"},
        {"AttributeName": "streetlight_id", "AttributeType": "S"},
    ],
    KeySchema=[
        {"AttributeName": "tenant_id", "KeyType": "HASH"},
        {"AttributeName": "streetlight_id", "KeyType": "RANGE"},
    ],
    GlobalSecondaryIndexes=[
        {
            "IndexName": "StreetlightIndex",
            "KeySchema": [
                {"AttributeName": "streetlight_id", "KeyType": "HASH"},
            ],
            "Projection": {
                "ProjectionType": "INCLUDE",
                "NonKeyAttributes": ["tenant_id"],
            },
        }
    ],
)

dynamo.create_table(
    TableName="StreetlightMetadata",
    BillingMode="PAY_PER_REQUEST",
    AttributeDefinitions=[
        {"AttributeName": "streetlight_id", "AttributeType": "S"},
        {"AttributeName": "SK", "AttributeType": "S"},
    ],
    KeySchema=[
        {"AttributeName": "streetlight_id", "KeyType": "HASH"},
        {"AttributeName": "SK", "KeyType": "RANGE"},
    ],
)

dynamo.create_table(
    TableName="UsersAndTenants",
    BillingMode="PAY_PER_REQUEST",
    AttributeDefinitions=[
        {"AttributeName": "tenant_id", "AttributeType": "S"},
        {"AttributeName": "user_id", "AttributeType": "S"},
    ],
    KeySchema=[
        {"AttributeName": "tenant_id", "KeyType": "HASH"},
        {"AttributeName": "user_id", "KeyType": "RANGE"},
    ],
)

dynamo.create_table(
    TableName="WebSocketConnections",
    BillingMode="PAY_PER_REQUEST",
    AttributeDefinitions=[
        {"AttributeName": "connection_id", "AttributeType": "S"},
        {"AttributeName": "streetlight_id", "AttributeType": "S"},
        {"AttributeName": "tenant_id", "AttributeType": "S"},
    ],
    KeySchema=[
        {"AttributeName": "connection_id", "KeyType": "HASH"},
    ],
    GlobalSecondaryIndexes=[
        {
            "IndexName": "StreetlightIndex",
            "KeySchema": [
                {"AttributeName": "streetlight_id", "KeyType": "HASH"},
                {"AttributeName": "tenant_id", "KeyType": "RANGE"},
            ],
            "Projection": {"ProjectionType": "ALL"},
        }
    ],
)

print("Tables created")
