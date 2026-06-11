#!/usr/bin/env bash
# scripts/ci-diagnostic.sh — print CI runner state for debugging
# lockfile-vs-runner divergence.
#
# Used by `.github/workflows/ci.yml` at the start of the CI job to
# surface, in the run log:
#   - The runner's architecture (uname -m, process.arch, uname -s)
#   - The md5sum of the locked package-lock.json
#   - The lockfile's declared lockfileVersion (2 vs 3)
#   - The esbuild version listed in the lockfile
#
# The expected output for a healthy run is:
#   Runner arch: x86_64
#   Node arch:   x64
#   OS:          Linux
#   lockfile md5: <some hash>
#   lockfileVersion: 2
#   esbuild in lockfile: 0.19.12
#
# If the esbuild version is anything other than 0.19.12, the
# lockfile is NOT what we pushed — the runner is using a stale
# file from somewhere (workflow cache, runner working dir, or
# similar), and the maintainer can debug from the log.
#
# This script is intentionally trivial (no flags, no error
# handling, no shebang options) so the YAML-invocation in the
# workflow is the simplest possible (`run: bash
# scripts/ci-diagnostic.sh`) and there is zero risk of YAML
# quoting bugs in the workflow file itself.
set -e

echo "Runner arch: $(uname -m)"
echo "Node arch:   $(node -e 'console.log(process.arch)')"
echo "OS:          $(uname -s)"
echo "lockfile md5: $(md5sum package-lock.json | cut -d' ' -f1)"
echo "lockfileVersion: $(node -e 'console.log(require("./package-lock.json").lockfileVersion)')"
echo "esbuild in lockfile: $(node -e 'console.log(require("./package-lock.json").packages["node_modules/esbuild"].version)')"
