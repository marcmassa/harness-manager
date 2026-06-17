#!/usr/bin/env python3
"""
dry_check.py — DRY anti-duplication checks for a TypeScript file.

Implements the rules from hooks/code-quality-checks.json#dry:
  - R8  dry-repeated-string     same string literal (>=12 chars) 3+ times
  - R9  dry-magic-number        magic number (not 0/1/-1/2) 3+ times
  - R10 dry-duplicate-function  two functions with Jaccard >= 0.85
  - R11 dry-duplicate-type      duplicate interface/type definition

Reads a file path from argv[1], prints a single JSON report on stdout.

Exit codes:
  0  success
  64 EX_USAGE  no file path
  66 EX_NOINPUT  file does not exist
"""
import json
import os
import re
import sys
from collections import Counter, defaultdict
from typing import Dict, List, Tuple

# R8: minimum length of a string literal to be considered for repetition
STRING_MIN_LEN = 12
STRING_MIN_COUNT = 3
# R9: numbers that are NOT magic
SAFE_NUMBERS = {0, 1, -1, 2}
NUMBER_MIN_COUNT = 3
# R10: minimum tokens to consider two functions for similarity
FUNCTION_MIN_TOKENS = 30
FUNCTION_JACCARD = 0.85
# R11: minimum body length to consider a type definition
TYPE_MIN_LEN = 20


def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# ----- R8: repeated string literals -----

# Match both single- and double-quoted strings, plus template literals.
# For templates, we only count the static parts (no ${...}) for the simple case.
STRING_LITERAL_RE = re.compile(
    r"""
    (?P<q>["'`])(?P<content>[^\\"'`\n]*?)(?P=q)  # simple, non-escaped, single-line
    """,
    re.VERBOSE,
)


def find_repeated_strings(text: str) -> List[Dict]:
    counter: Counter = Counter()
    line_map: Dict[str, List[int]] = defaultdict(list)
    for m in STRING_LITERAL_RE.finditer(text):
        content = m.group("content")
        if len(content) < STRING_MIN_LEN:
            continue
        # Skip import-like strings and obvious paths/URLs handled per-rule
        counter[content] += 1
        line_map[content].append(text[: m.start()].count("\n") + 1)

    issues = []
    for s, count in counter.most_common():
        if count < STRING_MIN_COUNT:
            continue
        # Skip noise: full-line imports, single-character semicolons, etc.
        if s.startswith(".") and "/" in s:
            # import path — skip
            continue
        if s.startswith("http://") or s.startswith("https://"):
            # URLs — skip
            continue
        line = line_map[s][0]
        preview = s if len(s) <= 40 else s[:37] + "..."
        issues.append({
            "id": "dry-repeated-string",
            "severity": "warning",
            "line": line,
            "message": f"String '{preview}' appears {count} times (lines {line_map[s]})",
        })
    return issues


# ----- R9: magic numbers -----

# Match numeric literals (decimal, hex, scientific). We skip:
#   - 0, 1, -1, 2 (safe)
#   - decimals like 0.5, 1.0, etc., where both integer parts are 0 or 1
#   - 0x-prefixed that decode to a safe number
NUMBER_RE = re.compile(
    r"""
    (?<![A-Za-z_$0-9.])            # not part of an identifier or larger number
    (?P<num>
        0[xX][0-9A-Fa-f]+          # hex
        |
        \d+\.\d+(?:[eE][+-]?\d+)?  # float
        |
        \d+(?:[eE][+-]?\d+)?       # int
    )
    (?![A-Za-z_$0-9.])             # not part of an identifier or larger number
    """,
    re.VERBOSE,
)


def _is_safe(n: float) -> bool:
    return int(n) in SAFE_NUMBERS


def find_magic_numbers(text: str) -> List[Dict]:
    counter: Counter = Counter()
    line_map: Dict[float, List[int]] = defaultdict(list)
    for m in NUMBER_RE.finditer(text):
        raw = m.group("num")
        try:
            if raw.lower().startswith("0x"):
                value = int(raw, 16)
            else:
                value = float(raw) if "." in raw or "e" in raw.lower() else int(raw)
        except ValueError:
            continue
        if _is_safe(value):
            continue
        counter[value] += 1
        line_map[value].append(text[: m.start()].count("\n") + 1)

    issues = []
    for n, count in counter.most_common():
        if count < NUMBER_MIN_COUNT:
            continue
        line = line_map[n][0]
        issues.append({
            "id": "dry-magic-number",
            "severity": "warning",
            "line": line,
            "message": f"Magic number {n} appears {count} times (lines {line_map[n]}); extract a named constant",
        })
    return issues


