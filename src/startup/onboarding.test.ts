// FEAT-045 T5 — welcome content and walkthrough (R8–R11).
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const welcome: Array<{ view: string; when: string; contents: string }> = pkg.contributes.viewsWelcome;
const walkthroughs: Array<{ steps: Array<{ title: string; description: string; media: { svg?: string }; completionEvents: string[] }> }> = pkg.contributes.walkthroughs;
const FRAMEWORKS = /Harness SDD|Claude|Cursor|Copilot|Kiro|Gemini|OpenCode|Windsurf/;
// A link alone on its own line renders as a button in a welcome view.
const buttons = (contents: string) => contents.split('\n').filter(line => /^\[[^\]]+\]\([^)]+\)$/.test(line.trim())).length;

describe('welcome views (R8, R9)', () => {
    it('covers no folder, scanning and an empty scan in the Sources view', () => {
        const sources = welcome.filter(w => w.view === 'harness-dashboard.sources');
        for (const state of ['noFolder', 'scanning', 'empty']) {
            expect(sources.some(w => w.when.includes(`harnessDashboard.state == ${state}`)), state).toBe(true);
        }
    });

    it('uses at most one button per welcome and prefers links', () => {
        for (const w of welcome) expect(buttons(w.contents), w.when).toBeLessThanOrEqual(1);
        const empty = welcome.find(w => w.when === 'harnessDashboard.state == empty')!;
        expect(buttons(empty.contents)).toBe(0);
        expect(empty.contents).toContain('command:harness-dashboard.openLocalConfig');
        expect(empty.contents).toMatch(/Bring Your Own Harness\]\(https:/);
    });

    it('recommends no framework in welcome or walkthrough text', () => {
        for (const w of welcome) expect(w.contents).not.toMatch(FRAMEWORKS);
        for (const step of walkthroughs[0].steps) expect(`${step.title} ${step.description}`).not.toMatch(FRAMEWORKS);
    });
});

describe('walkthrough (R10)', () => {
    it('is one walkthrough of at most five steps, each with an action, completion event and theme-aware SVG', () => {
        expect(walkthroughs).toHaveLength(1);
        const steps = walkthroughs[0].steps;
        expect(steps.length).toBeLessThanOrEqual(5);
        for (const step of steps) {
            expect(step.description, step.title).toMatch(/\n\[[A-Z][a-z]+ [^\]]*\]\(command:[^)]+\)$/); // verb-led action
            expect(step.completionEvents.length, step.title).toBeGreaterThan(0);
            const svg = step.media.svg!;
            expect(existsSync(svg), svg).toBe(true);
            expect(readFileSync(svg, 'utf8')).toMatch(/var\(--vscode-/);
        }
    });
});

describe('no unsolicited UI (R11)', () => {
    it('never opens the walkthrough or a webview from code paths other than explicit commands', () => {
        const files: string[] = [];
        const walk = (dir: string) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts') && !p.includes('.test.') && !p.includes('/test/')) files.push(p); } };
        walk('src');
        const offenders = files.filter(f => /openWalkthrough|welcome\.showAllWalkthroughs/.test(readFileSync(f, 'utf8')));
        expect(offenders).toEqual([]);
    });
});
