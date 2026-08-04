// FEAT-035 — Assisted Component Fixes — AI Refine core (design.md §A, R8, R9, R11)
//
// Pure: prompt construction and response normalization only. The provider call
// itself lives in OptimizerCoordinator, because that is where `vscode` may be
// imported. Keeping these two halves apart means the parts that can be wrong in
// a way the user notices — what we send, and what we accept back — are testable
// against fixtures with no mock.
//
// The normalized content is handed to FEAT-034's existing diff-preview flow
// unchanged, which is what preserves R32's guarantee that nothing reaches disk
// before the user confirms.

import matter from '../frontmatter.js';
import type { ComponentSource, OptimizerFinding } from './types.js';

export interface RefinePromptInput {
    source: ComponentSource;
    finding: OptimizerFinding;
}

export type NormalizedRefine =
    | { ok: true; content: string; warnings: string[] }
    | { ok: false; reason: string };

/**
 * R8 — build the prompt. Deterministic: the same input always yields the same
 * string, so the request is reviewable and the test can assert on it exactly.
 *
 * Only this component's own content and path appear. No sibling content, no
 * workspace paths beyond the component's own `filePath` (R8, R28).
 */
export function buildRefinePrompt({ source, finding }: RefinePromptInput): string {
    return [
        'You are correcting one file in an AI agent architecture.',
        '',
        `File: ${source.filePath}`,
        `Component type: ${source.nodeType}`,
        '',
        `Issue (${finding.ruleId}): ${finding.title}`,
        finding.detail,
        '',
        'Current content:',
        '---',
        source.raw,
        '---',
        '',
        'Return the COMPLETE corrected file and nothing else. No explanation, no',
        'markdown fence. Preserve the YAML frontmatter and every field it already',
        'has unless the issue is specifically about the frontmatter.',
    ].join('\n');
}

/**
 * Strip a single wrapping markdown code fence, if the model added one despite
 * being told not to. Handles bare ``` and language-tagged ```md / ```markdown.
 * Only an outermost pair is removed — fences *inside* the file are content.
 */
function stripOuterFence(raw: string): string {
    const text = raw.trim();
    const opening = /^```[^\n]*\n/;
    if (!opening.test(text)) return text;
    const withoutOpen = text.replace(opening, '');
    const closing = /\n?```$/;
    if (!closing.test(withoutOpen)) return text; // unbalanced — leave it alone
    return withoutOpen.replace(closing, '');
}

/**
 * R9 + R11 — turn a provider response into proposed file content.
 *
 * Frontmatter regressions are reported as `warnings` rather than rejected. The
 * user is one modal away from a full side-by-side diff, so blocking here would
 * refuse legitimate restructurings while adding nothing the diff does not
 * already show. Rejection is reserved for a response that carries no content at
 * all, where there is nothing to review.
 */
export function normalizeRefineResponse(
    raw: string,
    original: ComponentSource,
): NormalizedRefine {
    const content = stripOuterFence(raw ?? '');
    if (content.trim().length === 0) {
        return { ok: false, reason: 'the model returned no content' };
    }

    const warnings: string[] = [];
    const proposed = matter(content);
    const originalKeys = Object.keys(original.frontmatter);

    if (originalKeys.length > 0 && Object.keys(proposed.data).length === 0) {
        warnings.push('The proposal has no YAML frontmatter; the original had some.');
    } else {
        const dropped = originalKeys.filter(k => !(k in proposed.data));
        if (dropped.length > 0) {
            warnings.push(
                `The proposal drops frontmatter ${dropped.length === 1 ? 'key' : 'keys'}: ${dropped.join(', ')}.`,
            );
        }
    }

    return { ok: true, content, warnings };
}