# ----- R10: duplicate functions (Jaccard on tokenised body) -----

FUNC_HEADER_RE = re.compile(
    r"^(?P<indent>\s*)"
    r"(?P<header>"
    r"(?:export\s+)?(?:async\s+)?function\s*\**\s*(?P<name1>[A-Za-z_$][\w$]*)"
    r"|(?:const|let|var)\s+(?P<name2>[A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>"
    r"|(?:public|private|protected|static|readonly|async|\s)*\s*(?P<name3>[A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{"
    r")",
    re.MULTILINE,
)

NON_FUNCTION_KEYWORDS = {
    "if", "for", "while", "switch", "do", "return", "throw", "try",
    "catch", "finally", "else", "case", "default", "break", "continue",
    "new", "typeof", "instanceof", "in", "of", "void", "delete", "yield",
    "await", "class", "interface", "type", "enum", "namespace", "module",
    "declare", "import", "export", "from", "as", "with",
}


def find_functions(text: str) -> List[Dict]:
    out: List[Dict] = []
    seen = set()
    for m in FUNC_HEADER_RE.finditer(text):
        header = m.group("header")
        first_id_match = re.match(r"\s*(?:\w+\s+)*([A-Za-z_$][\w$]*)", header)
        if first_id_match and first_id_match.group(1) in NON_FUNCTION_KEYWORDS:
            if not re.match(r"\s*(?:export\s+)?(?:async\s+)?function\b", header):
                continue

        header_line = text[: m.start()].count("\n") + 1
        name = m.group("name1") or m.group("name2") or m.group("name3")
        if not name:
            continue
        key = (name, header_line)
        if key in seen:
            continue
        seen.add(key)
        brace_pos = text.find("{", m.end())
        if brace_pos == -1:
            continue
        depth = 0
        i = brace_pos
        while i < len(text):
            c = text[i]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    break
            i += 1
        if depth != 0:
            continue
        body = text[brace_pos : i + 1]
        out.append({
            "name": name,
            "header_line": header_line,
            "body": body,
        })
    return out


# Tokenise a body: identifiers, numbers, strings, and operators as distinct tokens.
# Skip whitespace and punctuation; the structure of the function is what matters
# for similarity.
TOKEN_RE = re.compile(
    r"[A-Za-z_$][\w$]*"          # identifier / keyword
    r"|0[xX][0-9A-Fa-f]+"        # hex
    r"|\d+\.\d+|\d+"             # number
    r"|\"[^\"\\]*(?:\\.[^\"\\]*)*\""  # string
    r"|'[^'\\]*(?:\\.[^'\\]*)*'"  # string
)


def tokenise(body: str) -> List[str]:
    return TOKEN_RE.findall(body)


def jaccard(a: List[str], b: List[str]) -> float:
    sa, sb = set(a), set(b)
    if not sa or not sb:
        return 0.0
    inter = len(sa & sb)
    union = len(sa | sb)
    return inter / union if union else 0.0


def find_duplicate_functions(text: str) -> List[Dict]:
    funcs = find_functions(text)
    tokens = [(f, tokenise(f["body"])) for f in funcs]
    issues = []
    seen_pairs = set()
    for i in range(len(tokens)):
        for j in range(i + 1, len(tokens)):
            fi, ti = tokens[i]
            fj, tj = tokens[j]
            if len(ti) < FUNCTION_MIN_TOKENS or len(tj) < FUNCTION_MIN_TOKENS:
                continue
            sim = jaccard(ti, tj)
            if sim >= FUNCTION_JACCARD:
                pair_key = (fi["name"], fj["name"])
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)
                issues.append({
                    "id": "dry-duplicate-function",
                    "severity": "warning",
                    "line": fi["header_line"],
                    "message": f"Function '{fi['name']}' is {sim:.0%} similar to '{fj['name']}' (Jaccard); consider extracting",
                })
    return issues


# ----- R11: duplicate type/interface definitions -----

