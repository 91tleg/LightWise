# IoT Core Uplink
**Version:** 1.0  
**Last Updated:** March 13, 2026  

Describes the message format delivered by AWS IoT Core when a LoRaWAN uplink is received from a streetlight node.

See [README.md](./README.md) for shared conventions.

---

## Uplink Message Format

```json
{
  "MessageId": "ec8a023d-9b97-422c-b762-b575a1f1e88a",
  "WirelessDeviceId": "559bf27a-76d7-4afe-a12c-0c618afe0eeb",
  "PayloadData": "ARQZE0EAHg==",
  "WirelessMetadata": {
    "LoRaWAN": {
      "FCnt": 10,
      "FPort": 3
    }
  }
}
```

**Fields:**
| Field | Type | Description |
|---|---|---|
| `MessageId` | string | Unique message identifier assigned by IoT Core |
| `WirelessDeviceId` | string | IoT Core wireless device ID — maps to `streetlight_id` in the device registry |
| `PayloadData` | string | Base64-encoded binary uplink payload — decoded per the uplink payload specification |
| `WirelessMetadata.LoRaWAN.FCnt` | int | LoRaWAN frame counter |
| `WirelessMetadata.LoRaWAN.FPort` | int | LoRaWAN port number |

**Payload decoding:** See the uplink payload specification for the binary decode pipeline. `PayloadData` is base64-decoded then passed to `decode_uplink()`.
