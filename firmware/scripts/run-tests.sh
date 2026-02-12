#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR/../test"

mkdir -p build
cd build

cmake ..
make -j
ctest --output-on-failure
