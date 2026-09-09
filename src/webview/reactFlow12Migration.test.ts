/**
 * FEAT-037 T6 — React Flow 12 migration reconciliation + source-contract tests.
 *
 * Design §10.1: source-contract assertions (same regex-over-source style as
 * FEAT-036's noAutoAudit.test.ts) plus the reconciliation pins:
 *   (a) the setNodes/setEdges update path is immutable (design §3 #4);
 *   (b) no code reads edge.sourceHandle/targetHandle or
 *       node.width/height/measured (design §1, §3 #2/#3, §6) — the v12
 *       measured-dimensions change stays inert;
 *   (c) per-type edge styling + z-index layering parity for the 8 edge
 *       kinds (R7 / FEAT-016), and no-remount z-index updates.
 *
 * @requirement R2  @xyflow/react only, the legacy graph package is gone
 * @requirement R3  v12 stylesheet imported
 * @requirement R6  nodeDragThreshold={1}
 * @requirement R7  edge styling / z-index layering preserved
 * @requirement R10 React 19 runtime, no removed APIs
 * @requirement R11 no defaultProps / ReactDOM.render
 * @requirement R13 version stays 0.8.1
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDGE_TYPE_ROUTING, edgeConfigs } from './WhiteboardCanvas.js';
import { MarkerType } from '@xyflow/react';

const WEBVIEW_ROOT = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(WEBVIEW_ROOT, '..');
const PKG_JSON = join(SRC_ROOT, '..', 'package.json');

/**
 * All .ts/.tsx files under a root (same walker as FEAT-036's audit).
 * includeTests=false (default) skips *.test.ts(x) — required for the
 * property-read audits, since THIS file legitimately contains the patterns
 * as regex literals.
 */
function sourceFiles(root: string, includeTests = false): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry);
            if (statSync(full).isDirectory()) {
                if (entry === 'node_modules' || entry === 'fixtures') continue;
                walk(full);
            } else if (/\.tsx?$/.test(entry) && (includeTests || !/\.test\.tsx?$/.test(entry))) {
                out.push(full);
            }
        }
    };
    walk(root);
    return out;
}

const wbSrc = readFileSync(join(WEBVIEW_ROOT, 'WhiteboardCanvas.tsx'), 'utf8');
const indexSrc = readFileSync(join(WEBVIEW_ROOT, 'index.tsx'), 'utf8');
const layoutSrc = readFileSync(join(WEBVIEW_ROOT, 'layoutUtils.ts'), 'utf8');
const customNodeSrc = readFileSync(join(WEBVIEW_ROOT, 'components', 'CustomNode.tsx'), 'utf8');

// Built by concatenation so this test file never self-matches the pattern.
const LEGACY_PKG = 'react' + 'flow';

// ─── R2 / R3 — dependency & import surface ───────────────────────────────────

