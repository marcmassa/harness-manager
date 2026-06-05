#!/usr/bin/env python3
"""project-detect.py — Stack auto-detection for the Harness SDD bootstrap.

Inspects a project root for common tech-stack markers and returns the list of
matched `project_detect` rules from `.agents/agentic.json`.

Usage:
    python3 project-detect.py <project_root>
"""

from __future__ import annotations

import glob
import json
import os
import sys
from pathlib import Path
from typing import Any


def _has_glob(root: Path, pattern: str) -> bool:
    matches = glob.glob(str(root / pattern), recursive=True)
    return len(matches) > 0


def _has_file(root: Path, name: str) -> bool:
    return (root / name).exists()


def evaluate_condition(root: Path, cond: dict[str, Any]) -> bool:
    for key, patterns in cond.items():
        if key == "file_exists":
            if not any(_has_file(root, p) for p in patterns):
                return False
        elif key == "file_glob":
            if not any(_has_glob(root, p) for p in patterns):
                return False
        else:
            return False
    return True


def detect(root: Path, manifest: dict[str, Any]) -> list[dict[str, Any]]:
    rules = manifest.get("project_detect", [])
    matched = []
    for rule in rules:
        cond = rule.get("when", {})
        if evaluate_condition(root, cond):
            matched.append(rule)
    return matched


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: project-detect.py <project_root>", file=sys.stderr)
        return 1
    root = Path(sys.argv[1]).resolve()
    manifest_path = root / ".agents" / "agentic.json"
    if not manifest_path.exists():
        print(f"No agentic.json at {manifest_path}", file=sys.stderr)
        return 1
    with manifest_path.open() as f:
        manifest = json.load(f)
    matched = detect(root, manifest)
    out = [{"label": r.get("label", "?"), "apply": r.get("apply", {})} for r in matched]
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
