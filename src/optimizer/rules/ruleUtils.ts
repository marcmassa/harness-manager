// FEAT-034 — Component Optimizer — shared, pure helpers for the rule packs.
// No I/O, no vscode, no clock, no randomness — every rule stays a pure
// function of its RuleContext.

import type { ComponentSource } from '../types.js';

/** 1-based line number of a character offset within `text`. */
export function lineOfIndex(text: string, index: number): number {
    if (index <= 0) return 1;
    let line = 1;
    for (let i = 0; i < index && i < text.length; i++) {
        if (text[i] === '\n') line++;
    }
    return line;
}

/**
 * Minimal glob → RegExp translation supporting `*` (any run of characters
 * except `/`), `**` (any run of characters including `/`) and `?` (a single
 * non-`/` character). No npm dependency — DESIGN.md forbids adding one when
 * an in-repo alternative (a small pure helper) suffices.
 */
export function globToRegExp(glob: string): RegExp {
    let pattern = '';
    for (let i = 0; i < glob.length; i++) {
        const ch = glob[i];
        if (ch === '*') {
            if (glob[i + 1] === '*') {
                pattern += '.*';
                i++;
                // swallow an optional following slash so `**/*.ts` matches `foo.ts` too
                if (glob[i + 1] === '/') i++;
            } else {
                pattern += '[^/]*';
            }
        } else if (ch === '?') {
            pattern += '[^/]';
        } else if ('.+^${}()|[]\\'.includes(ch)) {
            pattern += `\\${ch}`;
        } else {
            pattern += ch;
        }
    }
    return new RegExp(`^${pattern}$`);
}

export function matchesAnyGlob(globs: string[], paths: Iterable<string>): boolean {
    const regexes = globs.map(globToRegExp);
    for (const p of paths) {
        for (const re of regexes) {
            if (re.test(p)) return true;
        }
    }
    return false;
}

/** Reads `frontmatter.appliesTo` or `frontmatter.applies_to` as a string array. */
export function readAppliesTo(source: ComponentSource): string[] {
    const fm = source.frontmatter;
    const raw = (fm.appliesTo ?? fm.applies_to) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((v): v is string => typeof v === 'string');
}

export interface EntityInputLike {
    id: string;
    description: string;
    fullBody?: string;
    name?: string;
}

/** Builds the {id, description, fullBody, name} shape idoneity.ts / semanticMatcher.ts expect. */
export function toEntityInput(source: ComponentSource): EntityInputLike {
    const description = typeof source.frontmatter.description === 'string'
        ? (source.frontmatter.description as string)
        : '';
    return {
        id: source.nodeId,
        description,
        fullBody: source.body || undefined,
        name: (typeof source.frontmatter.name === 'string' ? source.frontmatter.name : source.label) || source.nodeId,
    };
}

/** Text used for TF-IDF corpus building: fullBody if present, else description. */
export function describeForCorpus(source: ComponentSource): string {
    return source.body || (typeof source.frontmatter.description === 'string' ? source.frontmatter.description : '') || '';
}

/**
 * Posix-normalize a path (backslashes → slashes, collapse `./` and `../`).
 * No `node:path` needed for this small, pure operation.
 */
export function normalizeRelativePath(p: string): string {
    const parts = p.replace(/\\/g, '/').split('/');
    const out: string[] = [];
    for (const part of parts) {
        if (part === '' || part === '.') continue;
        if (part === '..') {
            out.pop();
            continue;
        }
        out.push(part);
    }
    return out.join('/');
}

/** Resolves a relative link found in `fromFilePath`'s body against the workspace root. */
export function resolveRelativeLink(fromFilePath: string, url: string): string {
    const cleanUrl = url.replace(/\\/g, '/').split('#')[0].split('?')[0];
    if (cleanUrl.startsWith('/')) return normalizeRelativePath(cleanUrl);
    const fromDir = fromFilePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
    return normalizeRelativePath(`${fromDir}/${cleanUrl}`);
}
