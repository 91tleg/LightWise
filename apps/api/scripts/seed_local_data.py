import boto3
import os

DYNAMO_ENDPOINT = os.getenv("DYNAMO_ENDPOINT", "http://localhost:8000")

dynamo = boto3.resource(
    "dynamodb",
    region_name="us-west-2",
    endpoint_url=DYNAMO_ENDPOINT,
    aws_access_key_id="local",
    aws_secret_access_key="local",
)

STREETLIGHTS = [
    {
        "tenant_id":            "tenant-001",
        "streetlight_id":       "LW-00042",
        "health":               "OK",
        "lat":                  "47.6101",
        "lng":                  "-122.2015",
        "name":                 "Main St 5th Ave",
        "last_seen":            "2026-02-27T03:41:12+00:00",
        "motion_detected":      True,
        "ambient_primary_ok":   True,
        "ambient_secondary_ok": True,
        "th_ok":                True,
        "motion_primary_ok":    True,
        "motion_secondary_ok":  True,
        "firmware_version":     "1.0",
        "provisioned_at":       "2026-02-01T18:22:00Z",
    },
    {
        "tenant_id":            "tenant-001",
        "streetlight_id":       "LW-00043",
        "health":               "DEGRADED",
        "lat":                  "47.6099",
        "lng":                  "-122.2022",
        "name":                 "Parking Lot Pole",
        "last_seen":            "2026-02-27T03:41:12+00:00",
        "motion_detected":      True,
        "ambient_primary_ok":   True,
        "ambient_secondary_ok": False,
        "th_ok":                True,
        "motion_primary_ok":    True,
        "motion_secondary_ok":  False,
        "firmware_version":     "1.0",
        "provisioned_at":       "2026-02-01T18:22:00Z",
    },
    {
        "tenant_id":            "tenant-001",
        "streetlight_id":       "LW-00044",
        "health":               "OK",
        "lat":                  "47.6110",
        "lng":                  "-122.2010",
        "name":                 "North Entrance",
        "last_seen":            "2026-02-27T03:41:12+00:00",
        "motion_detected":      False,
        "ambient_primary_ok":   True,
        "ambient_secondary_ok": True,
        "th_ok":                True,
        "motion_primary_ok":    True,
        "motion_secondary_ok":  True,
        "firmware_version":     "1.0",
        "provisioned_at":       "2026-02-01T18:22:00Z",
    },
    {
        "tenant_id":            "tenant-001",
        "streetlight_id":       "LW-00045",
        "health":               "CRITICAL",
        "lat":                  "47.6090",
        "lng":                  "-122.2030",
        "name":                 "South Gate",
        "last_seen":            "2026-02-26T12:00:00+00:00",
        "motion_detected":      False,
        "ambient_primary_ok":   False,
        "ambient_secondary_ok": False,
        "th_ok":                False,
        "motion_primary_ok":    False,
        "motion_secondary_ok":  False,
        "firmware_version":     "1.0",
        "provisioned_at":       "2026-02-01T18:22:00Z",
    },
]

USERS = [
    {
        "tenant_id":  "tenant-001",
        "user_id":    "TENANT",
        "name":       "Test Tenant",
        "created_at": "2026-01-01T00:00:00Z",
    },
]


streetlights_table = dynamo.Table("Streetlights")
for item in STREETLIGHTS:
    streetlights_table.delete_item(Key={
        "tenant_id":      item["tenant_id"],
        "streetlight_id": item["streetlight_id"],
    })
    streetlights_table.put_item(Item=item)
    print(f"Seeded streetlight: {item['streetlight_id']}")

users_table = dynamo.Table("UsersAndTenants")
for item in USERS:
    users_table.delete_item(Key={
        "tenant_id": item["tenant_id"],
        "user_id":   item["user_id"],
    })
    users_table.put_item(Item=item)
    print(f"Seeded user: {item['user_id']}")