# Match an interface or type alias. We capture the full body, normalise it,
# and compare for equality.
#
# Two cases:
#  - `interface Name { ... }` — balanced braces, end when the matching `}`
#    is at indent 0 (top-level close).
#  - `type Name = ...;` — single statement ending with `;`.
TYPE_DEF_RE = re.compile(
    r"^(?P<indent>\s*)"
    r"(?:export\s+)?"
    r"(?P<kind>interface|type)\s+"
    r"(?P<name>[A-Za-z_$][\w$]*)"
    r"(?:\s*<[^>]+>)?"           # generics
    r"\s*(?P<open>\{|=)"         # `{` for interface, `=` for type alias
    ,
    re.MULTILINE,
)


def _extract_body(text: str, start: int, open_char: str) -> Tuple[str, int] | None:
    """Given a position just after the `{` or `=`, return (body, end_pos).

    For interfaces, the opening `{` was consumed by the regex, so we
    start at depth 1. For type aliases, we start at depth 0 and look
    for the first top-level `;`.
    """
    if open_char == "{":
        depth = 1
        i = start
        while i < len(text):
            c = text[i]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return text[start : i], i
            i += 1
        return None
    depth = 0
    i = start
    while i < len(text):
        c = text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        elif c == ";" and depth == 0:
            return text[start : i], i
        i += 1
    return None


def _normalise(body: str) -> str:
    """Strip whitespace, comments, and structural noise for shape comparison.

    We compare property lists, not syntax. So we:
    - remove comments
    - drop braces and semicolons/commas used as separators
    - drop `?` and `!` (TS optional/readonly markers)
    - drop generic angle brackets
    - collapse all whitespace
    - normalise the field list to a single `|`-separated string
    """
    # Remove // line comments
    body = re.sub(r"//[^\n]*", "", body)
    # Remove /* ... */ block comments
    body = re.sub(r"/\*.*?\*/", "", body, flags=re.DOTALL)
    # Drop generics <...>
    body = re.sub(r"<[^>]+>", "", body)
    # Drop optional/readonly markers
    body = re.sub(r"[?!]", "", body)
    # Drop braces (we don't care about the wrapping)
    body = body.replace("{", "").replace("}", "")
    # Normalise separators: `,` and `;` both become `|`
    body = re.sub(r"[,;]", "|", body)
    # Drop the trailing `|` if present
    body = body.rstrip("|")
    # Collapse whitespace
    body = re.sub(r"\s+", "", body)
    # Sort fields so `a,b` == `b,a`
    return "|".join(sorted(body.split("|")))


def find_duplicate_types(text: str) -> List[Dict]:
    matches = list(TYPE_DEF_RE.finditer(text))
    by_shape: Dict[str, List[Tuple[str, int, str]]] = defaultdict(list)
    for m in matches:
        kind = m.group("kind")
        name = m.group("name")
        open_char = m.group("open")
        body_start = m.end()
        extracted = _extract_body(text, body_start, open_char)
        if extracted is None:
            continue
        body, _ = extracted
        if len(body) < TYPE_MIN_LEN:
            continue
        # Normalise the body only — the kind prefix (interface/type)
        # doesn't change the structural shape.
        shape = _normalise(body)
        line = text[: m.start()].count("\n") + 1
        by_shape[shape].append((name, line, kind))

    issues = []
    for shape, entries in by_shape.items():
        if len(entries) < 2:
            continue
        first_name, first_line, first_kind = entries[0]
        names = ", ".join(f"'{n}' (line {l})" for n, l, _ in entries)
        issues.append({
            "id": "dry-duplicate-type",
            "severity": "warning",
            "line": first_line,
            "message": f"Duplicate {first_kind} definition: {names}",
        })
    return issues


# ----- Main -----

def main(argv: List[str]) -> int:
    if len(argv) < 2:
        print("ERROR: usage: dry_check.py <file>", file=sys.stderr)
        return 64
    path = argv[1]
    if not os.path.isfile(path):
        print(f"ERROR: file not found: {path}", file=sys.stderr)
        return 66

    text = read_file(path)
    issues: List[Dict] = []
    issues.extend(find_repeated_strings(text))
    issues.extend(find_magic_numbers(text))
    issues.extend(find_duplicate_functions(text))
    issues.extend(find_duplicate_types(text))

    report = {
        "hook": "harness-dry",
        "file": path,
        "issues": issues,
    }
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
