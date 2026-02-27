import boto3


dynamo = boto3.resource(
    "dynamodb",
    region_name="us-west-2",
    endpoint_url="http://localhost:8000",
    aws_access_key_id="local",
    aws_secret_access_key="local",
)

dynamo.Table("Streetlights").put_item(Item={
    "tenant_id": "tenant-001",
    "streetlight_id": "LW-00042",
    "health_status": "OK",
    "firmware_version": "1.0",
    "provisioned_at": "2026-02-01T18:22:00Z",
})

dynamo.Table("UsersAndTenants").put_item(Item={
    "tenant_id": "tenant-001",
    "user_id": "TENANT",
    "name": "Test Tenant",
    "created_at": "2026-01-01T00:00:00Z",
})

print("Seed data inserted")
