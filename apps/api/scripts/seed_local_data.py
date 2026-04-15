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
        "tenant_id": "tenant-001",
        "streetlight_id": "LW-00100",
        "health_status": 1,
        "last_seen": "2026-02-27T03:41:12+00:00",
        "motion_detected": True,
        "light_level": 80,
        "ambient_health": 4,
        "mmwave_health": 4,
        "th_ok": True,
        "light_ok": True,
        "overall_ok": True,
        "rssi": -92,
        "snr": 7,
    },
    {
        "tenant_id": "tenant-001",
        "streetlight_id": "LW-00043",
        "health_status": 2,
        "last_seen": "2026-02-27T03:41:12+00:00",
        "motion_detected": True,
        "light_level": 72,
        "ambient_health": 2,
        "mmwave_health": 4,
        "th_ok": True,
        "light_ok": True,
        "overall_ok": True,
        "rssi": -86,
        "snr": 6,
    },
    {
        "tenant_id": "tenant-001",
        "streetlight_id": "LW-00044",
        "health_status": 1,
        "last_seen": "2026-02-27T03:41:12+00:00",
        "motion_detected": False,
        "light_level": 65,
        "ambient_health": 4,
        "mmwave_health": 4,
        "th_ok": True,
        "light_ok": True,
        "overall_ok": True,
        "rssi": -81,
        "snr": 8,
    },
    {
        "tenant_id": "tenant-001",
        "streetlight_id": "LW-00045",
        "health_status": 3,
        "last_seen": "2026-02-26T12:00:00+00:00",
        "motion_detected": False,
        "light_level": 10,
        "ambient_health": 0,
        "mmwave_health": 1,
        "th_ok": False,
        "light_ok": False,
        "overall_ok": False,
        "rssi": -101,
        "snr": -3,
    },
]

STREETLIGHT_METADATA = [
    {
        "tenant_id": "tenant-001",
        "streetlight_id": "LW-00100",
        "wireless_device_id": "dev-lw-00100",
        "site_id": "CITY#SEA",
        "name": "Main St 5th Ave",
        "lat": "47.6101",
        "lng": "-122.2015",
        "model": "LW-2025",
        "installed_at": "2026-02-01T18:22:00+00:00",
    },
    {
        "tenant_id": "tenant-001",
        "streetlight_id": "LW-00043",
        "wireless_device_id": "dev-lw-00043",
        "site_id": "CITY#SEA",
        "name": "Parking Lot Pole",
        "lat": "47.6099",
        "lng": "-122.2022",
        "model": "LW-2025",
        "installed_at": "2026-02-01T18:22:00+00:00",
    },
    {
        "tenant_id": "tenant-001",
        "streetlight_id": "LW-00044",
        "wireless_device_id": "dev-lw-00044",
        "site_id": "CITY#SEA",
        "name": "North Entrance",
        "lat": "47.6110",
        "lng": "-122.2010",
        "model": "LW-2025",
        "installed_at": "2026-02-01T18:22:00+00:00",
    },
    {
        "tenant_id": "tenant-001",
        "streetlight_id": "LW-00045",
        "wireless_device_id": "dev-lw-00045",
        "site_id": "CITY#SEA",
        "name": "South Gate",
        "lat": "47.6090",
        "lng": "-122.2030",
        "model": "LW-2025",
        "installed_at": "2026-02-01T18:22:00+00:00",
    },
]

USERS = [
    {
        "tenant_id": "tenant-001",
        "user_id": "TENANT",
        "name": "Test Tenant",
        "created_at": "2026-01-01T00:00:00Z",
    },
]


def seed_streetlights():
    table = dynamo.Table("Streetlights")
    for item in STREETLIGHTS:
        table.put_item(Item=item)
        print(f"Seeded streetlight state: {item['streetlight_id']}")


def seed_metadata():
    table = dynamo.Table("StreetlightMetadata")
    for item in STREETLIGHT_METADATA:
        table.put_item(Item=item)
        print(f"Seeded streetlight metadata: {item['streetlight_id']}")


def seed_users():
    table = dynamo.Table("UsersAndTenants")
    for item in USERS:
        table.put_item(Item=item)
        print(f"Seeded user: {item['user_id']}")


def main():
    seed_streetlights()
    seed_metadata()
    seed_users()


if __name__ == "__main__":
    main()
