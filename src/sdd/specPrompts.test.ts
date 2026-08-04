import { describe, it, expect } from 'vitest';
import {
    buildSpecDraftPrompt,
    buildFeatureDescriptionPrompt,
    MAX_SPEC_PROMPT_CHARS,
} from './specPrompts.js';

const template = '# Requirements\n\n## R1\n';

describe('buildSpecDraftPrompt — FEAT-036', () => {
    it('is deterministic, so the direct call and the chat handoff send the same text', () => {
        // The whole reason these builders were extracted: if the two paths could
        // produce different prompts, the same button would give different specs
        // depending on which route the host supported.
        const input = { file: 'requirements' as const, userPrompt: 'a login flow', templateContent: template };
        expect(buildSpecDraftPrompt(input)).toBe(buildSpecDraftPrompt(input));
    });

    it('carries the user description, the template and the output instruction', () => {
        const p = buildSpecDraftPrompt({ file: 'design', userPrompt: 'a login flow', templateContent: template });
        expect(p).toContain('a login flow');
        expect(p).toContain('# Requirements');
        expect(p).toContain('Return only the markdown body');
        expect(p).toContain('design file');
    });

    it('includes feature metadata only when a feature is known', () => {
        const withFeature = buildSpecDraftPrompt({
            file: 'tasks', userPrompt: 'x', templateContent: template,
            feature: { id: 'FEAT-001', title: 'T', description: 'D', priority: 'P1' },
        });
        expect(withFeature).toContain('FEAT-001');

        const without = buildSpecDraftPrompt({ file: 'tasks', userPrompt: 'x', templateContent: template });
        expect(without).not.toContain('Feature Metadata');
    });

    it('caps prior context at 4096 chars so one long spec cannot crowd out the template', () => {
        const p = buildSpecDraftPrompt({
            file: 'requirements', userPrompt: 'x', templateContent: template,
            contextContent: 'C'.repeat(9000),
        });
        expect(p).toContain('Previously Approved Content');
        // Count only the payload run, not the section header — "Content" in the
        // heading contributes a C of its own.
        const run = p.match(/C{100,}/)![0];
        expect(run.length).toBe(4096);
    });

    it('truncates an oversized prompt and says so', () => {
        const p = buildSpecDraftPrompt({
            file: 'requirements', userPrompt: 'U'.repeat(20000), templateContent: template,
        });
        expect(p.length).toBeLessThanOrEqual(MAX_SPEC_PROMPT_CHARS + 32);
        expect(p).toContain('[... truncated ...]');
    });
});

describe('buildFeatureDescriptionPrompt — four shapes', () => {
    it('refines existing text when mode is refine', () => {
        const p = buildFeatureDescriptionPrompt({
            title: 'T', mode: 'refine', currentDescription: 'old text', target: 'createDescription',
        });
        expect(p).toContain('Refine and improve the following text');
        expect(p).toContain('old text');
    });

    it('writes a wizard prompt for the wizardPrompt target', () => {
        const p = buildFeatureDescriptionPrompt({
            title: 'Login', mode: 'generate', currentDescription: '', target: 'wizardPrompt',
        });
        expect(p).toContain('Write a detailed prompt');
        expect(p).toContain('Login');
    });

    it('refines spec content for the editContent target', () => {
        const p = buildFeatureDescriptionPrompt({
            title: 'T', mode: 'generate', currentDescription: '## Section', target: 'editContent',
        });
        expect(p).toContain('specification content');
        expect(p).toContain('## Section');
    });

    it('falls back to a one-paragraph description', () => {
        const p = buildFeatureDescriptionPrompt({
            title: 'Login', mode: 'generate', currentDescription: '', target: 'createDescription',
        });
        expect(p).toContain('concise, one-paragraph description');
        expect(p).toContain('Login');
    });

    it('ignores refine mode when there is nothing to refine', () => {
        const p = buildFeatureDescriptionPrompt({
            title: 'Login', mode: 'refine', currentDescription: '', target: 'createDescription',
        });
        expect(p).toContain('concise, one-paragraph description');
    });

    it('is deterministic across the four shapes', () => {
        for (const target of ['createDescription', 'wizardPrompt', 'editContent'] as const) {
            const input = { title: 'T', mode: 'generate', currentDescription: 'c', target };
            expect(buildFeatureDescriptionPrompt(input)).toBe(buildFeatureDescriptionPrompt(input));
        }
    });
});
