import { describe, it, expect } from 'vitest';
import { OptimizerDiffProvider } from './optimizerDiffProvider.js';

function uri(s: string) {
    return { toString: () => s };
}

describe('OptimizerDiffProvider (R33)', () => {
    it('serves staged content for a uri', () => {
        const provider = new OptimizerDiffProvider();
        provider.stage(uri('harness-optimizer:/skillA/OPT-S01.md'), 'proposed content');
        expect(provider.provideTextDocumentContent(uri('harness-optimizer:/skillA/OPT-S01.md'))).toBe('proposed content');
    });

    it('returns undefined for an unstaged uri', () => {
        const provider = new OptimizerDiffProvider();
        expect(provider.provideTextDocumentContent(uri('harness-optimizer:/nothing-here'))).toBeUndefined();
    });

    it('clear() removes staged content', () => {
        const provider = new OptimizerDiffProvider();
        const u = uri('harness-optimizer:/skillA/OPT-S01.md');
        provider.stage(u, 'content');
        provider.clear(u);
        expect(provider.provideTextDocumentContent(u)).toBeUndefined();
    });

    it('keeps two staged uris independent', () => {
        const provider = new OptimizerDiffProvider();
        provider.stage(uri('a'), 'A');
        provider.stage(uri('b'), 'B');
        expect(provider.provideTextDocumentContent(uri('a'))).toBe('A');
        expect(provider.provideTextDocumentContent(uri('b'))).toBe('B');
    });
});
