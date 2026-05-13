#!/usr/bin/env python

import secrets


def generate_lorawan_credentials():
    # AppEUI: 8 bytes (16 hex chars)
    app_eui = secrets.token_hex(8).upper()

    # AppKey: 16 bytes (32 hex chars)
    app_key = secrets.token_hex(16).upper()

    print(f"AppEUI: {app_eui}")
    print(f"AppKey: {app_key}")

if __name__ == "__main__":
    generate_lorawan_credentials()
