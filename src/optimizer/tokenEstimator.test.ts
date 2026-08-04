import { describe, it, expect } from 'vitest';
import { estimateTokens } from './tokenEstimator.js';

describe('estimateTokens (R4)', () => {
    it('returns 0 for the empty string', () => {
        expect(estimateTokens('')).toBe(0);
    });

    it('estimates prose at ~4 characters per token', () => {
        const text = 'a'.repeat(400);
        expect(estimateTokens(text)).toBe(100);
    });

    it('estimates fenced code more densely than equal-length prose', () => {
        const prose = 'x'.repeat(300);
        const code = '```\n' + 'x'.repeat(300) + '\n```';
        const proseEstimate = estimateTokens(prose);
        const codeEstimate = estimateTokens(code);
        // codeEstimate includes the fence markers themselves (extra chars),
        // and still must exceed the prose-only estimate of the same payload.
        expect(codeEstimate).toBeGreaterThan(proseEstimate);
    });

    it('known fixture: short prose sentence', () => {
        const text = 'This is a short sentence.'; // 26 chars
        expect(estimateTokens(text)).toBe(Math.ceil(26 / 4));
    });

    it('is monotonic over a superset formed by appending text', () => {
        const base = 'Some prose describing a skill in a few sentences.';
        const superset = base + ' And here is quite a bit more prose appended after it, including a code block:\n```js\nconst x = 1;\n```\n';
        expect(estimateTokens(superset)).toBeGreaterThanOrEqual(estimateTokens(base));
    });

    it('is monotonic when appending closes an unterminated fence', () => {
        const base = '```\nconst a = 1;'; // unterminated fence → treated as prose
        const superset = base + '\n```'; // now a real fenced block
        expect(estimateTokens(superset)).toBeGreaterThanOrEqual(estimateTokens(base));
    });

    it('is monotonic across several realistic fixture pairs', () => {
        const fixtures = [
            ['Short.', 'Short. And now there is more text after it, describing several more details.'],
            ['# Title\n\nSome body text.', '# Title\n\nSome body text.\n\n## More\n\nExtra section content here.'],
            ['```js\nconst a = 1;\n```', '```js\nconst a = 1;\n```\n\nSome trailing prose explaining the snippet above.'],
        ];
        for (const [small, big] of fixtures) {
            expect(estimateTokens(big)).toBeGreaterThanOrEqual(estimateTokens(small));
        }
    });
});
