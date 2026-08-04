// FEAT-034 — Component Optimizer — local token estimator (design.md §B, R4)
//
// No tokenizer dependency (tiktoken/gpt-tokenizer were explicitly rejected
// in design.md's Discarded Alternatives — VSIX size + DESIGN.md principle 3).
// Prose is estimated at 4 characters per token; fenced code blocks at 3,
// because code tokenizes more densely. Frontmatter counts as prose (the
// caller passes the raw file, frontmatter block included).

const FENCE_RE = /```[\s\S]*?```/g;

const PROSE_CHARS_PER_TOKEN = 4;
const CODE_CHARS_PER_TOKEN = 3;

/**
 * Deterministic, local, dependency-free token estimate.
 *
 * Splits the text on fenced code blocks (```...```), sums
 * `ceil(len / 4)` for prose segments and `ceil(len / 3)` for code segments.
 *
 * Monotonic by construction: FENCE_RE is a left-to-right, non-overlapping
 * scan, so appending characters to the end of a string can only ever
 * (a) add new segments contributing >= 0, or (b) fold previously-unmatched
 * trailing prose into a newly-closed fenced block — which raises, never
 * lowers, the per-character cost (code costs MORE tokens per character
 * than prose: len/3 > len/4 for the same len). Either way the total
 * cannot decrease for a superset formed by appending text.
 */
export function estimateTokens(text: string): number {
    if (!text) return 0;

    let total = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    FENCE_RE.lastIndex = 0;
    while ((match = FENCE_RE.exec(text)) !== null) {
        const proseSegment = text.slice(lastIndex, match.index);
        total += Math.ceil(proseSegment.length / PROSE_CHARS_PER_TOKEN);
        total += Math.ceil(match[0].length / CODE_CHARS_PER_TOKEN);
        lastIndex = match.index + match[0].length;
    }

    const tail = text.slice(lastIndex);
    total += Math.ceil(tail.length / PROSE_CHARS_PER_TOKEN);

    return total;
}
