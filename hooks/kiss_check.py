#!/usr/bin/env python3
"""
kiss_check.py — KISS anti-overengineering checks for a TypeScript file.

Implements the rules from hooks/code-quality-checks.json#kiss:
  - R3  kiss-long-file       file > 400 lines
  - R4  kiss-long-function   function body > 80 lines
  - R5  kiss-deep-nesting    nesting > 4 levels in a function body
  - R6  kiss-unused-param    parameter not used in body, no `_` prefix
  - R7  kiss-swallow-error   3+ try/catch with empty / rethrow-only catch

Reads a file path from argv[1], prints a single JSON report on stdout.

Exit codes:
  0  success (issues do not cause non-zero exit)
  64 EX_USAGE  no file path provided
  66 EX_NOINPUT  file does not exist
"""
import json
import os
import re
import sys
from typing import List, Dict, Tuple

# R3: file length threshold
LONG_FILE_LINES = 400
# R4: function body length threshold
LONG_FUNCTION_LINES = 80
# R5: max nesting depth (indent levels, 1 level == 1 unit)
MAX_NESTING = 4
# R6: param prefix that exempts a parameter from the unused check
UNUSED_PARAM_IGNORE_PREFIX = "_"
# R7: number of swallow-style catch blocks that triggers the warning
SWALLOW_THRESHOLD = 3


def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def line_count(text: str) -> int:
    return len(text.splitlines())


# ----- Function detection (R4, R5, R6) -----

# Match three flavours of TS function declarations:
#   function name(...) { ... }
#   const name = (...) => { ... }
#   const name = function (...) { ... }
#   name(...) { ... }   (class method)
# Captures the header line; the body is found by brace matching from there.
#
# IMPORTANT: a line whose first non-whitespace token is a TS keyword
# (if, for, while, switch, return, etc.) is NOT a function declaration.
# We enforce this with a negative lookbehind that rejects any of those
# keywords at the start of the matched text.
FUNC_HEADER_RE = re.compile(
    r"^(?P<indent>\s*)"
    r"(?P<header>"
    r"(?:export\s+)?(?:async\s+)?function\s*\**\s*(?P<name1>[A-Za-z_$][\w$]*)"
    r"|(?:const|let|var)\s+(?P<name2>[A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>"
    r"|(?:public|private|protected|static|readonly|async|\s)*\s*(?P<name3>[A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{"
    r")",
    re.MULTILINE,
)

# Keywords that look like a function but are control flow — reject these.
NON_FUNCTION_KEYWORDS = {
    "if", "for", "while", "switch", "do", "return", "throw", "try",
    "catch", "finally", "else", "case", "default", "break", "continue",
    "new", "typeof", "instanceof", "in", "of", "void", "delete", "yield",
    "await", "class", "interface", "type", "enum", "namespace", "module",
    "declare", "import", "export", "from", "as", "with",
}


def find_functions(text: str) -> List[Dict]:
    """Return a list of {name, header_line, body_start, body_end, body, params}."""
    out: List[Dict] = []
    seen = set()
    for m in FUNC_HEADER_RE.finditer(text):
        # Reject if the first identifier in the match is a TS keyword.
        # E.g. "if (...) {" must not match the class-method alternative.
        header = m.group("header")
        first_id_match = re.match(r"\s*(?:\w+\s+)*([A-Za-z_$][\w$]*)", header)
        if first_id_match and first_id_match.group(1) in NON_FUNCTION_KEYWORDS:
            # The exception is `function name(...)` — its first token is
            # the keyword "function", which is allowed.
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

        body_start_line = text[: brace_pos + 1].count("\n") + 1
        body_end_line = text[: i + 1].count("\n") + 1
        body = "\n".join(text.splitlines()[body_start_line - 1 : body_end_line])

        # Build a header text that INCLUDES the parameter list, even if the
        # regex's name1 alternative stopped before the parens.
        header_text = text[m.start() : brace_pos]
        params = extract_params(header_text)

        out.append({
            "name": name,
            "header_line": header_line,
            "body_start": body_start_line,
            "body_end": body_end_line,
            "body": body,
            "params": params,
        })
    return out


def extract_params(header_text: str) -> List[str]:
    """Extract parameter names from a function header substring.

    Handles:  function f(a, b: T, c = 1)  and  (a, b) =>  and  (a, b) {
    Skips destructuring patterns and type-only params.
    """
    # Find the first `(` after the function name
    open_paren = header_text.find("(")
    if open_paren == -1:
        return []
    close_paren = header_text.find(")", open_paren)
    if close_paren == -1:
        return []
    inside = header_text[open_paren + 1 : close_paren]
    names: List[str] = []
    for part in inside.split(","):
        part = part.strip()
        if not part:
            continue
        # Drop default value `=` onwards
        part = part.split("=", 1)[0].strip()
        # Drop type annotation `:` onwards
        part = part.split(":", 1)[0].strip()
        # Drop modifiers like `public`, `private`, `readonly`
        tokens = part.split()
        if not tokens:
            continue
        ident = tokens[-1]
        # Skip destructuring like { a, b } or [ a, b ] or `...rest`
        if ident in ("{", "[", "..."):
            continue
        if re.match(r"^[A-Za-z_$][\w$]*$", ident):
            names.append(ident)
    return names


