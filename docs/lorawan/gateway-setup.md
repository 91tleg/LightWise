# AWS IoT Core LoRaWAN Gateway Setup Guide
This guide covers the configuration of a Seeed SenseCAP M2 (or similar Basics Station gateway) with AWS IoT Core for LoRaWAN.

## 1. IAM Role Configuration
Before adding the gateway to AWS, you must create a "permission slip" (IAM Role) that allows the LoRaWAN service to manage the gateway.

### A. Create the Role

Trusted Entity Type: Custom Trust Policy.

Trust Relationship JSON:

### B. Attach Managed Policies

Attach the following AWS managed policies to the role:

`AWSIoTWirelessGatewayCertManager` (Required for certificate handshake).

`AWSIoTWirelessFullAccess` (For general management).

`AWSIoTWirelessFullPublishAccess` (Required for the Destination to send data to IoT Core).

### 2. AWS Gateway Registration
Navigate to IoT Core > LPWAN devices > Gateways > Add gateway.

Gateway EUI: Enter the 16-digit ID  

Frequency Band: Select your region (e.g., US915 or EU868).

IAM Role: Select the role created in Step 1.

### 3. Certificate Management
After creating the gateway, AWS generates unique security keys. You must download all of them right here right now.

Gateway Certificate: `...cert.pem`

Private Key: `...private.key`  

Trust Anchor: `cups.trust` and `lns.trust`

### 4. Gateway Local Configuration
Access gateway’s local web dashboard and apply these settings:

Mode: LoRa Basics Station.

Auth Mode: TLS Server & Client Authentication.

LNS Endpoint: Found in AWS IoT Core > Settings (it will look like `xxxxxx.lorawan.us-east-1.amazonaws.com:443`).

### 5. Troubleshooting & Verification

WS connection shutdown / Connection reset: Usually a Trust Relationship error in the IAM role (or a missing Private Key).

**Document Version**: 1.0  
**Last Updated**: March 4, 2026  
