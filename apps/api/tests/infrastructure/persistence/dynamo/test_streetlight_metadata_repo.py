from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from botocore.exceptions import ClientError

from domain.streetlight.models import StreetlightMetadata
from infrastructure.persistence.dynamo.streetlight_metadata_repo import (
    LEGACY_METADATA_SK,
    StreetlightMetadataRepo,
)


def _legacy_schema_error(operation_name: str = "Query") -> ClientError:
    return ClientError(
        {
            "Error": {
                "Code": "ValidationException",
                "Message": (
                    "Query condition missed key schema element: tenant_id"
                ),
            }
        },
        operation_name,
    )


def _build_repo(table: MagicMock) -> StreetlightMetadataRepo:
    fake_db = MagicMock()
    fake_db.Table.return_value = table

    with patch(
        "infrastructure.persistence.dynamo.streetlight_metadata_repo"
        ".get_dynamodb_resource",
        return_value=fake_db,
    ):
        return StreetlightMetadataRepo("StreetlightMetadata")


def test_list_by_tenant_falls_back_to_scan_for_legacy_local_table():
    table = MagicMock()
    table.query.side_effect = _legacy_schema_error()
    table.scan.return_value = {
        "Items": [
            {
                "tenant_id": "tenant-001",
                "streetlight_id": "LW-00100",
                "name": "Main St 5th Ave",
                "lat": "47.6101",
                "lng": "-122.2015",
            },
            {
                "tenant_id": "tenant-999",
                "streetlight_id": "LW-00999",
            },
        ]
    }

    repo = _build_repo(table)

    results = repo.list_by_tenant("tenant-001")

    assert len(results) == 1
    assert results[0].streetlight_id == "LW-00100"
    assert results[0].name == "Main St 5th Ave"
    assert results[0].site_id == ""
    assert results[0].wireless_device_id == ""
    assert results[0].installed_at == datetime(
        1970, 1, 1, tzinfo=timezone.utc
    )


def test_get_falls_back_to_legacy_primary_key_shape():
    table = MagicMock()
    table.get_item.side_effect = [
        _legacy_schema_error("GetItem"),
        {
            "Item": {
                "streetlight_id": "LW-00100",
                "SK": LEGACY_METADATA_SK,
                "tenant_id": "tenant-001",
                "name": "Main St 5th Ave",
                "installed_at": "2026-02-01T18:22:00+00:00",
            }
        },
    ]

    repo = _build_repo(table)

    result = repo.get("tenant-001", "LW-00100")

    assert result is not None
    assert result.streetlight_id == "LW-00100"
    assert result.name == "Main St 5th Ave"
    assert table.get_item.call_args_list[1].kwargs["Key"] == {
        "streetlight_id": "LW-00100",
        "SK": LEGACY_METADATA_SK,
    }


def test_save_falls_back_to_legacy_primary_key_shape():
    table = MagicMock()
    table.put_item.side_effect = [
        _legacy_schema_error("PutItem"),
        {},
    ]

    repo = _build_repo(table)
    metadata = StreetlightMetadata(
        streetlight_id="LW-00100",
        wireless_device_id="dev-lw-00100",
        site_id="CITY#SEA",
        lat=47.6101,
        lng=-122.2015,
        name="Main St 5th Ave",
        model="LW-2025",
        installed_at=datetime(2026, 2, 1, 18, 22, tzinfo=timezone.utc),
    )

    repo.save("tenant-001", metadata)

    assert table.put_item.call_count == 2
    assert table.put_item.call_args_list[1].kwargs["Item"]["SK"] == (
        LEGACY_METADATA_SK
    )


def test_get_by_wireless_device_id_falls_back_to_scan_without_index():
    table = MagicMock()
    table.query.side_effect = _legacy_schema_error()
    table.scan.return_value = {
        "Items": [
            {
                "tenant_id": "tenant-001",
                "streetlight_id": "LW-00100",
                "site_id": "CITY#SEA",
                "wireless_device_id": "dev-lw-00100",
            }
        ]
    }

    repo = _build_repo(table)

    result = repo.get_by_wireless_device_id("dev-lw-00100")

    assert result is not None
    assert result.tenant_id == "tenant-001"
    assert result.streetlight_id == "LW-00100"
    assert result.site_id == "CITY#SEA"
