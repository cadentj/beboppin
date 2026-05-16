#!/usr/bin/env bash
set -euo pipefail

name="${1:?usage: $(basename "$0") <program_name>}"
root="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$root/build"
cc -std=c11 -Wall -Wextra "$root/${name}.c" -o "$root/build/$name"
exec "$root/build/$name"
