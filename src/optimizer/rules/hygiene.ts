// FEAT-034 — Component Optimizer — hygiene rule pack (design.md §D, R27–R29)
// OPT-H01 .. OPT-H03
//
// R28 is a real-risk requirement: the finding for a credential-shaped match
// must NEVER reproduce the matched secret in `title` or `detail` — only the
// pattern name and the line number. See the hygiene.test.ts assertion that
// scans every finding string for the matched substring.

import type { OptimizerFinding, OptimizerRule, RuleContext } from '../types.js';
import { lineOfIndex } from './ruleUtils.js';

function finding(
    ruleId: string,
    ctx: RuleContext,
    partial: Omit<OptimizerFinding, 'ruleId' | 'nodeId' | 'nodeType' | 'filePath'>,
): OptimizerFinding {
    return {
        ruleId,
        nodeId: ctx.source.nodeId,
        nodeType: ctx.source.nodeType,
        filePath: ctx.source.filePath,
        ...partial,
    };
}

const ALL_OPTIMIZABLE = ['agent', 'subagent', 'skill', 'steering', 'hook'] as const;

// ─── OPT-H01 — absolute paths and machine-specific values (R27) ───────────

const ABS_PATH_RE = /(^|\s)((?:\/Users\/|\/home\/|[A-Z]:\\)[^\s"'()<>\]]*)/gm;

function findWorkspaceRelative(absPath: string, existingPaths: Set<string>): string | undefined {
    const normalized = absPath.replace(/\\/g, '/');
    for (const rel of existingPaths) {
        if (normalized === rel || normalized.endsWith(`/${rel}`)) return rel;
    }
    return undefined;
}

export const optH01: OptimizerRule = {
    id: 'OPT-H01',
    appliesTo: ALL_OPTIMIZABLE,
    dimension: 'hygiene',
    defaultSeverity: 'warning',
    /** An absolute machine path is present or absent. */
    confidence: 'fact',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source, existingPaths } = ctx;
        if (!source.exists || !source.body) return [];

        const findings: OptimizerFinding[] = [];
        let m: RegExpExecArray | null;
        ABS_PATH_RE.lastIndex = 0;
        while ((m = ABS_PATH_RE.exec(source.body)) !== null) {
            const matchedPath = m[2];
            const offset = m.index + m[1].length;
            const line = lineOfIndex(source.body, offset);
            const relative = findWorkspaceRelative(matchedPath, existingPaths);

            findings.push(
                finding('OPT-H01', ctx, {
                    severity: 'warning',
                    dimension: 'hygiene',
                    title: 'Absolute, machine-specific path',
                    detail: `An absolute filesystem path was found on line ${line}: "${matchedPath}".`,
                    line,
                    fix: relative
                        ? {
                            type: 'relativize-path',
                            label: 'Relativize path',
                            payload: { line: String(line), absolutePath: matchedPath, relativePath: relative },
                        }
                        : undefined,
                }),
            );
        }
        return findings;
    },
};

// ─── OPT-H02 — credential-shaped strings (R28) ─────────────────────────────

const CREDENTIAL_PATTERNS: readonly { name: string; re: RegExp }[] = [
    { name: 'OpenAI-style secret key (sk-...)', re: /sk-[A-Za-z0-9]{16,}/g },
    { name: 'GitHub personal access token (ghp_...)', re: /ghp_[A-Za-z0-9]{20,}/g },
    { name: 'AWS access key ID (AKIA...)', re: /AKIA[0-9A-Z]{16}/g },
    { name: 'PEM private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
];

export const optH02: OptimizerRule = {
    id: 'OPT-H02',
    appliesTo: ALL_OPTIMIZABLE,
    dimension: 'hygiene',
    defaultSeverity: 'error',
    /** A documented credential prefix matches or it does not. */
    confidence: 'fact',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source } = ctx;
        if (!source.exists || !source.body) return [];

        const findings: OptimizerFinding[] = [];
        for (const pattern of CREDENTIAL_PATTERNS) {
            pattern.re.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = pattern.re.exec(source.body)) !== null) {
                const line = lineOfIndex(source.body, m.index);
                // R28: detail/title report ONLY the pattern name and line number —
                // the matched secret itself (m[0]) is never included anywhere below.
                findings.push(
                    finding('OPT-H02', ctx, {
                        severity: 'error',
                        dimension: 'hygiene',
                        title: `Credential-shaped string detected (${pattern.name})`,
                        detail: `A string matching the "${pattern.name}" pattern was found on line ${line}. The matched value is intentionally not reproduced here.`,
                        line,
                    }),
                );
                if (pattern.re.lastIndex === m.index) pattern.re.lastIndex += 1; // guard zero-length matches
            }
        }
        return findings;
    },
};

// ─── OPT-H03 — vague-quantifier density (R29) ──────────────────────────────

const VAGUE_QUANTIFIERS: readonly string[] = [
    'appropriate', 'as needed', 'if necessary', 'some', 'various', 'etc.', 'and so on',
];

const DENSITY_TOKEN_WINDOW = 150;

function buildPhraseRegex(phrase: string): RegExp {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefix = /^\w/.test(phrase) ? '\\b' : '';
    const suffix = /\w$/.test(phrase) ? '\\b' : '';
    return new RegExp(`${prefix}${escaped}${suffix}`, 'gi');
}

function countVagueQuantifiers(body: string): number {
    let total = 0;
    for (const phrase of VAGUE_QUANTIFIERS) {
        const matches = body.match(buildPhraseRegex(phrase));
        total += matches ? matches.length : 0;
    }
    return total;
}

export const optH03: OptimizerRule = {
    id: 'OPT-H03',
    appliesTo: ALL_OPTIMIZABLE,
    dimension: 'clarity',
    defaultSeverity: 'info',
    /** The 1-per-150-tokens density is an invented constant. */
    confidence: 'opinion',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source } = ctx;
        if (!source.exists || !source.body || source.tokenEstimate <= 0) return [];

        const count = countVagueQuantifiers(source.body);
        if (count === 0) return [];

        // R29: exactly one aggregate finding, never one per occurrence.
        // "exceeds one occurrence per 150 estimated tokens" ⇔ count * 150 > tokenEstimate.
        const exceedsDensity = count * DENSITY_TOKEN_WINDOW > source.tokenEstimate;
        if (!exceedsDensity) return [];

        const per150 = Math.round((count / (source.tokenEstimate / DENSITY_TOKEN_WINDOW)) * 100) / 100;

        return [
            finding('OPT-H03', ctx, {
                severity: 'info',
                dimension: 'clarity',
                title: 'High density of vague quantifiers',
                detail: `${count} vague-quantifier occurrences across an estimated ${source.tokenEstimate} tokens (${per150} per ${DENSITY_TOKEN_WINDOW} tokens) — consider being more specific.`,
            }),
        ];
    },
};

export const HYGIENE_RULES: readonly OptimizerRule[] = [optH01, optH02, optH03];
