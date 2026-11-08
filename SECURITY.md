# Security Policy

## Supported Versions

Security fixes are delivered on the latest patch release. Users should install
the newest available VSIX rather than remain on an older patch.

| Version | Supported |
| ------- | --------- |
| 0.8.2   | ✅ |
| 0.8.1   | ❌ |
| < 0.8.1 | ❌ |

## Reporting a Vulnerability

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/marcmassa/harness-manager/security/advisories/new).
Do not open a public issue for an undisclosed vulnerability.

Include the affected Harness Dashboard version, VS Code version, operating
system, reproduction steps, potential impact, and any relevant logs with
credentials or personal information removed. Maintainers will triage reports as
soon as practical; this community-maintained project does not promise a fixed
response or remediation SLA.

## Dependency Security

The repository uses Dependabot for weekly npm and GitHub Actions updates.
GitHub Actions are pinned to full commit SHAs. Release audits distinguish the
production dependency tree from development-only tooling so that a clean
production result is not confused with a clean full-tree audit.

- [0.8.2 security snapshot](docs/security/0.8.2.md) — production audit,
  full development-tree audit, and the commits included in the release.
