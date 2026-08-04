// FEAT-034 — Component Optimizer — core types (design.md §A, R1, R2, R6, R8, R9, R31)
//
// This module and everything under src/optimizer/ MUST NOT import 'vscode'.
// The only I/O in the whole module is the injected `readFile` callback in
// componentLoader.ts. Keeping these types free of vscode.* keeps every rule
// and the scorer/engine testable with plain fixtures.

/**
 * The six scoring dimensions. Each answers a different question, and each is
 * fed by at least two rules — an axis with no rules behind it would always read
 * 100 and make the radar's shape a lie.
 *
 * - `structure`   — the contract: does it parse, is it named right, are the
 *                   required parts present?
 * - `clarity`     — is the prose actionable by a model: does the description
 *                   state when to use it, is the wording specific?
 * - `budget`      — what does it cost to load?
 * - `integration` — how does it relate to the rest of the architecture?
 * - `hygiene`     — is it safe and portable: no machine paths, no secrets?
 * - `consistency` — does it look like the author's OTHER components?
 */
export type OptimizerDimension =
    | 'structure' | 'clarity' | 'budget' | 'integration' | 'hygiene' | 'consistency';
export type OptimizerSeverity = 'error' | 'warning' | 'info';
export type ScoreTier = 'A' | 'B' | 'C' | 'D' | 'F';

export type OptimizableType = 'agent' | 'subagent' | 'skill' | 'steering' | 'hook';

/**
 * What `_filePath` actually points at.
 *
 * `directory` exists because adapters may legitimately root a synthetic node at
 * a config directory (KiroAdapter does this for its workspace node, pointing at
 * `.kiro`). Collapsing that into `missing` made OPT-D01 — a `fact`-tier rule at
 * `error` severity — report "component missing on disk" about a directory that
 * was present and fully populated. A tier whose whole claim is verifiability
 * must not produce that.
 */
export type PathKind = 'file' | 'directory' | 'missing' | 'unresolved';

export interface ComponentSource {
    nodeId: string;
    nodeType: OptimizableType;
    label: string;
    filePath: string;          // '' when unresolved
    raw: string;
    frontmatter: Record<string, unknown>;
    body: string;
    /** True only for a readable file — see `pathKind` for why that is narrower. */
    exists: boolean;
    pathKind: PathKind;
    tokenEstimate: number;
}

export type QuickFixType =
    | 'set-frontmatter-field'
    | 'insert-frontmatter'
    | 'append-section-stubs'
    | 'extract-to-references'
    | 'relativize-path';

export interface QuickFix {
    type: QuickFixType;
    label: string;
    payload: Record<string, string>;
}

export interface OptimizerFinding {
    ruleId: string;            // OPT-<F><NN>
    nodeId: string;
    nodeType: OptimizableType;
    filePath: string;
    severity: OptimizerSeverity;
    dimension: OptimizerDimension;
    title: string;
    detail: string;
    line?: number;             // 1-based
    relatedNodeIds?: string[];
    fix?: QuickFix;
    /**
     * Epistemic tier of the rule that produced this finding, stamped by the
     * engine. Lets the UI say what kind of claim a finding is making without
     * consulting the registry, and lets FEAT-035 decide where AI assistance is
     * worth offering: `fact` findings have mechanical fixes, `heuristic` and
     * `opinion` ones need judgement.
     */
    confidence?: RuleConfidence;
}

/**
 * What kind of claim a rule makes. This is the epistemic tier from the FEAT-034
 * calibration audit, made structural rather than left as a comment.
 *
 * - `fact`      — verifiable against the filesystem or the graph. The file
 *                 exists or it does not; the prefix `ghp_` is present or it is
 *                 not. No judgement, no invented number.
 * - `heuristic` — the underlying mechanism is real and consequential, but the
 *                 detection is an approximation that will misfire.
 * - `opinion`   — the rule fires on a threshold nobody has validated. Useful as
 *                 a prompt to look, not as a verdict.
 *
 * `SEVERITY_CEILING` in scorer.ts caps what each tier may contribute, so an
 * unvalidated threshold can never outweigh a verifiable defect.
 */
