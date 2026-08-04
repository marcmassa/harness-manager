// FEAT-034 — Component Optimizer — drift rule pack (design.md §D, R25, R26)
// OPT-D01, OPT-D02

import type { OptimizerFinding, OptimizerRule, RuleContext } from '../types.js';
import { lineOfIndex, normalizeRelativePath, resolveRelativeLink } from './ruleUtils.js';

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

// ─── OPT-D01 — manifest / filesystem drift (R25) ───────────────────────────
//
// DEVIATION from design.md's framework-aware clause: R25's second condition
// ("two components ... share a frontmatter.name across different
// frameworks") needs a per-component "which framework produced this" tag.
// ComponentSource, as specified exactly in design.md §A, carries no such
// field (only NodeMetadata's FrameworkFields carry `_framework`, and that is
// deliberately not part of ComponentSource). This rule instead flags any two
// distinct components of the same NodeType sharing a non-empty
// frontmatter.name, regardless of framework — a strict superset of R25's
// literal scope, and the only reading possible without widening
// ComponentSource beyond the approved shape.

export const optD01: OptimizerRule = {
    id: 'OPT-D01',
    appliesTo: ['agent', 'subagent', 'skill', 'steering', 'hook'],
    dimension: 'integration',
    defaultSeverity: 'error',
    /** A declared file is present on disk or absent. */
    confidence: 'fact',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source, all } = ctx;
        const findings: OptimizerFinding[] = [];

        // Only a genuinely absent path is drift. A component rooted at a
        // directory (adapters do this for synthetic workspace nodes) has no file
        // to be missing, and a node with no declared path was never claiming one.
        // Reporting either as "missing on disk" is a false positive — and this is
        // a `fact`-tier rule at `error` severity, the one place that must not
        // happen. Found in smoke testing against a populated `.kiro/`.
        if (source.pathKind === 'missing') {
            findings.push(
                finding('OPT-D01', ctx, {
                    severity: 'error',
                    dimension: 'integration',
                    title: 'Component missing on disk',
                    detail: `Node "${source.nodeId}" is declared in the graph but its file ("${source.filePath || 'no path recorded'}") does not exist on disk.`,
                }),
            );
        }

        const name = source.exists && typeof source.frontmatter.name === 'string'
            ? (source.frontmatter.name as string)
            : undefined;
        if (name) {
            const duplicate = all.find(
                o => o.nodeId !== source.nodeId && o.nodeType === source.nodeType && o.exists && o.frontmatter.name === name,
            );
            if (duplicate) {
                findings.push(
                    finding('OPT-D01', ctx, {
                        severity: 'warning',
                        dimension: 'integration',
                        title: 'Duplicate component name',
                        detail: `frontmatter.name "${name}" is also used by "${duplicate.nodeId}".`,
                        relatedNodeIds: [duplicate.nodeId],
                    }),
                );
            }
        }

        return findings;
    },
};

// ─── OPT-D02 — broken cross-references (R26) ───────────────────────────────
//
// DEVIATION from design.md: `scanCrossReferences()` in src/parserLogic.ts is
// a *positive* filter — by construction it only ever returns links whose
// target already resolves to a known node id (`if (allNodeIds.has(candidate))
// { ...push... }`); unresolved candidates are silently dropped, never
// surfaced. That makes it structurally unable to answer R26's question
// ("which links do NOT resolve"). Modifying its exported behaviour risked
// regressing its existing callers/tests (webview suggestion generation), and
// it is outside this task's owned module (src/optimizer/). Instead this
// rule re-derives link candidates locally, mirroring parserLogic's own
// extraction regexes and candidate-id heuristics (filename stem / parent
// directory name for markdown links, slugified target for wiki links), and
// then checks the negative case itself: no known node id AND no existing
// workspace file.

const MD_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

interface LinkCandidate {
    url: string;
    index: number;
    kind: 'markdown' | 'wiki';
}

function extractLinks(body: string): LinkCandidate[] {
    const out: LinkCandidate[] = [];
    let m: RegExpExecArray | null;

    MD_LINK_RE.lastIndex = 0;
    while ((m = MD_LINK_RE.exec(body)) !== null) {
        const url = m[2].trim();
        if (/^https?:\/\//i.test(url) || /^(file|vscode|mailto):/i.test(url)) continue;
        if (url.startsWith('#')) continue;
        out.push({ url, index: m.index, kind: 'markdown' });
    }

    WIKI_LINK_RE.lastIndex = 0;
    while ((m = WIKI_LINK_RE.exec(body)) !== null) {
        out.push({ url: m[1].trim(), index: m.index, kind: 'wiki' });
    }

    return out;
}

function nodeIdCandidates(link: LinkCandidate): string[] {
    if (link.kind === 'wiki') {
        return [link.url.toLowerCase().replace(/\s+/g, '-')];
    }
    const parts = link.url.replace(/\\/g, '/').split('/');
    const last = parts[parts.length - 1] || '';
    const secondLast = parts.length >= 2 ? parts[parts.length - 2] : '';
    const candidates: string[] = [];
    const withoutExt = last.replace(/\.md$/i, '');
    if (withoutExt && withoutExt !== last) candidates.push(withoutExt);
    if (secondLast && !secondLast.endsWith('.md') && secondLast !== 'skills' && secondLast !== 'subagents') {
        candidates.push(secondLast);
    }
    if (candidates.length === 0 && last) candidates.push(last.replace(/\.[^.]+$/, ''));
    return candidates;
}

export const optD02: OptimizerRule = {
    id: 'OPT-D02',
    appliesTo: ['agent', 'subagent', 'skill', 'steering', 'hook'],
    dimension: 'integration',
    defaultSeverity: 'warning',
    /** A link target resolves or it does not. */
    confidence: 'fact',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source, nodeIds, existingPaths } = ctx;
        if (!source.exists || !source.body) return [];

        const findings: OptimizerFinding[] = [];
        for (const link of extractLinks(source.body)) {
            const candidates = nodeIdCandidates(link);
            const resolvesToNode = candidates.some(c => nodeIds.has(c));
            if (resolvesToNode) continue;

            const resolvedPath = link.kind === 'markdown' ? resolveRelativeLink(source.filePath, link.url) : '';
            const literalPath = link.kind === 'markdown' ? normalizeRelativePath(link.url) : '';
            const resolvesToFile = (resolvedPath && existingPaths.has(resolvedPath))
                || (literalPath && existingPaths.has(literalPath));
            if (resolvesToFile) continue;

            findings.push(
                finding('OPT-D02', ctx, {
                    severity: 'warning',
                    dimension: 'integration',
                    title: 'Broken cross-reference',
                    detail: `Link target "${link.url}" resolves to no known node id and no existing file.`,
                    line: lineOfIndex(source.body, link.index),
                }),
            );
        }
        return findings;
    },
};

export const DRIFT_RULES: readonly OptimizerRule[] = [optD01, optD02];
