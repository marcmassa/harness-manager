#!/bin/bash
# Hook: on_check_pass — registra timestamp del último check.sh exitoso
mkdir -p "$ROOT_DIR/progress"
date -u +"%Y-%m-%dT%H:%M:%Sz" > "$ROOT_DIR/progress/last-check-pass.txt"
echo "CI timestamp recorded in progress/last-check-pass.txt"
