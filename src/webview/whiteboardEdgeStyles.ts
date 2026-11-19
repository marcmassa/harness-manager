// Edge visual config and the pure graph-edge → React Flow edge mapping used by
// WhiteboardCanvas (FEAT-048 split: code moved verbatim from WhiteboardCanvas.tsx).
import type * as React from 'react';
import { MarkerType } from '@xyflow/react';
import type { HarnessGraph } from '../types.js';

// ===== EDGE VISUAL STYLES — maximum contrast & visibility =====
// FEAT-037 T6: exported for the per-edge-type parity assertions in
// reactFlow12Migration.test.ts (same precedent as EDGE_TYPE_ROUTING).
export const edgeConfigs: Record<string, { style: React.CSSProperties; animated: boolean; markerEnd: any }> = {
    'manages': {
        style: { 
            stroke: '#4a7dff',
            strokeWidth: 3.5, 
            strokeLinecap: 'round',
        },
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 22, height: 16, color: '#4a7dff' },
    },
    'uses': {
        style: { 
            stroke: '#2aa198',
            strokeWidth: 3, 
            strokeDasharray: '10,6',
            strokeLinecap: 'round',
        },
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 14, color: '#2aa198' },
    },
    'executing': {
        style: { 
            stroke: '#e86f4a',
            strokeWidth: 4,
            strokeLinecap: 'round',
        },
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, width: 24, height: 18, color: '#e86f4a' },
    },
    // Progressive Disclosure — Stage 1: skill scanned but NOT yet linked to any subagent
    // Muted dotted line represents "available for activation"
    'discovered': {
        style: { 
            stroke: '#6c6c8a',
            strokeWidth: 2,
            strokeDasharray: '4,4',
            strokeLinecap: 'round',
            opacity: 0.55,
        },
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 10, color: '#6c6c8a' },
    },
    // FEAT-010: Semantic Skill Discovery — TF-IDF suggested relationship
    // Dashed amber/gold line indicates "description match found, not yet confirmed"
    'suggested': {
        style: { 
            stroke: '#d4a84a',
            strokeWidth: 2.5,
            strokeDasharray: '8,4',
            strokeLinecap: 'round',
            opacity: 0.7,
        },
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 12, color: '#d4a84a' },
    },
    'governs': {
        style: {
            stroke: '#d4a84a',
            strokeWidth: 3,
            strokeLinecap: 'round',
        },
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 22, height: 16, color: '#d4a84a' },
    },
    'triggers': {
        style: {
            stroke: '#6c6c8a',
            strokeWidth: 2.5,
            strokeDasharray: '8,6',
            strokeLinecap: 'round',
        },
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 14, color: '#6c6c8a' },
    },
    // Phase 5 — Whiteboard Layer Visualization: inferred relationship edges
    'inferred': {
        style: {
            stroke: '#88cc33',
            strokeWidth: 1.5,
            strokeDasharray: '3,3',
            strokeLinecap: 'round',
            opacity: 0.5,
        },
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 8, color: '#88cc33' },
    },
};

export const defaultEdgeCfg = {
    style: { stroke: '#888', strokeWidth: 2.5, strokeLinecap: 'round' as const },
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 10, color: '#888' },
};

export const EDGE_TYPE_ROUTING: Record<string, string> = {
    manages: 'smoothstep',
    uses: 'default',
    executing: 'default',
    discovered: 'straight',
    suggested: 'smoothstep',
    governs: 'smoothstep',
    triggers: 'smoothstep',
    inferred: 'default',
};

// FEAT-011: Idoneity score → edge style thresholds (R5)
export const IDONEITY_STYLES = {
    high: { strokeWidth: 4, opacity: 1.0, threshold: 0.7 },
    medium: { strokeWidth: 3, opacity: 0.75, threshold: 0.4 },
    low: { strokeWidth: 2, opacity: 0.5, threshold: 0 },
};

/** Apply idoneity-modulated styling to a uses edge config (R5) */
export function applyIdoneityStyle(cfg: { style: React.CSSProperties; animated: boolean; markerEnd: any }, idoneity: number): { style: React.CSSProperties; animated: boolean; markerEnd: any } {
    if (idoneity <= 0) return cfg;
    const level = idoneity >= IDONEITY_STYLES.high.threshold ? IDONEITY_STYLES.high
        : idoneity >= IDONEITY_STYLES.medium.threshold ? IDONEITY_STYLES.medium
        : IDONEITY_STYLES.low;
    return {
        ...cfg,
        style: {
            ...cfg.style,
            strokeWidth: level.strokeWidth,
            opacity: level.opacity,
        },
    };
}

/** Map one graph edge to its React Flow edge (initial layout pass). */
export function toFlowEdge(e: HarnessGraph['edges'][number]) {
    const label = e.label || '';
    const cfg = edgeConfigs[label] || defaultEdgeCfg;

    // FEAT-011: Apply idoneity-modulated styling for uses edges (R5)
    let effectiveCfg = cfg;
    if (label === 'uses' && e.metadata?.idoneity !== undefined) {
        effectiveCfg = applyIdoneityStyle(cfg, e.metadata.idoneity as number);
    }

    // T13 (R5): Disabled edge style
    const isMismatchEdge = label === 'uses' && e.metadata?._mismatch === true;
    const isDisabled = label === 'uses' && e.metadata?.disabled === true;
    const edgeStyle = isDisabled
        ? { stroke: '#6c6c8a', strokeWidth: 2, strokeDasharray: '4,4', strokeLinecap: 'round' as const, opacity: 0.45 }
        : isMismatchEdge
        ? { ...effectiveCfg.style, stroke: '#e86f4a', strokeDasharray: '6,3', opacity: 1 }
        : effectiveCfg.style;

    // Show score in label for suggested edges (FEAT-010 R7)
    const displayLabel = isDisabled
        ? `⏸ ${label}`
        : label === 'suggested'
        ? ''
        : label === 'uses' && e.metadata?.idoneity !== undefined
            ? `uses (${e.metadata.idoneity})`
            : label;

    return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: displayLabel,
        type: EDGE_TYPE_ROUTING[label] ?? 'default',
        className: `harness-edge harness-edge--${label}`,
        style: edgeStyle,
        animated: isMismatchEdge && !isDisabled ? true : effectiveCfg.animated,
        markerEnd: isMismatchEdge && !isDisabled
            ? { type: MarkerType.ArrowClosed, width: 20, height: 14, color: '#e86f4a' }
            : effectiveCfg.markerEnd,
        data: { metadata: e.metadata, originalLabel: label },
        labelStyle: { 
            fontSize: '11px', 
            fontWeight: 600,
            color: isDisabled ? '#6c6c8a' : isMismatchEdge ? '#e86f4a' : (cfg.style.stroke as string),
            background: 'var(--vscode-editor-background)',
            padding: '3px 8px',
            borderRadius: '4px',
            border: isMismatchEdge
                ? '1px solid #e86f4a'
                : isDisabled
                ? '1px solid #6c6c8a'
                : `1px solid ${effectiveCfg.style.stroke as string}`,
        },
        labelBgPadding: [10, 5] as [number, number],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: 'var(--vscode-editor-background)', fillOpacity: 0.95 },
    };
}