export type RuleConfidence = 'fact' | 'heuristic' | 'opinion';

/** Per-node-type corpus statistics, used for relative (self-calibrating) thresholds. */
export interface CorpusStats {
    /** Median token estimate per node type across the scanned corpus. */
    medianTokensByType: Map<OptimizableType, number>;
    /** How many components of each type the median was computed from. */
    sampleSizeByType: Map<OptimizableType, number>;
    /**
     * Frontmatter keys used by a majority of same-typed components — the
     * author's de-facto convention, derived rather than prescribed.
     */
    commonFrontmatterKeysByType: Map<OptimizableType, string[]>;
    /** `##` headings used by a majority of same-typed components. */
    commonHeadingsByType: Map<OptimizableType, string[]>;
}

/** Everything a rule may read. Pure — no vscode, no fs. */
export interface RuleContext {
    source: ComponentSource;
    all: ComponentSource[];
    sourcesById: Map<string, ComponentSource>;
    edges: { source: string; target: string; label: string }[];
    nodeIds: Set<string>;
    existingPaths: Set<string>;   // normalized workspace-relative paths
    config: OptimizerConfig;
    corpus: CorpusStats;
}

export interface OptimizerRule {
    id: string;
    appliesTo: readonly OptimizableType[];
    dimension: OptimizerDimension;
    /** Documentation only — the actual severity lives on each finding. */
    defaultSeverity: OptimizerSeverity;
    /** Epistemic tier. Determines the severity ceiling applied by the scorer. */
    confidence: RuleConfidence;
    evaluate(ctx: RuleContext): OptimizerFinding[];
}

export interface ComponentScore {
    nodeId: string;
    nodeType: OptimizableType;
    label: string;
    score: number;                                  // 0–100
    tier: ScoreTier;
    dimensions: Record<OptimizerDimension, number>;
    tokenEstimate: number;
    findingCount: number;
}

export interface OptimizerReport {
    ok: boolean;
    error?: string;
    scanTimestamp: number;
    architectureScore: number;
    totalComponents: number;
    truncated: boolean;
    components: ComponentScore[];
    findings: OptimizerFinding[];
    dismissedCount: number;
    findingCounts: {
        bySeverity: Record<OptimizerSeverity, number>;
        byDimension: Record<OptimizerDimension, number>;
    };
}

export interface OptimizerConfig {
    enabled: boolean;
    tokenBudget: { skill: number; subagent: number; agent: number; steering: number; agentRollup: number };
    /** Multiple of the per-type corpus median above which OPT-B01/B02 fire. */
    budgetMedianMultiple: number;
    overlapThreshold: number;
    disabledRules: string[];
    /** FEAT-035 — assisted (AI / delegated) fixes. */
    assistedFixes: { enabled: boolean; mode: 'both' | 'ai-only' | 'delegate-only' };
}

/**
 * Convenience default used by tests and by any caller that has not yet read the
 * real `harness-dashboard.optimizer.*` settings.
 *
 * CALIBRATION NOTE. The `tokenBudget` values below are only a FALLBACK, used
 * when a workspace has fewer than `MIN_SAMPLE_FOR_RELATIVE` components of a
 * type. Once the corpus is large enough, OPT-B01/B02 judge against
 * `budgetMedianMultiple × the workspace median` instead — see corpusStats.ts.
 *
 * The original fallbacks (skill 500, subagent 1500) were invented while writing
 * the spec and were never validated. Measured against the five real skills in
 * this repository — 472, 719, 939, 1093 and 1991 estimated tokens, median 939 —
 * the 500 figure flagged four of five. These fallbacks are set above that
 * observed median so a small corpus is not reported wholesale. They remain
 * approximations, which is exactly why every rule that uses them is tagged
 * `confidence: 'opinion'` and capped at `info`.
 */
export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = {
    enabled: true,
    tokenBudget: { skill: 1500, subagent: 2500, agent: 3000, steering: 1500, agentRollup: 12000 },
    budgetMedianMultiple: 2.5,
    overlapThreshold: 0.8,
    disabledRules: [],
    assistedFixes: { enabled: true, mode: 'both' },
};
