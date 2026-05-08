from __future__ import annotations
from datetime import datetime, timezone
from unittest.mock import MagicMock
from unittest.mock import patch

import pytest

from application.streetlight.send_command import (
    InvalidCommandError,
    InvalidCommandParamsError,
    MissingWirelessDeviceIdError,
    SendStreetlightCommand,
    StreetlightNotFoundError,
    _default_command_id,
)
from domain.streetlight.commands import (
    DownlinkCmd,
    SetLevelsParams,
    StreetlightCommand,
)
from domain.streetlight.models import StreetlightMetadata


_METADATA = StreetlightMetadata(
    streetlight_id="sl-001",
    wireless_device_id="dev-001",
    site_id="site-1",
    lat=37.77,
    lng=-122.41,
    name="Main St",
    model="LUM-MAX-200",
    installed_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
)


def _use_case(
    metadata: StreetlightMetadata | None = _METADATA,
) -> tuple[
    SendStreetlightCommand,
    MagicMock,
    MagicMock,
    MagicMock,
    MagicMock,
]:
    metadata_repo = MagicMock()
    metadata_repo.get.return_value = metadata
    command_repo = MagicMock()
    sender = MagicMock()
    encoder = MagicMock()
    encoder.encode.return_value = b"\x01\x01\x5a\x14"

    return (
        SendStreetlightCommand(
            metadata_repo=metadata_repo,
            command_repo=command_repo,
            downlink_sender=sender,
            payload_encoder=encoder,
            command_id_factory=lambda: "cmd-test",
            epoch_seconds=lambda: 1_700_000_000,
        ),
        metadata_repo,
        command_repo,
        sender,
        encoder,
    )


class TestSendStreetlightCommandSuccess:
    def test_writes_sends_marks_sent_and_returns_result(self):
        use_case, metadata_repo, command_repo, sender, encoder = _use_case()

        result = use_case.execute(
            tenant_id="tenant-1",
            issued_by="user-1",
            streetlight_id="sl-001",
            command="SET_LEVELS",
            params={"max_level": 90, "dim_level": 20},
        )

        assert result.command_id == "cmd-test"
        assert result.streetlight_id == "sl-001"
        assert result.command == "SET_LEVELS"
        assert result.status == "sent"
        domain_command = StreetlightCommand(
            command=DownlinkCmd.SET_LEVELS,
            params=SetLevelsParams(max_level=90, dim_level=20),
        )
        metadata_repo.get.assert_called_once_with("tenant-1", "sl-001")
        encoder.encode.assert_called_once_with(domain_command)
        command_repo.write.assert_called_once_with(
            streetlight_id="sl-001",
            command_id="cmd-test",
            tenant_id="tenant-1",
            issued_by="user-1",
            command=domain_command,
            ttl=1_700_000_300,
        )
        sender.send.assert_called_once_with("dev-001", b"\x01\x01\x5a\x14")
        command_repo.mark_sent.assert_called_once_with("sl-001", "cmd-test")

    def test_mark_sent_not_called_when_sender_fails(self):
        use_case, _, command_repo, sender, _ = _use_case()
        sender.send.side_effect = RuntimeError("network rejected")

        with pytest.raises(RuntimeError, match="network rejected"):
            use_case.execute(
                tenant_id="tenant-1",
                issued_by="user-1",
                streetlight_id="sl-001",
                command="SET_LEVELS",
                params={"max_level": 90, "dim_level": 20},
            )

        command_repo.write.assert_called_once()
        command_repo.mark_sent.assert_not_called()


class TestCommandId:
    def test_default_command_id_is_time_ordered(self):
        with patch(
            "application.streetlight.send_command.time.time_ns",
            side_effect=[1, 2],
        ), patch(
            "application.streetlight.send_command.uuid.uuid4"
        ) as mock_uuid:
            mock_uuid.return_value.hex = "abcdef"
            first = _default_command_id()
            second = _default_command_id()

        assert first == "cmd-00000000000000000001-abcdef"
        assert second == "cmd-00000000000000000002-abcdef"
        assert first < second


class TestSendStreetlightCommandValidation:
    def test_invalid_command_raises_before_repo_lookup(self):
        use_case, metadata_repo, command_repo, sender, encoder = _use_case()

        with pytest.raises(InvalidCommandError, match="Invalid command"):
            use_case.execute(
                tenant_id="tenant-1",
                issued_by="user-1",
                streetlight_id="sl-001",
                command="NOPE",
                params={},
            )

        metadata_repo.get.assert_not_called()
        command_repo.write.assert_not_called()
        sender.send.assert_not_called()
        encoder.encode.assert_not_called()

    def test_invalid_params_raises_before_repo_lookup(self):
        use_case, metadata_repo, command_repo, sender, encoder = _use_case()

        with pytest.raises(
            InvalidCommandParamsError, match="dim_level must be <= max_level"
        ):
            use_case.execute(
                tenant_id="tenant-1",
                issued_by="user-1",
                streetlight_id="sl-001",
                command="SET_LEVELS",
                params={"max_level": 20, "dim_level": 90},
            )

        metadata_repo.get.assert_not_called()
        command_repo.write.assert_not_called()
        sender.send.assert_not_called()
        encoder.encode.assert_not_called()

    def test_non_object_params_raises_before_repo_lookup(self):
        use_case, metadata_repo, command_repo, sender, encoder = _use_case()

        with pytest.raises(
            InvalidCommandParamsError, match="params must be an object"
        ):
            use_case.execute(
                tenant_id="tenant-1",
                issued_by="user-1",
                streetlight_id="sl-001",
                command="SET_LEVELS",
                params=[],
            )

        metadata_repo.get.assert_not_called()
        command_repo.write.assert_not_called()
        sender.send.assert_not_called()
        encoder.encode.assert_not_called()

    def test_missing_streetlight_raises_without_sending(self):
        use_case, metadata_repo, command_repo, sender, encoder = _use_case(
            metadata=None
        )

        with pytest.raises(
            StreetlightNotFoundError, match="Streetlight not found"
        ):
            use_case.execute(
                tenant_id="tenant-1",
                issued_by="user-1",
                streetlight_id="sl-404",
                command="SET_LEVELS",
                params={"max_level": 90, "dim_level": 20},
            )

        metadata_repo.get.assert_called_once_with("tenant-1", "sl-404")
        command_repo.write.assert_not_called()
        sender.send.assert_not_called()
        encoder.encode.assert_not_called()

    def test_missing_wireless_device_id_raises_without_sending(self):
        metadata = StreetlightMetadata(
            streetlight_id="sl-001",
            wireless_device_id="",
            site_id="site-1",
            lat=None,
            lng=None,
            name=None,
            model="LUM-MAX-200",
            installed_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        )
        use_case, _, command_repo, sender, encoder = _use_case(metadata)

        with pytest.raises(
            MissingWirelessDeviceIdError, match="wireless_device_id"
        ):
            use_case.execute(
                tenant_id="tenant-1",
                issued_by="user-1",
                streetlight_id="sl-001",
                command="SET_LEVELS",
                params={"max_level": 90, "dim_level": 20},
            )

        command_repo.write.assert_not_called()
        sender.send.assert_not_called()
        encoder.encode.assert_not_called()
