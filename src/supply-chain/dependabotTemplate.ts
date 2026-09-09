// FEAT-036 T10 — the vetted Dependabot scaffold (SC-01 payload). (R4)
//
// Exactly the YAML documented in design.md §"Dependabot template":
// npm + github-actions, weekly, grouped minor/patch. Production AND
// development dependencies are both covered by Dependabot's default
// (no `open-pull-requests-limit: 0` anywhere).

export const DEPENDABOT_TEMPLATE_REL_PATH = '.github/dependabot.yml';

export const DEPENDABOT_TEMPLATE = `version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
    groups:
      minor-patch:
        patterns: ["*"]
        update-types: ["minor", "patch"]
  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
    groups:
      minor-patch:
        patterns: ["*"]
        update-types: ["minor", "patch"]
`;
