// ============================================================================
// styles.ts — Shared CSS design tokens and helpers for the Harness Dashboard
// webview. Centralises per-type node styles, edge glow colours, spacing
// constants, and animation parameters so they are single-sourced and
// discoverable.
//
// Usage: import { SPACE, NODE_STYLES, HANDLE_ACCENT, ... } from './styles.js';
// ============================================================================

import type { CSSProperties } from 'react';

// ===== SPACING =====

export const SPACE: Record<string, string> = {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
};

// ===== EASING =====

export const EASE_SMOOTH = 'cubic-bezier(0.4, 0, 0.2, 1)';
export const EASE_IN_OUT = 'ease-in-out';

// ===== NODE STYLES (per type) =====
// FEAT-008 R2: distinct visual shapes per node type

export const NODE_STYLES: Record<string, CSSProperties> = {
    agent: {
        background: 'var(--vscode-editor-background)',
        color: 'var(--vscode-editor-foreground)',
        padding: SPACE.md,
        borderRadius: SPACE.sm,
        border: '2.5px solid var(--vscode-debugIcon-breakpointForeground)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        minWidth: '180px',
    },
    subagent: {
        background: 'linear-gradient(135deg, var(--vscode-button-background), color-mix(in srgb, var(--vscode-button-background) 85%, black))',
        color: 'var(--vscode-button-foreground)',
        padding: SPACE.md,
        borderRadius: SPACE.sm,
        border: '1.5px solid color-mix(in srgb, var(--vscode-button-background) 70%, var(--vscode-button-foreground))',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        minWidth: '160px',
    },
    skill: {
        background: 'var(--vscode-editor-background)',
        color: 'var(--vscode-editor-foreground)',
        padding: '12px 20px',
        borderRadius: '20px',
        border: '2px solid var(--vscode-statusBarItem-remoteBackground)',
        minWidth: '140px',
        textAlign: 'center' as const,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    },
    feature: {
        background: 'linear-gradient(135deg, var(--vscode-activityBarBadge-background), color-mix(in srgb, var(--vscode-activityBarBadge-background) 80%, black))',
        color: 'var(--vscode-activityBarBadge-foreground)',
        padding: '4px 10px',
        borderRadius: '14px',
        border: '1.5px solid color-mix(in srgb, var(--vscode-activityBarBadge-background) 60%, transparent)',
        minWidth: '100px',
        maxWidth: '160px',
        width: '160px',
        height: '36px',
        boxSizing: 'border-box' as const,
        boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
        fontSize: '0.78em',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
    },
    steering: {
        background: 'linear-gradient(135deg, rgba(212, 168, 74, 0.13), rgba(212, 168, 74, 0.05))',
        color: 'var(--vscode-editor-foreground)',
        padding: SPACE.md,
        borderRadius: SPACE.sm,
        border: '2px solid #d4a84a',
        minWidth: '160px',
        boxShadow: '0 2px 8px rgba(212, 168, 74, 0.15)',
        transform: 'skewX(-2deg)',
    },
    hook: {
        background: 'linear-gradient(135deg, rgba(108, 108, 138, 0.13), rgba(108, 108, 138, 0.05))',
        color: 'var(--vscode-editor-foreground)',
        padding: SPACE.md,
        borderRadius: SPACE.md,
        border: '2px dashed #6c6c8a',
        minWidth: '160px',
        boxShadow: '0 2px 8px rgba(108, 108, 138, 0.15)',
    },
};

// ===== HANDLE ACCENT COLOURS (per type) =====
// FEAT-016 R7: handle pills use these colours for the accent ring

export const HANDLE_ACCENT: Record<string, string> = {
    agent:    '#4a7dff',
    subagent: '#4a7dff',
    skill:    '#2aa198',
    feature:  '#888888',
    steering: '#d4a84a',
    hook:     '#6c6c8a',
};

// ===== EDGE GLOW COLOUR TOKENS (RGB only, no alpha) =====
// Used in the <style> block for per-type drop-shadow filters.

export const EDGE_GLOW_RGB: Record<string, string> = {
    manages:    '74, 125, 255',
    uses:       '42, 161, 152',
    executing:  '232, 111, 74',
    discovered: '108, 108, 138',
    suggested:  '212, 168, 74',
    governs:    '212, 168, 74',
    triggers:   '108, 108, 138',
    fallback:   '136, 136, 136',
};

// ===== BOX SHADOW HELPERS =====

/** Triple-layer glow for active / selected nodes */
export function activeNodeShadow(ringColor = 'var(--vscode-focusBorder)', rgb = '0, 122, 204'): string {
    return [
        `0 0 0 3px ${ringColor}`,
        `0 0 0 7px rgba(${rgb}, 0.25)`,
        `0 0 24px 8px rgba(${rgb}, 0.18)`,
        '0 12px 40px rgba(0,0,0,0.5)',
    ].join(', ');
}

