#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pio run -e esp32-s3-devkitm-1