def max_nesting_in_body(body: str, base_indent: int) -> int:
    """Return the maximum nesting depth inside a function body.

    Depth is measured in leading-whitespace units relative to the
    function's first non-empty line.
    """
    lines = body.splitlines()
    first_indent = None
    max_depth = 0
    for line in lines:
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip(" "))
        if first_indent is None:
            first_indent = indent
        # The base indent is the function body's own indent; subtract it
        rel = max(0, (indent - first_indent) // 2)  # 2 spaces per level
        max_depth = max(max_depth, rel)
    return max_depth


# ----- Swallowed exceptions (R7) -----

SWALLOW_RE = re.compile(
    r"catch\s*\([^)]*\)\s*\{[^}]*\}",
    re.DOTALL,
)
EMPTY_CATCH_RE = re.compile(
    r"catch\s*\([^)]*\)\s*\{\s*\}",
    re.DOTALL,
)
RETHROW_ONLY_RE = re.compile(
    r"catch\s*\([^)]*\)\s*\{\s*throw\s+[^;]+;?\s*\}",
    re.DOTALL,
)


def count_swallowed(text: str) -> Tuple[int, List[int]]:
    """Count swallowed catches and return their 1-indexed line numbers.

    A catch is "swallowed" if its body is empty OR rethrows the same
    exception without doing anything else.
    """
    lines = text.splitlines()
    count = 0
    line_nums: List[int] = []
    for m in SWALLOW_RE.finditer(text):
        body = m.group(0)
        if EMPTY_CATCH_RE.fullmatch(body) or RETHROW_ONLY_RE.fullmatch(body):
            count += 1
            line_nums.append(text[: m.start()].count("\n") + 1)
    return count, line_nums


# ----- Issue helpers -----

def issue(check_id: str, severity: str, line: int, message: str) -> Dict:
    return {
        "id": check_id,
        "severity": severity,
        "line": line,
        "message": message,
    }


# ----- Main -----

def main(argv: List[str]) -> int:
    if len(argv) < 2:
        print("ERROR: usage: kiss_check.py <file>", file=sys.stderr)
        return 64
    path = argv[1]
    if not os.path.isfile(path):
        print(f"ERROR: file not found: {path}", file=sys.stderr)
        return 66

    text = read_file(path)
    issues: List[Dict] = []

    # R3: long file
    n_lines = line_count(text)
    if n_lines > LONG_FILE_LINES:
        issues.append(issue(
            "kiss-long-file", "warning", 1,
            f"File is {n_lines} lines (limit {LONG_FILE_LINES})"
        ))

    # Find all functions once for R4 / R5 / R6
    funcs = find_functions(text)
    for fn in funcs:
        body_lines = fn["body_end"] - fn["body_start"] + 1

        # R4: long function
        if body_lines > LONG_FUNCTION_LINES:
            issues.append(issue(
                "kiss-long-function", "warning", fn["header_line"],
                f"Function '{fn['name']}' is {body_lines} lines (limit {LONG_FUNCTION_LINES})"
            ))

        # R5: deep nesting
        depth = max_nesting_in_body(fn["body"], base_indent=0)
        if depth > MAX_NESTING:
            issues.append(issue(
                "kiss-deep-nesting", "warning", fn["header_line"],
                f"Function '{fn['name']}' has nesting depth {depth} (limit {MAX_NESTING})"
            ))

        # R6: unused param
        for p in fn["params"]:
            if p.startswith(UNUSED_PARAM_IGNORE_PREFIX):
                continue
            # The param is "used" if its name appears in the body, but
            # we must skip the header line where the name is declared.
            body_for_search = "\n".join(text.splitlines()[fn["body_start"] : fn["body_end"] + 1])
            # word-boundary match
            if not re.search(rf"\b{re.escape(p)}\b", body_for_search):
                issues.append(issue(
                    "kiss-unused-param", "warning", fn["header_line"],
                    f"Function '{fn['name']}' has unused parameter '{p}'"
                ))

    # R7: swallowed exceptions (whole file)
    swallow_count, swallow_lines = count_swallowed(text)
    if swallow_count >= SWALLOW_THRESHOLD:
        issues.append(issue(
            "kiss-swallow-error", "warning", swallow_lines[0],
            f"{swallow_count} try/catch blocks with empty or rethrow-only catch bodies (limit {SWALLOW_THRESHOLD})"
        ))

    # Emit
    report = {
        "hook": "harness-kiss",
        "file": path,
        "issues": issues,
    }
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