/** Drop-shadow string builder for edge glow filters */
export function edgeGlowFilter(alphaLow = '0.30', alphaMid = '0.50', alphaHigh = '0.70'): Record<string, string> {
    return {
        normal:   `drop-shadow(0 0 3px rgba(var(--edge-rgb), ${alphaLow}))`,
        hover:    `drop-shadow(0 0 6px rgba(var(--edge-rgb), ${alphaMid}))`,
        selected: `drop-shadow(0 0 10px rgba(var(--edge-rgb), ${alphaHigh}))`,
    };
}

// ===== HANDLE PILL STYLES =====

export const HANDLE_PILL_BASE: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    justifyContent: 'center',
    minWidth: '78px',
    height: '24px',
    padding: '0 10px',
    borderRadius: '12px',
    fontSize: '0.6em',
    fontWeight: 700,
    letterSpacing: '0.8px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    transition: `all 0.2s ${EASE_SMOOTH}`,
    zIndex: 11,
    userSelect: 'none',
};

export const HIDDEN_HANDLE_STYLE: CSSProperties = {
    width: '88px',
    height: '24px',
    borderRadius: '12px',
    background: 'transparent',
    border: 'none',
    opacity: 0,
    zIndex: 12,
    cursor: 'pointer',
};

// ===== ANIMATION DURATIONS =====

export const ANIM_DURATION = {
    nodeAppear: '200ms',
    edgeTransition: '150ms',
    fadeIn: '0.2s',
    panelSlide: '0.25s',
    activePulse: '2.4s',
    suggestionScroll: '1.2s',
};

// ===== CSS KEYFRAME STRINGS =====
// Convenience exports for runtime-generated <style> blocks.

export const KEYFRAMES = `
@keyframes appear { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeInLeft { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes popIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes pickerFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
@keyframes pickerItemFadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes shimmer { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
@keyframes dotPulse { 0%, 100% { box-shadow: 0 0 0 2px var(--vscode-editorInfo-foreground); transform: scale(1); } 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--vscode-editorInfo-foreground) 25%, transparent); transform: scale(1.2); } }
@keyframes mismatchPulse { 0%, 100% { border-color: rgba(232, 111, 74, 0.4); } 50% { border-color: rgba(232, 111, 74, 1); } }
@keyframes nodeAppear { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
@keyframes activeNodePulse { 0%, 100% { box-shadow: 0 0 0 3px var(--vscode-focusBorder), 0 0 0 7px rgba(0, 122, 204, 0.22), 0 0 24px 8px rgba(0, 122, 204, 0.15), 0 12px 40px rgba(0,0,0,0.5); } 50% { box-shadow: 0 0 0 3px var(--vscode-focusBorder), 0 0 0 11px rgba(0, 122, 204, 0.12), 0 0 36px 12px rgba(0, 122, 204, 0.28), 0 12px 40px rgba(0,0,0,0.5); } }
@keyframes dash-scroll { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }
`.trim();

// ===== REDUCED MOTION HELPER =====
// Returns a CSS string that disables the given animation properties
// when the user prefers reduced motion.

export function reducedMotionOverride(properties: string): string {
    return `@media (prefers-reduced-motion: reduce) { ${properties} }`;
}

// ===== EDGE GLOW CSS BLOCKS =====
// Generates per-type edge glow CSS for a given edge type.

export function edgeGlowCSS(edgeType: string, rgb: string, dashScroll = false): string {
    const n = edgeType;
    const r = rgb;
    let css = `
.harness-edge--${n} .react-flow__edge-path {
    filter: drop-shadow(0 0 3px rgba(${r}, 0.30));
}
.harness-edge--${n}:hover .react-flow__edge-path {
    filter: drop-shadow(0 0 6px rgba(${r}, 0.50));
    stroke-width: 4 !important;
}
.harness-edge--${n}.selected .react-flow__edge-path {
    filter: drop-shadow(0 0 10px rgba(${r}, 0.70));
    stroke-width: 4 !important;
}`;
    if (dashScroll) {
        css += `
.harness-edge--${n} .react-flow__edge-path {
    animation: dash-scroll ${ANIM_DURATION.suggestionScroll} linear infinite;
}`;
    }
    return css;
}

// ===== SDD MANAGER STYLE TOKENS (FEAT-025) =====

export const SDD_MANAGER = {
    SIDEBAR_WIDTH: '240px',
    TAB_STRIP_HEIGHT: '32px',
    STATUS_BADGE_COLOURS: {
        pending: '#6c6c8a',
        spec_ready: '#d4a84a',
        in_progress: '#4a90d4',
        done: '#2aa198',
        blocked: '#c14a4a',
    },
} as const;
