#!usr/bin/env bash

mkdir build -p
cd build
cmake ..
make -j
ctest --output-on-failure