describe('FEAT-037 R2 — zero legacy-package surface, everything on @xyflow/react', () => {
    it('no file under src/ references the legacy graph package at all', () => {
        const offenders = sourceFiles(SRC_ROOT, true)
            .filter((f) => readFileSync(f, 'utf8').includes(LEGACY_PKG))
            .map((f) => relative(SRC_ROOT, f));
        expect(offenders).toEqual([]);
    });

    it('the 7 migrated touchpoints import from @xyflow/react', () => {
        for (const rel of [
            'index.tsx',
            'WhiteboardCanvas.tsx',
            'layoutUtils.ts',
            'layoutUtils.test.ts',
            'components/CustomNode.tsx',
            'components/DiscoveredNode.tsx',
            'components/EdgeContextMenu.tsx',
        ]) {
            const src = readFileSync(join(WEBVIEW_ROOT, rel), 'utf8');
            expect(src, rel).toMatch(/from '@xyflow\/react'/);
        }
    });

    it('ReactFlow is a NAMED import (v12 has no default export)', () => {
        expect(wbSrc).not.toMatch(/import\s+ReactFlow\s*[,{]/);
        expect(wbSrc).toMatch(/import\s*\{[\s\S]*?\bReactFlow\b[\s\S]*?\}\s*from\s*'@xyflow\/react'/);
    });

    it('package.json: @xyflow/react ^12.11.6 + React ^19, legacy pkg gone, types in devDeps, version 0.8.1', () => {
        const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'));
        expect(pkg.version).toBe('0.8.1');
        expect(pkg.dependencies[LEGACY_PKG]).toBeUndefined();
        expect(pkg.dependencies['@xyflow/react']).toBe('^12.11.6');
        expect(pkg.dependencies['react']).toBe('^19.0.0');
        expect(pkg.dependencies['react-dom']).toBe('^19.0.0');
        expect(pkg.devDependencies['@types/react']).toBe('^19');
        expect(pkg.devDependencies['@types/react-dom']).toBe('^19');
        // R13 / DESIGN §2.4: the ONLY runtime deps are the swap + existing ones.
        expect(Object.keys(pkg.dependencies).sort()).toEqual(
            ['@vscode/webview-ui-toolkit', '@xyflow/react', 'react', 'react-dom', 'yaml'].sort(),
        );
    });
});

describe('FEAT-037 R3 — v12 stylesheet loaded at the new path', () => {
    it('index.tsx imports @xyflow/react/dist/style.css', () => {
        expect(indexSrc).toMatch(/import\s+'@xyflow\/react\/dist\/style\.css'/);
    });
    it('the built webview bundle carries the v12 base styles', () => {
        const cssPath = join(SRC_ROOT, '..', 'dist', 'webview.css');
        if (!existsSync(cssPath)) return; // build not present in this run — the source contract above is the gate
        const css = readFileSync(cssPath, 'utf8');
        expect(css).toContain('.react-flow__node');
        expect(css).toContain('.react-flow__edge');
        expect(css).toContain('.react-flow__handle');
    });
});

// ─── R6 / R5 — drag threshold + FEAT-017 persistence ────────────────────────

describe('FEAT-037 R6 — explicit nodeDragThreshold={1} (design §4)', () => {
    it('the <ReactFlow> JSX pins nodeDragThreshold={1}', () => {
        expect(wbSrc).toMatch(/nodeDragThreshold=\{1\}/);
    });
    it('FEAT-017 recording rules stay: remove clears, finished drags persist final positions', () => {
        expect(wbSrc).toMatch(/delete\s+manualPositionsRef\.current\[change\.id\]/);
        expect(wbSrc).toMatch(/change\.type === 'position'[\s\S]*?change\.dragging !== true[\s\S]*?manualPositionsRef\.current\[change\.id\]/);
        expect(wbSrc).toMatch(/handleNodeDragStop = React\.useCallback\([\s\S]*?manualPositionsRef\.current\[node\.id\]/);
    });
    it('pill/handle clicks stopPropagation so the drag machinery never sees them (R6 rationale)', () => {
        const pillHandlers = customNodeSrc.match(/onClick=\{\(event\) => \{\s*\n?\s*event\.stopPropagation\(\)/g) ?? [];
        expect(pillHandlers.length).toBeGreaterThanOrEqual(2); // source + target Handle
        expect(customNodeSrc).toMatch(/onPointerDown=\{\(event\) => \{\s*\n?\s*event\.stopPropagation\(\)/); // skill picker
    });
});

// ─── T6 (a) — immutable update path (design §3 #4) ───────────────────────────

/**
 * Extract every `setNodes(...)` / `setEdges(...)` call (balanced parens) from
 * a source string.
 */
function stateUpdaterCalls(src: string): string[] {
    const calls: string[] = [];
    const re = /\bset(?:Nodes|Edges)\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
        let depth = 1;
        let i = m.index + m[0].length;
        for (; i < src.length && depth > 0; i++) {
            const ch = src[i];
            if (ch === '(') depth++;
            else if (ch === ')') depth--;
        }
        calls.push(src.slice(m.index, i));
    }
    return calls;
}

describe('FEAT-037 T6(a) — no mutation-based setNodes/setEdges updates (design §3 #4)', () => {
    it('WhiteboardCanvas has setNodes/setEdges call sites to audit', () => {
        expect(stateUpdaterCalls(wbSrc).length).toBeGreaterThanOrEqual(6);
    });
    it('no updater assigns to a node/edge property or Object.assign-merges in place', () => {
        const offenders = stateUpdaterCalls(wbSrc).filter(
            (call) =>
                /\b[a-zA-Z_$][\w$]*\s*\.\s*[\w$]+\s*=[^=]/.test(call) ||
                /Object\.assign\s*\(/.test(call),
        );
        expect(offenders).toEqual([]);
    });
    it('every updater goes through map+spread, filter, or addEdge (v12 stock applier path)', () => {
        for (const call of stateUpdaterCalls(wbSrc)) {
            if (/\(\s*\[/.test(call)) continue; // array-snapshot form: setNodes([...mergedNodes])
            const isMap = /\.map\s*\(/.test(call);
            const isFilter = /\.filter\s*\(/.test(call);
            const isAddEdge = /addEdge\s*\(/.test(call);
            expect(isMap || isFilter || isAddEdge, call.slice(0, 60)).toBe(true);
            if (isMap) expect(call).toMatch(/\.\.\./);
        }
    });
    it('the one sanctioned mutation site (layoutRank on fresh nodes) stays in layoutUtils and is never in an updater', () => {
        expect(layoutSrc).toMatch(/n\.position = \{/); // fresh-in-effect layout write (design §3 #4)
        for (const call of stateUpdaterCalls(wbSrc)) {
            expect(call).not.toMatch(/\.position\s*=[^=]/);
        }
    });
});

// ─── T6 (b) — grep evidence: v12 measured/handle changes are inert ──────────

describe('FEAT-037 T6(b) — no measured-dimension / handle-property reads (design §1, §3 #2-3, §6)', () => {
    const patterns: Array<[string, RegExp]> = [
        ['node.measured', /\.measured\b/],
        ['edge.sourceHandle', /\.sourceHandle\b/],
        ['edge.targetHandle', /\.targetHandle\b/],
        ['node.width (RF node)', /\bnode\.width\b/],
        ['node.height (RF node)', /\bnode\.height\b/],
    ];
    for (const [name, re] of patterns) {
        it(`${name} is never read anywhere under src/webview`, () => {
            const offenders = sourceFiles(WEBVIEW_ROOT)
                .filter((f) => re.test(readFileSync(f, 'utf8')))
                .map((f) => relative(WEBVIEW_ROOT, f));
            expect(offenders, name).toEqual([]);
        });
    }
    it('layout geometry keeps using the local constants (v12 never needs measured dims here)', () => {
        expect(layoutSrc).toMatch(/const nodeWidth = 200/);
        expect(layoutSrc).toMatch(/const nodeHeight = 80/);
    });
});

// ─── T6 (c) — FEAT-016 edge styling + z-index parity ─────────────────────────

describe('FEAT-037 R7 — per-edge-type routing, styling and z-index parity (FEAT-016)', () => {
    const EIGHT_KINDS = ['manages', 'uses', 'executing', 'discovered', 'suggested', 'governs', 'triggers', 'inferred'];

    it.each(EIGHT_KINDS)('%s keeps its routing type', (kind) => {
        const expected: Record<string, string> = {
            manages: 'smoothstep', uses: 'default', executing: 'default',
            discovered: 'straight', suggested: 'smoothstep', governs: 'smoothstep',
            triggers: 'smoothstep', inferred: 'default',
        };
        expect(EDGE_TYPE_ROUTING[kind]).toBe(expected[kind]);
    });

    const strokes: Record<string, string> = {
        manages: '#4a7dff', uses: '#2aa198', executing: '#e86f4a',
        discovered: '#6c6c8a', suggested: '#d4a84a', governs: '#d4a84a',
        triggers: '#6c6c8a', inferred: '#88cc33',
    };
    const dashes: Record<string, string | undefined> = {
        manages: undefined, uses: '10,6', executing: undefined,
        discovered: '4,4', suggested: '8,4', governs: undefined,
        triggers: '8,6', inferred: '3,3',
    };
    for (const kind of EIGHT_KINDS) {
        it(`${kind} keeps stroke, dash pattern, ArrowClosed marker and animated flag`, () => {
            const cfg = edgeConfigs[kind];
            expect(cfg, `edgeConfigs[${kind}]`).toBeDefined();
            expect(cfg.style.stroke).toBe(strokes[kind]);
            expect(cfg.style.strokeDasharray ?? undefined).toBe(dashes[kind]);
            expect(cfg.markerEnd.type).toBe(MarkerType.ArrowClosed);
            expect(typeof cfg.markerEnd.width).toBe('number');
            expect(typeof cfg.markerEnd.height).toBe('number');
            expect(cfg.markerEnd.color).toBe(strokes[kind]);
            expect(cfg.animated).toBe(kind === 'executing');
        });
    }

    it('z-index layering: selected=1000, hovered=500, rest=0 — computed by spread, never by remounting (design §6)', () => {
        expect(wbSrc).toMatch(/const zIndex = isSelected \? 1000 : isHovered \? 500 : 0;/);
        expect(wbSrc).toMatch(/return \{ \.\.\.e, \.\.\.overrides, zIndex \}/);
    });

    it('edge label + hover/select bookkeeping live in edge.data (originalLabel), not on handle fields', () => {
        expect(wbSrc).toMatch(/data: \{ metadata: e\.metadata, originalLabel: label \}/);
        expect(wbSrc).not.toMatch(/\.sourceHandle\b|\.targetHandle\b/);
    });
});

// ─── R10 / R11 — React 19 runtime hygiene ────────────────────────────────────

describe('FEAT-037 R10/R11 — React 19 clean-mount audit (design §13)', () => {
    it('index.tsx mounts via react-dom/client createRoot', () => {
        expect(indexSrc).toMatch(/import \{ createRoot \} from 'react-dom\/client'/);
        expect(indexSrc).toMatch(/createRoot\(/);
    });
    it('no ReactDOM.render anywhere in src/', () => {
        const offenders = sourceFiles(SRC_ROOT)
            .filter((f) => /ReactDOM\.render\s*\(/.test(readFileSync(f, 'utf8')))
            .map((f) => relative(SRC_ROOT, f));
        expect(offenders).toEqual([]);
    });
    it('no defaultProps on function components in src/webview (React 19 removed it)', () => {
        const offenders = sourceFiles(WEBVIEW_ROOT)
            .filter((f) => /\.defaultProps\b/.test(readFileSync(f, 'utf8')))
            .map((f) => relative(WEBVIEW_ROOT, f));
        expect(offenders).toEqual([]);
    });
});
