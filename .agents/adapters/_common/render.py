#!/usr/bin/env python3
"""render.py — Deterministic adapter renderer for Harness SDD.

Reads `.agents/agentic.json` (the canonical manifest), applies project-stack
detection via `project-detect.py`, and renders the native config files for the
requested CLI under `.agents/adapters/<cli>/`.

Usage:
    python3 render.py --cli <cli> --root <project_root> [--check]
    python3 render.py --profile --root <project_root> [--apply]
    python3 render.py --prune --root <project_root>
    python3 render.py --list-orphans --root <project_root>
    python3 render.py --detect-stack --root <project_root>
    python3 render.py --validate-init --root <project_root>
    python3 render.py --add-agent <name> --root <project_root>
    python3 render.py --remove-examples --root <project_root>

In `--check` mode, the renderer re-renders to a temp file and diffs against the
existing on-disk artifact. Exits 0 if identical, 1 if drift (or if the on-disk
file is missing).

In `--profile` mode, the renderer analyzes the project and prints recommended
add/keep/remove actions for each subagent. With `--apply`, it updates
`agentic.json` accordingly and scaffolds any missing `SUBAGENT.md` files.

Each adapter under `.agents/adapters/<cli>/` may contain:
  - `*.tmpl`           — single-output templates (substitution + LOOP blocks)
  - `_template.<ext>.tmpl` — per-item templates; the renderer produces one
                              output file per item in the relevant array
                              (e.g. one per subagent, one per command).

Template syntax (for MD/TOML/JSONC):
  - `{{ SIMPLE_VAR }}` — recursive substitution from the merged context dict.
  - `{{ LOOP:key }} ... {{ ENDLOOP }}` — iterate over the array at context[key],
    exposing each element as `{{ item.<field> }}`.

For native JSON output (opencode, claude settings), the renderer builds the
dict programmatically instead of templating, to guarantee valid JSON.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from glob import glob
from pathlib import Path
from typing import Any


SIMPLE_VAR_RE = re.compile(r"\{\{\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\}\}")
LOOP_RE = re.compile(
    r"\{\{\s*LOOP:([A-Za-z_][A-Za-z0-9_]*)\s*\}\}(.*?)\{\{\s*ENDLOOP\s*\}\}",
    re.DOTALL,
)

CANONICAL_SUBAGENTS: set[str] = {
    "harness",
    "spec-author",
    "implementer",
    "reviewer",
}


def load_manifest(root: Path) -> dict[str, Any]:
    manifest_path = root / ".agents" / "agentic.json"
    with manifest_path.open() as f:
        return json.load(f)


def save_manifest(root: Path, manifest: dict[str, Any]) -> None:
    manifest_path = root / ".agents" / "agentic.json"
    with manifest_path.open("w") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")


def matches_condition(root: Path, cond: dict[str, Any] | None) -> bool:
    """Evaluate a `when` or `applies_when` block.

    Supported keys (all must match, combined with AND):
      - file_exists: [path, ...]    — at least one path must exist
      - file_glob:   [pattern, ...] — at least one glob must yield results
    An empty/None condition is treated as a match.
    """
    if not cond:
        return True
    for key, patterns in cond.items():
        if not patterns:
            continue
        if key == "file_exists":
            if not any((root / p).exists() for p in patterns):
                return False
        elif key == "file_glob":
            if not any(glob(str(root / p), recursive=True) for p in patterns):
                return False
        else:
            return False
    return True


def detect_stack(root: Path, manifest: dict[str, Any]) -> list[dict[str, Any]]:
    """Run the project_detect rules against the project root."""
    return [r for r in manifest.get("project_detect", []) if matches_condition(root, r.get("when"))]


def merge_permissions(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    """Deep-merge two permission dicts. Override values win on conflict."""
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = merge_permissions(out[k], v)
        else:
            out[k] = v
    return out


def _merge_unique_ordered(*lists: list[str]) -> list[str]:
    """Unión ordenada y deduplicada preservando la primera aparición.

    Usado para fusionar `manifest.skills.paths[]` con `extra_skills[]`
    (calculado desde `project_detect[].apply.add_skills[]`). El primer argumento
    tiene precedencia: si un path aparece en `manifest.skills.paths[]` y en
    `extra_skills[]`, se conserva la posición del primero.
    """
    seen: set[str] = set()
    out: list[str] = []
    for lst in lists:
        for item in lst:
            if item not in seen:
                seen.add(item)
                out.append(item)
    return out


_PLACEHOLDER_RE = re.compile(r"^(\s*)\[([A-Za-z][A-Za-z0-9 _-]{0,30})\]\s*$")


def _sanitize_template_body(body: str) -> str:
    """Elimina líneas que son placeholders huérfanos del estilo '[Area 1]'.

    Un placeholder huérfano es una línea que:
      - Empieza con 0+ espacios
      - Sigue con '[' + (letra inicial) + (letras/dígitos/espacios/guiones_bajos/guiones, máx 30) + ']'
      - Termina con 0+ espacios
      - NO está dentro de un bloque de código ```...```

    Heurística: si la línea coincide con `^\\s*\\[[A-Za-z][A-Za-z0-9 _-]{0,30}\\]\\s*$`,
    se reemplaza por un comentario HTML indicando que se sustituye en producción.
    Conserva la indentación original.

    Por qué existe: el archivo `.agents/subagents/agent-template/SUBAGENT.md`
    contiene corchetes literales como `[Area 1]`, `[Step 1]` pensados como
    referencia humana. Si ese cuerpo se usa para scaffold de un sub-agent de
    producción, los placeholders se filtrarían. Esta función los reemplaza
    por `<!-- TODO: personalizar esta sección -->`.
    """
    sanitized: list[str] = []
    in_code_block = False
    for line in body.splitlines():
        if line.strip().startswith("```"):
            in_code_block = not in_code_block
            sanitized.append(line)
            continue
        if in_code_block:
            sanitized.append(line)
            continue
        m = _PLACEHOLDER_RE.match(line)
        if m:
            indent = m.group(1)
            sanitized.append(f"{indent}<!-- TODO: personalizar esta sección -->")
        else:
            sanitized.append(line)
    return "\n".join(sanitized) + "\n"


def build_context(
    root: Path, manifest: dict[str, Any], stack_matches: list[dict[str, Any]]
) -> dict[str, Any]:
    """Build the substitution context from the manifest + stack detection."""
    implementer = next(
        (sa for sa in manifest["subagents"] if sa["name"] == "implementer"),
        None,
    )
    implementer_perm = implementer.get("permission", {}) if implementer else {}
    extra_skills: list[str] = []
    for m in stack_matches:
        for s in m.get("apply", {}).get("add_skills", []):
            extra_skills.append(s)
        overrides = m.get("apply", {}).get("implementer_permission_overrides", {})
        if overrides:
            implementer_perm = merge_permissions(implementer_perm, overrides)

    base_paths = manifest.get("skills", {}).get("paths", [])
    return {
        "manifest": manifest,
        "root": str(root),
        "default_agent": manifest.get("default_agent", "harness"),
        "instructions": manifest.get("instructions", []),
        "skills_paths": _merge_unique_ordered(base_paths, extra_skills),
        "subagents": manifest.get("subagents", []),
        "commands": manifest.get("commands", []),
        "implementer_permission": implementer_perm,
        "stack_labels": [m.get("label", "?") for m in stack_matches],
        "extra_skills": extra_skills,
    }


def render_template_str(template: str, ctx: dict[str, Any]) -> str:
    """Render `{{ VAR }}` and `{{ LOOP:key }}...{{ ENDLOOP }}` blocks."""

    def expand_loops(s: str, scope: dict[str, Any]) -> str:
        def replace(m: re.Match[str]) -> str:
            key = m.group(1)
            body = m.group(2)
            items = scope.get(key)
            if not isinstance(items, list):
                return ""
            rendered = []
            for item in items:
                inner_scope = {**scope, "item": item}
                rendered.append(expand_vars(body, inner_scope))
            return "".join(rendered)

        return LOOP_RE.sub(replace, s)

    def expand_vars(s: str, scope: dict[str, Any]) -> str:
        s = expand_loops(s, scope)

        def lookup(path: str, scope: dict[str, Any]) -> Any:
            cur: Any = scope
            for part in path.split("."):
                if isinstance(cur, dict):
                    cur = cur.get(part)
                else:
                    return None
            return cur

        def replace(m: re.Match[str]) -> str:
            path = m.group(1)
            val = lookup(path, scope)
            if val is None:
                return ""
            if isinstance(val, (dict, list)):
                return json.dumps(val, indent=2, ensure_ascii=False)
            return str(val)

        return SIMPLE_VAR_RE.sub(replace, s)

    return expand_vars(template, ctx)


def write_file(path: Path, content: str, check: bool, original: str | None) -> bool:
    """Write file. In check mode, diff against original and return True if equal/missing-ok."""
    if check:
        if not path.exists():
            print(f"  MISSING: {path}")
            return False
        existing = path.read_text()
        if existing != content:
            print(f"  DRIFT: {path}")
            return False
        return True
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    print(f"  WROTE: {path}")
    return True


def render_opencode(
    root: Path,
    manifest: dict[str, Any],
    ctx: dict[str, Any],
    check: bool,
) -> bool:
    cfg: dict[str, Any] = {
        "$schema": "https://opencode.ai/config.json",
        "instructions": ctx["instructions"],
        "skills": {"paths": ctx["skills_paths"]},
        "default_agent": ctx["default_agent"],
        "agent": {},
        "command": {},
    }
    for sa in ctx["subagents"]:
        agent_def: dict[str, Any] = {
            "mode": sa.get("mode", "subagent"),
            "description": sa["description"],
            "prompt": (
                f"You are `{sa['name']}`. Your complete role is defined in "
                f"`{sa['role_file']}` — read that file FIRST and follow it strictly."
            ),
        }
        if sa["name"] == "implementer" and ctx["implementer_permission"]:
            agent_def["permission"] = ctx["implementer_permission"]
        elif "permission" in sa:
            agent_def["permission"] = sa["permission"]
        cfg["agent"][sa["name"]] = agent_def
    for cmd in ctx["commands"]:
        cfg["command"][cmd["name"]] = {
            "description": cmd["description"],
            "template": (
                f"Read `{cmd['body_file']}` and execute the workflow described there."
            ),
        }
    out = root / "opencode.json"
    body = json.dumps(cfg, indent=2, ensure_ascii=False)
    return write_file(out, body + "\n", check, body + "\n")


def render_gemini(
    root: Path,
    manifest: dict[str, Any],
    ctx: dict[str, Any],
    check: bool,
) -> bool:
    adapter_dir = root / ".agents" / "adapters" / "gemini-cli"
    ok = True

    gemini_tmpl_path = adapter_dir / "GEMINI.md.tmpl"
    gemini_out = root / "GEMINI.md"
    if gemini_tmpl_path.exists():
        body = render_template_str(gemini_tmpl_path.read_text(), ctx)
        ok &= write_file(gemini_out, body, check, None)
    else:
        print(f"  WARN: {gemini_tmpl_path} not found, skipping GEMINI.md")

    cmds_tmpl_dir = adapter_dir / "gemini-commands"
    if cmds_tmpl_dir.exists():
        tmpl_files = list(cmds_tmpl_dir.glob("_template.*.tmpl"))
        if not tmpl_files:
            print(f"  WARN: no _template.*.tmpl in {cmds_tmpl_dir}")
        for tf in tmpl_files:
            ext = tf.name.replace("_template.", "").replace(".tmpl", "")
            for cmd in ctx["commands"]:
                cmd_ctx = {**ctx, "item": cmd, "command": cmd}
                body = render_template_str(tf.read_text(), cmd_ctx)
                out = root / ".gemini" / "commands" / f"{cmd['name']}.{ext}"
                ok &= write_file(out, body, check, None)
    return ok


def render_claude(
    root: Path,
    manifest: dict[str, Any],
    ctx: dict[str, Any],
    check: bool,
) -> bool:
    adapter_dir = root / ".agents" / "adapters" / "claude-code"
    ok = True

    claude_md_tmpl = adapter_dir / "CLAUDE.md.tmpl"
    if claude_md_tmpl.exists():
        body = render_template_str(claude_md_tmpl.read_text(), ctx)
        ok &= write_file(root / "CLAUDE.md", body, check, None)

    agents_tmpl_dir = adapter_dir / "claude-agents"
    if agents_tmpl_dir.exists():
        tf = next(iter(agents_tmpl_dir.glob("_template.*.tmpl")), None)
        if tf:
            for sa in ctx["subagents"]:
                sa_ctx = {**ctx, "item": sa, "subagent": sa}
                if sa["name"] == "implementer" and ctx["implementer_permission"]:
                    sa_ctx = {**sa_ctx, "permission": ctx["implementer_permission"]}
                body = render_template_str(tf.read_text(), sa_ctx)
                out = root / ".claude" / "agents" / f"{sa['name']}.md"
                ok &= write_file(out, body, check, None)

    cmds_tmpl_dir = adapter_dir / "claude-commands"
    if cmds_tmpl_dir.exists():
        tf = next(iter(cmds_tmpl_dir.glob("_template.*.tmpl")), None)
        if tf:
            for cmd in ctx["commands"]:
                cmd_ctx = {**ctx, "item": cmd, "command": cmd}
                body = render_template_str(tf.read_text(), cmd_ctx)
                out = root / ".claude" / "commands" / f"{cmd['name']}.md"
                ok &= write_file(out, body, check, None)

    settings_tmpl = adapter_dir / "claude-settings.json.tmpl"
    if settings_tmpl.exists():
        body = render_template_str(settings_tmpl.read_text(), ctx)
        ok &= write_file(root / ".claude" / "settings.json", body, check, None)

    return ok


RENDERERS = {
    "opencode": render_opencode,
    "gemini-cli": render_gemini,
    "claude-code": render_claude,
}


def list_orphans(root: Path, manifest: dict[str, Any]) -> list[str]:
    """Canonical subagent directories on disk that are not referenced anywhere
    in `agentic.json` (neither in `subagents[]` nor in
    `_template_subagents_examples[]`).

    A canonical directory is "expected" if it appears in either list:
      - `subagents[]`                      — the agent is active.
      - `_template_subagents_examples[]`   — the agent is a template scaffold.
    Returns the list of orphan names (not paths).
    """
    subagents_dir = root / ".agents" / "subagents"
    if not subagents_dir.exists():
        return []
    active = {sa["name"] for sa in manifest.get("subagents", [])}
    scaffolds = {sa["name"] for sa in manifest.get("_template_subagents_examples", [])}
    expected = active | scaffolds
    orphans: list[str] = []
    for sub_dir in sorted(subagents_dir.iterdir()):
        if not sub_dir.is_dir():
            continue
        name = sub_dir.name
        if name == "agent-template":
            continue
        if name in CANONICAL_SUBAGENTS and name not in expected:
            orphans.append(name)
    return orphans


def prune_orphans(root: Path, manifest: dict[str, Any]) -> list[str]:
    """Remove canonical subagent directories that are not in `agentic.json`.
    Project-specific subagents are never auto-pruned.
    Returns the list of pruned names for logging."""
    pruned: list[str] = []
    for name in list_orphans(root, manifest):
        target = root / ".agents" / "subagents" / name
        if target.exists():
            shutil.rmtree(target)
            pruned.append(name)
    return pruned


def should_subagent_apply(root: Path, sa: dict[str, Any]) -> bool:
    """Decide whether a subagent entry should be active for this project.

    Resolution order:
      1. If `applies_when` matches → active.
      2. Else if `default: true` → active.
      3. Else → not active.
    """
    applies_when = sa.get("applies_when")
    if applies_when is not None and matches_condition(root, applies_when):
        return True
    return bool(sa.get("default", False))


def auto_scaffold_all(root: Path, manifest: dict[str, Any]) -> list[str]:
    """For every active subagent in the manifest, create SUBAGENT.md if missing.
    Returns the list of role files that were created."""
    created: list[str] = []
    for sa in manifest.get("subagents", []):
        if not should_subagent_apply(root, sa):
            continue
        if scaffold_subagent_role_file(root, sa):
            created.append(sa["role_file"])
    return created


def scaffold_subagent_role_file(root: Path, sa: dict[str, Any]) -> bool:
    """Create `.agents/subagents/<name>/SUBAGENT.md` from `agent-template/` if missing.
    Returns True if a file was created."""
    role_file = root / sa["role_file"]
    if role_file.exists():
        return False
    template_dir = root / ".agents" / "subagents" / "agent-template"
    if template_dir.exists():
        source = template_dir / "SUBAGENT.md"
        if source.exists():
            target_dir = role_file.parent
            target_dir.mkdir(parents=True, exist_ok=True)
            body = source.read_text()
            body = _sanitize_template_body(body)
            body = re.sub(
                r"^name:\s+agent-template\s*$",
                f"name: {sa['name']}",
                body,
                count=1,
                flags=re.MULTILINE,
            )
            sa_desc = sa.get("description", "")
            if sa_desc:
                body = re.sub(
                    r'^description:\s*".*"\s*$',
                    f'description: "{sa_desc}"',
                    body,
                    count=1,
                    flags=re.MULTILINE,
                )
            role_file.write_text(body)
            return True
    target_dir = role_file.parent
    target_dir.mkdir(parents=True, exist_ok=True)
    role_file.write_text(_default_subagent_body(sa))
    return True


def _default_subagent_body(sa: dict[str, Any]) -> str:
    name = sa["name"]
    description = sa.get("description", name)
    mode = sa.get("mode", "subagent")
    perm_yaml = ""
    if "permission" in sa:
        perm_yaml = "\npermission:\n  edit: " + json.dumps(sa["permission"].get("edit", {})) + "\n"
    return (
        f"---\n"
        f"name: {name}\n"
        f"type: subagent\n"
        f"user-invocable: true\n"
        f"description: \"{description}\"\n"
        f"mode: {mode}\n"
        f"model-agnostic: true\n"
        f"{perm_yaml}"
        f"---\n\n"
        f"# {name} — Harness SDD sub-agent\n\n"
        f"> AUTOGENERATED from .agents/agentic.json. Edit `.agents/agentic.json` to change\n"
        f"> the metadata. Edit this file to customize the role's behavior.\n\n"
        f"## Mission\n\n"
        f"Describe the mission of `{name}`. What problem does it solve in this project?\n\n"
        f"## Main tasks\n\n"
        f"- [Customize this list with the concrete responsibilities of {name}]\n\n"
        f"## Available tools\n\n"
        f"- `AGENTS.md` — navigation map.\n"
        f"- `.agents/agentic.json` — canonical manifest.\n"
        f"- `./check.sh` — verification gateway.\n\n"
        f"## Style rules\n\n"
        f"- **Harness Compliance**: This agent operates under the **Harness SDD** framework.\n"
        f"- **Modular Skills**: Check `.agents/skills/` for specialized knowledge.\n\n"
        f"## Guidelines\n\n"
        f"- **Harness First**: Every action must be traceable and validated via `./check.sh`.\n"
        f"- **Skills Oriented**: Prefer skill instructions over reinvention.\n\n"
        f"## Integration with other sub-agents\n\n"
        f"- `harness` is the default orchestrator.\n"
        f"- `spec-author`, `implementer`, `reviewer` are the SDD flow agents.\n\n"
        f"## Workflow\n\n"
        f"1. Read this file in full to internalize the role.\n"
        f"2. Apply the role's behavior strictly.\n"
        f"3. Document any non-trivial decisions in `progress/decisions.md`.\n"
    )


def profile_project(root: Path, manifest: dict[str, Any]) -> dict[str, Any]:
    """Analyze the project and report on the current subagent set.

    Returns a dict with:
      - detected_stack: list[str]
      - active:   list of {name, reason, action, role_exists}  (from subagents[])
      - examples_matching: list of {name, reason, role_file}   (from
                            _template_subagents_examples[] that match the project)
      - examples_idle:     list of {name, reason, role_file}   (examples that don't match)

    The `profile` subcommand is purely informational: the default install is
    already clean (illustrative agents live in `_template_subagents_examples[]`
    and are not in `subagents[]`). To opt-in to an example, use `add-agent`.
    """
    detected = [r.get("label", "?") for r in detect_stack(root, manifest)]
    active: list[dict[str, Any]] = []
    examples_matching: list[dict[str, Any]] = []
    examples_idle: list[dict[str, Any]] = []

    for sa in manifest.get("subagents", []):
        name = sa["name"]
        role_path = root / sa.get("role_file", f".agents/subagents/{name}/SUBAGENT.md")
        role_exists = role_path.exists()
        applies = should_subagent_apply(root, sa)
        applies_when = sa.get("applies_when")
        is_default = bool(sa.get("default", False))

        if applies:
            reason = (
                f"matches applies_when ({list(applies_when.keys())})"
                if applies_when is not None
                else "default: true"
            )
            action = "scaffold" if not role_exists else "keep"
            active.append({"name": name, "reason": reason, "action": action, "role_exists": role_exists})
        else:
            examples_idle.append(
                {
                    "name": name,
                    "reason": (
                        f"in subagents[] but applies_when "
                        f"({list(applies_when.keys()) if applies_when else []}) "
                        f"does not match and default: {is_default}"
                    ),
                    "role_file": sa.get("role_file"),
                    "source": "subagents",
                }
            )

    for ex in manifest.get("_template_subagents_examples", []):
        name = ex["name"]
        role_path = root / ex.get("role_file", f".agents/subagents/{name}/SUBAGENT.md")
        applies_when = ex.get("applies_when")
        if applies_when and matches_condition(root, applies_when):
            examples_matching.append(
                {
                    "name": name,
                    "reason": f"matches applies_when ({list(applies_when.keys())})",
                    "role_file": ex.get("role_file"),
                    "source": "_template_subagents_examples",
                }
            )
        else:
            examples_idle.append(
                {
                    "name": name,
                    "reason": "template example; not in active manifest",
                    "role_file": ex.get("role_file"),
                    "source": "_template_subagents_examples",
                }
            )

    return {
        "detected_stack": detected,
        "active": active,
        "examples_matching": examples_matching,
        "examples_idle": examples_idle,
    }


def apply_profile(root: Path, manifest: dict[str, Any], report: dict[str, Any]) -> list[str]:
    """Apply the auto-scaffold part of the profile.

    In the clean-install model, `subagents[]` only contains canonical agents
    that should always be active. The `apply` step:
      - Scaffolds any missing `SUBAGENT.md` for active sub-agents.
      - Does NOT remove anything from `subagents[]` (illustrative agents live
        in `_template_subagents_examples[]` and are not in the active set).
      - Does NOT auto-promote examples (use `add-agent` for that).

    Returns a list of human-readable actions taken (for logging).
    """
    actions: list[str] = []
    for entry in report.get("active", []):
        if entry["action"] == "scaffold":
            sa = next((s for s in manifest["subagents"] if s["name"] == entry["name"]), None)
            if sa and scaffold_subagent_role_file(root, sa):
                actions.append(f"scaffolded {sa['role_file']}")
    return actions


def add_agent_from_example(root: Path, manifest: dict[str, Any], name: str) -> list[str]:
    """Promote an entry from `_template_subagents_examples[]` to `subagents[]`.

    The promoted agent gets `default: true` so it stays active regardless of
    `applies_when`. (Use the bootstrap.sh wrapper to confirm with the user.)
    Returns a list of actions taken.
    """
    examples = manifest.get("_template_subagents_examples", [])
    ex = next((e for e in examples if e.get("name") == name), None)
    if ex is None:
        return [f"ERROR: '{name}' not found in _template_subagents_examples[]"]

    if any(s.get("name") == name for s in manifest.get("subagents", [])):
        return [f"'{name}' is already in subagents[] (no change)"]

    new_sa = dict(ex)
    new_sa["default"] = True
    new_sa.pop("applies_when", None)
    new_sa.pop("_lifecycle", None)
    new_sa.pop("_intent", None)
    manifest.setdefault("subagents", []).append(new_sa)
    manifest["_template_subagents_examples"] = [e for e in examples if e.get("name") != name]

    actions: list[str] = []
    if scaffold_subagent_role_file(root, new_sa):
        actions.append(f"scaffolded {new_sa['role_file']}")
    save_manifest(root, manifest)
    actions.insert(0, "saved .agents/agentic.json")
    actions.insert(0, f"promoted '{name}' from _template_subagents_examples to subagents[]")
    return actions


def remove_all_examples(root: Path, manifest: dict[str, Any]) -> list[str]:
    """Drop the `_template_subagents_examples[]` (and `_template_lifecycle`) from the manifest.

    This is the third stage of the scaffold lifecycle (see `_template_lifecycle`
    in agentic.json). Call this after the project's sub-agents are in place.
    Returns a list of actions taken.
    """
    actions: list[str] = []
    n = len(manifest.get("_template_subagents_examples", []))
    if "_template_subagents_examples" in manifest:
        manifest.pop("_template_subagents_examples")
        actions.append(f"removed _template_subagents_examples[] ({n} scaffold entries)")
    if "_template_lifecycle" in manifest:
        manifest.pop("_template_lifecycle")
        actions.append("removed _template_lifecycle")
    if not actions:
        return ["nothing to remove — the manifest is already clean of template scaffolds"]
    save_manifest(root, manifest)
    actions.insert(0, "saved .agents/agentic.json")
    return actions


# Fields that belong to scaffolds (_template_subagents_examples[]) and MUST NOT
# appear in active sub-agents (subagents[]). If any of these leak into a
# subagents[] entry, the init validation gate rejects the manifest.
SCAFFOLD_ONLY_FIELDS = ("_lifecycle", "_intent", "category")

# Fields REQUIRED in every active sub-agent. The init gate rejects entries
# missing any of these.
REQUIRED_SUBAGENT_FIELDS = ("name", "mode", "description", "role_file", "permission")


def validate_init(root: Path, manifest: dict[str, Any]) -> dict[str, Any]:
    """Objective completion gate for the /init workflow.

    Returns a dict with:
        state: one of "FRESH" | "PARTIAL" | "INITIALIZED" | "EMPTY" | "BROKEN"
        ok: True iff state == "INITIALIZED" and there are no schema errors
        errors: list of human-readable error strings (empty if ok)
        warnings: list of human-readable warning strings (empty if perfect)
        summary: one-line human summary

    Exit code from main(): 0 if ok, 1 otherwise.
    """
    subagents: list[dict[str, Any]] = manifest.get("subagents", []) or []
    scaffolds: list[dict[str, Any]] = manifest.get("_template_subagents_examples", []) or []
    has_lifecycle = "_template_lifecycle" in manifest
    n_active = len(subagents)
    n_scaffolds = len(scaffolds)

    if n_active == 0 and n_scaffolds > 0:
        state = "FRESH"
    elif n_active > 0 and n_scaffolds > 0:
        state = "PARTIAL"
    elif n_active > 0 and n_scaffolds == 0:
        state = "INITIALIZED"
    else:
        state = "EMPTY"

    errors: list[str] = []
    warnings: list[str] = []

    if state == "EMPTY":
        errors.append(
            "Both subagents[] and _template_subagents_examples[] are empty. "
            "The install is in a broken state — restore at least one of them."
        )

    if state == "FRESH":
        errors.append(
            "Init has not started: subagents[] is empty. "
            "Run /init to shape the manifest to this project."
        )
        return {
            "state": state,
            "ok": False,
            "errors": errors,
            "warnings": warnings,
            "summary": f"State: {state} — init needed",
        }

    if state == "PARTIAL":
        errors.append(
            f"Init is in progress: subagents[] has {n_active} entries "
            f"but {n_scaffolds} scaffolds remain. "
            f"Run `./.agents/bootstrap.sh remove-examples --yes` to drop the scaffolds."
        )
        if has_lifecycle:
            errors.append(
                "_template_lifecycle is still in the manifest. "
                "It will be removed by `remove-examples`."
            )

    if state in ("PARTIAL", "INITIALIZED"):
        if has_lifecycle and state == "INITIALIZED":
            errors.append(
                "_template_lifecycle is still in the manifest but no scaffolds remain. "
                "Run `./.agents/bootstrap.sh remove-examples --yes` to clean up."
            )

        for i, sa in enumerate(subagents):
            name = sa.get("name", f"<index {i}>")
            for field in REQUIRED_SUBAGENT_FIELDS:
                if field not in sa or not sa[field]:
                    errors.append(
                        f"subagents[{i}] ({name}): missing required field '{field}'"
                    )
            for field in SCAFFOLD_ONLY_FIELDS:
                if field in sa:
                    errors.append(
                        f"subagents[{i}] ({name}): has scaffold-only field '{field}' — "
                        f"this field belongs to _template_subagents_examples[] only. Remove it."
                    )
            mode = sa.get("mode")
            if mode is not None and mode not in ("primary", "subagent"):
                errors.append(
                    f"subagents[{i}] ({name}): mode='{mode}' is invalid (must be 'primary' or 'subagent')"
                )
            role_file = sa.get("role_file", "")
            if role_file and not (root / role_file).is_file():
                errors.append(
                    f"subagents[{i}] ({name}): role_file '{role_file}' does not exist on disk"
                )
            perm = sa.get("permission", {})
            if isinstance(perm, dict) and "edit" not in perm:
                errors.append(
                    f"subagents[{i}] ({name}): permission is missing the 'edit' mapping"
                )
            elif isinstance(perm, dict) and isinstance(perm.get("edit"), dict):
                if "specs/**" not in perm["edit"] and "specs" not in str(perm["edit"]):
                    warnings.append(
                        f"subagents[{i}] ({name}): permission has no 'specs/**' rule — "
                        f"sub-agents should NOT edit the approved spec."
                    )

    ok = state == "INITIALIZED" and not errors
    if ok:
        summary = (
            f"State: INITIALIZED — {n_active} project-specific sub-agent(s), "
            f"no scaffolds, no scaffold-only field leaks. /init is complete."
        )
    else:
        summary = f"State: {state} — {len(errors)} error(s), {len(warnings)} warning(s). /init is NOT complete."

    return {
        "state": state,
        "ok": ok,
        "errors": errors,
        "warnings": warnings,
        "summary": summary,
        "active_count": n_active,
        "scaffold_count": n_scaffolds,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cli", help="CLI to render (e.g. opencode, gemini-cli, claude-code)")
    parser.add_argument("--root", required=True, help="Project root directory")
    parser.add_argument("--check", action="store_true", help="Diff mode, no writes")
    parser.add_argument("--detect-stack", action="store_true", help="Print detected stack labels as JSON")
    parser.add_argument("--prune", action="store_true", help="Prune orphaned canonical subagent directories and exit")
    parser.add_argument("--list-orphans", action="store_true", help="Print names of orphaned canonical subagents and exit")
    parser.add_argument(
        "--profile",
        action="store_true",
        help="Analyze the project and print recommended subagent actions (JSON). Use with --apply to update agentic.json and scaffold role files.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply the profile recommendations (only valid with --profile).",
    )
    parser.add_argument(
        "--add-agent",
        metavar="NAME",
        help="Promote an entry from _template_subagents_examples[] to subagents[]. "
             "Scaffolds the SUBAGENT.md if missing and updates agentic.json.",
    )
    parser.add_argument(
        "--list-examples",
        action="store_true",
        help="List names of agents in _template_subagents_examples[] and exit.",
    )
    parser.add_argument(
        "--remove-examples",
        action="store_true",
        help="Drop the _template_subagents_examples[] and _template_lifecycle fields from agentic.json. "
             "Use this after the project's sub-agents are in place (see _template_lifecycle).",
    )
    parser.add_argument(
        "--validate-init",
        action="store_true",
        help="Validate the post-init manifest state. Exits 0 if subagents[] is shaped correctly, "
             "1 otherwise. Used by the /init completion gate (see .agents/commands/init.md).",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.exists():
        print(f"ERROR: root {root} does not exist", file=sys.stderr)
        return 1

    manifest = load_manifest(root)
    stack = detect_stack(root, manifest)

    if args.detect_stack:
        print(json.dumps([r.get("label", "?") for r in stack], indent=2))
        return 0

    if args.list_orphans:
        for name in list_orphans(root, manifest):
            print(name)
        return 0

    if args.prune:
        pruned = prune_orphans(root, manifest)
        if pruned:
            print(f"Pruned orphaned canonical subagents: {', '.join(pruned)}")
            print("  (These were removed from .agents/agentic.json and no longer active.)")
        else:
            print("No orphaned canonical subagents to prune.")
        return 0

    if args.profile:
        report = profile_project(root, manifest)
        if args.apply:
            actions = apply_profile(root, manifest, report)
            print(json.dumps({"report": report, "actions": actions}, indent=2, ensure_ascii=False))
        else:
            print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0

    if args.list_examples:
        for ex in manifest.get("_template_subagents_examples", []):
            print(ex.get("name", "?"))
        return 0

    if args.add_agent:
        actions = add_agent_from_example(root, manifest, args.add_agent)
        for a in actions:
            print(a)
        if actions and actions[0].startswith("ERROR"):
            return 1
        return 0

    if args.remove_examples:
        actions = remove_all_examples(root, manifest)
        for a in actions:
            print(a)
        return 0

    if args.validate_init:
        report = validate_init(root, manifest)
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0 if report["ok"] else 1

    if not args.cli:
        print("ERROR: --cli is required (or pass --detect-stack / --prune / --list-orphans)", file=sys.stderr)
        return 1

    if args.cli not in RENDERERS:
        print(f"ERROR: no prebuilt renderer for CLI '{args.cli}'", file=sys.stderr)
        print(f"       Available: {', '.join(RENDERERS.keys())}", file=sys.stderr)
        print(f"       For unknown CLIs, read {root}/.agents/BOOTSTRAP.md", file=sys.stderr)
        return 1

    ctx = build_context(root, manifest, stack)
    if stack:
        print(f"Detected stack: {', '.join(r.get('label','?') for r in stack)}")
    if not args.check:
        scaffolded = auto_scaffold_all(root, manifest)
        if scaffolded:
            print(f"Auto-scaffolded missing role files: {', '.join(scaffolded)}")
        print(f"Rendering adapter for: {args.cli}")
    ok = RENDERERS[args.cli](root, manifest, ctx, args.check)
    if not ok:
        if args.check:
            print("DRIFT detected — run ./.agents/bootstrap.sh <cli> to regenerate")
        return 1
    if not args.check:
        pruned = prune_orphans(root, manifest)
        if pruned:
            print(f"Pruned orphaned canonical subagents: {', '.join(pruned)}")
            print("  (These were removed from .agents/agentic.json and no longer active.)")
        print(f"Done. Restart your CLI to activate Harness SDD.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
