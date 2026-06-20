/**
 * Harness+SDD scaffold generator.
 *
 * Generates the minimal `.agents/agentic.json` and `feature_list.json`
 * files needed to bootstrap a Harness SDD workspace from scratch.
 *
 * Used by the "Apply Harness+SDD" action in the Advisory panel (T34).
 */

// ─── agentic.json template ────────────────────────────────────────────────────

const AGENTIC_JSON_TEMPLATE = {
  $schema:
    'https://raw.githubusercontent.com/marcmassaco/harness-manager/main/agentic.schema.json',
  version: '1.0.0',
  project: {
    name: null,
    description: null,
  },
  cli: {},
  subagents: [
    {
      name: 'harness',
      description:
        'Default orchestrator. Reads feature_list.json and routes work.',
      default: true,
      applies_when: null,
      role_file: '.agents/subagents/harness/SUBAGENT.md',
      permission: { groups: ['read', 'write', 'execute'] },
    },
    {
      name: 'spec-author',
      description:
        'Produces specs in EARS notation. Never writes production code.',
      default: true,
      applies_when: null,
      role_file: '.agents/subagents/spec-author/SUBAGENT.md',
      permission: { groups: ['read', 'write'] },
    },
    {
      name: 'implementer',
      description:
        'Executes tasks.md sequentially on the active feature.',
      default: false,
      applies_when: {
        file_glob: ['src/**/*.ts', 'src/**/*.tsx'],
      },
      role_file: '.agents/subagents/implementer/SUBAGENT.md',
      permission: { groups: ['read', 'write', 'execute'] },
    },
    {
      name: 'reviewer',
      description:
        'Verifies R<n>↔test traceability and runs checks.',
      default: false,
      applies_when: {
        file_glob: ['src/**/*.test.ts'],
      },
      role_file: '.agents/subagents/reviewer/SUBAGENT.md',
      permission: { groups: ['read'] },
    },
  ],
  commands: {
    status: '.agents/commands/status.md',
    spec: '.agents/commands/spec.md',
    approve: '.agents/commands/approve.md',
  },
  hooks: [],
  steering: [],
};

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Generate the content for `.agents/agentic.json`.
 *
 * @param detectedCLI  Optional CLI id (e.g. `"claude-code"`, `"opencode"`).
 *                     When present, sets `cli.primary` in the scaffold.
 * @returns            Pretty-printed JSON string.
 */
export function scaffoldAgenticJson(detectedCLI: string | null): string {
  // Deep clone to avoid mutating the template on repeated calls.
  const config: Record<string, unknown> = JSON.parse(
    JSON.stringify(AGENTIC_JSON_TEMPLATE),
  );

  if (detectedCLI) {
    config.cli = { primary: detectedCLI };
  }

  return JSON.stringify(config, null, 2);
}

/**
 * Generate the content for a minimal `feature_list.json`.
 * The array is empty — the user adds features via the SDD workflow.
 */
export function scaffoldFeatureListJson(): string {
  return JSON.stringify(
    {
      $schema: null,
      features: [],
    },
    null,
    2,
  );
}
