# Staged-file token limit

Install this repository's pre-commit hook after cloning:

```sh
git config --local core.hooksPath .githooks
```

Requires Python 3 and Git. If your project already uses another hooks manager,
invoke this executable from its pre-commit hook instead of replacing its setup.
Run manually with `.githooks/pre-commit`.

The hook checks added, copied, modified, and renamed files in the Git index.
It reads staged blobs, not working-tree files. Deleted and untracked files are
not checked. Exactly 20,000 bytes is allowed; anything larger exceeds 5,000
tokens under the requested bytes / 4 estimate, including whitespace and UTF-8.
Existing oversized files are checked when staged, not scanned repository-wide.

Git cannot reliably identify whether a human or an agent authored a file. This
policy therefore checks all authored text and excludes non-authored artifacts:

- Common package lockfiles and files ending in `.lock`.
- Common generated protobuf files, minified JS/CSS, and JS/CSS source maps.
- Files with recognizable generated headers in their first 8 KiB.
- Binary assets containing a NUL byte.
- Paths with staged Git attributes `linguist-generated`, `generated`, or
  `token-limit-ignore` set to true (bare attribute, `true`, or `1`).

Declare other generated output explicitly in `.gitattributes`, for example:

```gitattributes
generated/** linguist-generated=true
api/client.ts generated=true
```

Stage `.gitattributes` with the generated files. Unstaged rules do not affect
the hook. Never exempt handwritten files merely to avoid splitting them.

When blocked, split code into modules by responsibility and update imports;
split documentation into topic pages linked from an index; split tests by
feature with shared fixtures. Keep every resulting authored file at or below
20,000 bytes, run relevant checks, stage the new files, inspect
`git diff --cached`, and retry. The error message repeats these steps.

A local Git hook is a developer guardrail and can be bypassed with Git options;
it is not an authorization boundary. Run `tests/test_token_limit.sh` to verify
its behavior independently of the currently staged files.

## CI revision mode

The same executable supports immutable revision checks:

```sh
python3 .githooks/pre-commit --base BASE --candidate HEAD
python3 .githooks/pre-commit --direct --base BEFORE --candidate AFTER
python3 .githooks/pre-commit --initial --candidate HEAD
```

The first form uses merge-base (pull requests); `--direct` compares push
before/after. Use `--initial` only for an initial push with no base; it checks
the full candidate tree. Both blobs and attributes come from the candidate,
regardless of the current checkout. Missing/invalid revisions fail explicitly.
Ordinary hook invocation without arguments still checks only staged files.
