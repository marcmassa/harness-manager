// FEAT-034 — Component Optimizer — quick-fix transforms (design.md §G, R31, R36)
//
// Every fix is a pure function `(source, fix) → string` (design.md's stated
// signature). Two deviations were necessary and are documented at each site:
//
//  1. `extract-to-references` needs to know whether references/<slug>.md
//     already exists (R36) — that is workspace filesystem knowledge this
//     pure module cannot have on its own. computeFix() takes an optional
//     third `existingPaths` parameter (empty by default) so callers that
//     have that information (a coordinator, or a test fixture) can supply
//     it; a caller that omits it gets the conservative behaviour of never
//     detecting a pre-existing target.
//
//  2. `extract-to-references` is, by design.md's own admission, "the only
//     fix that writes two files". A `{ ok: true; content: string }` return
//     shape has no room for the second file. The success shape below adds
//     an optional `extraFile` field carrying `{ relPath, content }` for
//     that one fix type; every other fix type leaves it undefined, and
//     `.content` still means exactly what design.md says it means.

import matter from '../frontmatter.js';
import type { ComponentSource, QuickFix } from './types.js';

export interface ComputedFixOk {
    ok: true;
    content: string;
    /** Present only for `extract-to-references` (R36). */
    extraFile?: { relPath: string; content: string };
}

export interface ComputedFixErr {
    ok: false;
    reason: string;
}

export type FixResult = ComputedFixOk | ComputedFixErr;

function directoryOf(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/');
    parts.pop();
    return parts.join('/');
}

function directoryNameOf(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 2] : '';
}

function slugify(s: string): string {
    const slug = s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'section';
}

// ─── insert-frontmatter ─────────────────────────────────────────────────────

function insertFrontmatter(source: ComponentSource): FixResult {
    const dir = directoryNameOf(source.filePath) || source.nodeId;
    const stub = `---\nname: ${dir}\ndescription: \n---\n`;
    return { ok: true, content: `${stub}${source.raw}` };
}

// ─── set-frontmatter-field ──────────────────────────────────────────────────

function setFrontmatterField(source: ComponentSource, fix: QuickFix): FixResult {
    const field = fix.payload.field;
    if (!field) return { ok: false, reason: 'set-frontmatter-field requires payload.field' };
    const value = fix.payload.value ?? '';
    const data = { ...source.frontmatter, [field]: value };
    return { ok: true, content: matter.stringify(source.body, data) };
}

// ─── append-section-stubs ───────────────────────────────────────────────────

function appendSectionStubs(source: ComponentSource, fix: QuickFix): FixResult {
    const sections = (fix.payload.sections ?? '').split(',').map(s => s.trim()).filter(Boolean);
    if (sections.length === 0) return { ok: false, reason: 'append-section-stubs requires payload.sections' };

    let appended = '';
    for (const section of sections) {
        appended += `\n\n## ${section}\n\n<!-- TODO: document ${section.toLowerCase()} -->\n`;
    }
    const base = source.raw.endsWith('\n') ? source.raw.slice(0, -1) : source.raw;
    return { ok: true, content: `${base}${appended}` };
}

// ─── extract-to-references ──────────────────────────────────────────────────

interface H2Section { title: string; raw: string; }

function splitIntoH2Sections(body: string): { preamble: string; sections: H2Section[] } {
    const re = /^##\s+(.+)$/gm;
    const headers: { title: string; index: number }[] = [];
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(body)) !== null) {
        headers.push({ title: m[1].trim(), index: m.index });
    }
    const preamble = headers.length > 0 ? body.slice(0, headers[0].index) : body;
    const sections: H2Section[] = headers.map((h, i) => {
        const end = i + 1 < headers.length ? headers[i + 1].index : body.length;
        return { title: h.title, raw: body.slice(h.index, end).replace(/\s+$/, '') };
    });
    return { preamble, sections };
}

function extractToReferences(
    source: ComponentSource,
    fix: QuickFix,
    existingPaths: ReadonlySet<string>,
): FixResult {
    const wanted = (fix.payload.sections ?? '').split(',').map(s => s.trim()).filter(Boolean);
    if (wanted.length === 0) return { ok: false, reason: 'extract-to-references requires payload.sections' };

    const slug = slugify(wanted[0]);
    const dir = directoryOf(source.filePath);
    const targetPath = dir ? `${dir}/references/${slug}.md` : `references/${slug}.md`;

    // R36: refuse rather than overwrite an existing target.
    if (existingPaths.has(targetPath)) {
        return { ok: false, reason: `references/${slug}.md already exists; extract-to-references is unavailable` };
    }

    const { preamble, sections } = splitIntoH2Sections(source.body);
    const wantedSet = new Set(wanted);
    const extracted = sections.filter(s => wantedSet.has(s.title));
    const kept = sections.filter(s => !wantedSet.has(s.title));

    if (extracted.length === 0) {
        return { ok: false, reason: 'none of the requested sections were found in the body' };
    }

    const referenceContent = `${extracted.map(s => s.raw).join('\n\n')}\n`;
    const linkLine = `\nSee [${slug}](references/${slug}.md) for details.\n`;
    const keptBody = [preamble.replace(/\s+$/, ''), ...kept.map(s => s.raw)].filter(Boolean).join('\n\n');
    const newBody = `${keptBody}\n${linkLine}`;

    const content = matter.stringify(newBody, source.frontmatter);
    return { ok: true, content, extraFile: { relPath: targetPath, content: referenceContent } };
}

// ─── relativize-path ─────────────────────────────────────────────────────────

function relativizePath(source: ComponentSource, fix: QuickFix): FixResult {
    const { line, absolutePath, relativePath } = fix.payload;
    if (!line || !absolutePath) {
        return { ok: false, reason: 'relativize-path requires payload.line and payload.absolutePath' };
    }
    // No relativePath means the absolute path could not be resolved inside
    // the workspace root — leave the file untouched rather than guessing.
    if (!relativePath) {
        return { ok: false, reason: 'path is outside the workspace root' };
    }

    const lineNum = Number.parseInt(line, 10);
    if (!Number.isFinite(lineNum) || lineNum < 1) {
        return { ok: false, reason: 'invalid line number' };
    }

    const lines = source.raw.split('\n');
    const idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length || !lines[idx].includes(absolutePath)) {
        return { ok: false, reason: 'absolute path not found on the specified line' };
    }

    lines[idx] = lines[idx].split(absolutePath).join(`./${relativePath}`);
    return { ok: true, content: lines.join('\n') };
}

// ─── dispatcher ──────────────────────────────────────────────────────────────

export function computeFix(
    source: ComponentSource,
    fix: QuickFix,
    existingPaths: ReadonlySet<string> = new Set(),
): FixResult {
    switch (fix.type) {
        case 'insert-frontmatter':
            return insertFrontmatter(source);
        case 'set-frontmatter-field':
            return setFrontmatterField(source, fix);
        case 'append-section-stubs':
            return appendSectionStubs(source, fix);
        case 'extract-to-references':
            return extractToReferences(source, fix, existingPaths);
        case 'relativize-path':
            return relativizePath(source, fix);
        default:
            return { ok: false, reason: `unknown fix type "${(fix as QuickFix).type}"` };
    }
}
