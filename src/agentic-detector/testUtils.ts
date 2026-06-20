import type {
  AgenticProfile,
  SignalCategory,
  CLIInstall,
  SignalCategoryResult,
  SignalMatch,
  MethodologyInfo,
  MaturityInfo,
  PatternMatch,
  Suggestion,
} from './types.js';
import { classify } from './maturityClassifier.js';

export interface MakeProfileOptions {
  cliInstalls?: Partial<CLIInstall>[];
  activeCategories?: SignalCategory[];
  categoryCounts?: Partial<Record<SignalCategory, number>>;
  harnessPresent?: boolean;
  sddActive?: boolean;
}

const ALL_CATEGORIES: SignalCategory[] = [
  'prompts',
  'rules',
  'mcp',
  'agent-methodologies',
  'tools',
  'skills',
  'agent-scripts',
  'memory',
  'context-identity',
];

/**
 * Create a test AgenticProfile with controlled parameters.
 */
export function makeProfile(opts: MakeProfileOptions = {}): AgenticProfile {
  const cliInstalls: CLIInstall[] = (opts.cliInstalls ?? []).map((c, i) => ({
    cliId: c.cliId ?? `cli-${i}`,
    cliName: c.cliName ?? `CLI ${i}`,
    detectedBy: c.detectedBy ?? 'test-adapter',
    configFiles: c.configFiles ?? [],
    isActive: c.isActive ?? true,
    layer: 1 as const,
  }));

  const categories: SignalCategoryResult[] = ALL_CATEGORIES.map(cat => {
    const count = opts.categoryCounts?.[cat] ?? 0;
    const isActive = opts.activeCategories?.includes(cat) ?? count > 0;
    const matchCount = isActive ? count : 0;

    const matches: SignalMatch[] = [];
    for (let i = 0; i < matchCount; i++) {
      matches.push({
        filePath: `/test/${cat}/file-${i}.md`,
        category: cat,
        matchedPattern: `${cat}-${i}`,
        confidence: 'high',
        evidence: `test-evidence-${i}`,
        layer: 2,
      });
    }

    // If harnessPresent is true, inject a Harness match into agent-methodologies
    if (opts.harnessPresent && cat === 'agent-methodologies' && matches.length === 0) {
      matches.push({
        filePath: '/test/.agents/agentic.json',
        category: 'agent-methodologies',
        matchedPattern: 'harness-agentic-json',
        confidence: 'high',
        evidence: '.agents/agentic.json',
        layer: 2,
      });
    }

    return {
      category: cat,
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      matches,
      count: matches.length,
      truncated: false,
    };
  });

  const methodology: MethodologyInfo = {
    hasMethodology: opts.sddActive ?? false,
    methodologyName: opts.sddActive ? 'sdd' : null,
    methodologyVersion: opts.sddActive ? '1.0' : null,
    configFile: opts.sddActive ? 'feature_list.json' : null,
    isActive: opts.sddActive ?? false,
    layer: 3,
  };

  // Build the temporary profile to compute maturity
  const preProfile: AgenticProfile = {
    workspaceRoot: '/test',
    scanTimestamp: Date.now(),
    layers: {
      '1': { cliInstalls },
      '2': { categories },
      '3': { methodology },
    },
    maturity: { level: 'L0', label: '', description: '', color: '', nextLevel: null },
    patterns: [],
    suggestions: [],
    dismissedSuggestionIds: [],
    acknowledgedNodeIds: [],
  };
  const maturity = classify(preProfile);

  return {
    workspaceRoot: '/test',
    scanTimestamp: Date.now(),
    layers: {
      '1': { cliInstalls },
      '2': { categories },
      '3': { methodology },
    },
    maturity,
    patterns: [],
    suggestions: [],
    dismissedSuggestionIds: [],
    acknowledgedNodeIds: [],
  };
}
