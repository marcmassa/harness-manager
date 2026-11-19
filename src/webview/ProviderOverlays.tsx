// Provider area overlay (SVG behind the nodes) and the top-right Layer Legend +
// provider navigation bar (FEAT-048 split; moved verbatim from WhiteboardCanvas.tsx).
import * as React from 'react';
import type { useReactFlow } from '@xyflow/react';
import { LayerLegend } from './components/LayerLegend.js';
import type { ProviderGroup } from './layoutUtils.js';
import type { HarnessFlowNode } from './nodeTypes.js';

interface AreaProps {
    providerGroups: ProviderGroup[];
    viewport: { x: number; y: number; zoom: number };
    focusedProvider: string | null;
}

export function ProviderAreaOverlay({ providerGroups, viewport, focusedProvider }: AreaProps) {
    return (
        <svg
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0,
            }}
        >
            <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
                {providerGroups.map((g) => {
                    const focused = focusedProvider === null || focusedProvider === g.id;
                    return (
                        <g key={g.id} opacity={focused ? 1 : 0.3}>
                            <rect
                                x={g.x}
                                y={g.y}
                                width={g.width}
                                height={g.height}
                                rx={14}
                                ry={14}
                                fill={g.tint}
                                stroke={g.border}
                                strokeWidth={1.5}
                                strokeDasharray="6,4"
                            />
                            <text
                                x={g.x + 14}
                                y={g.y + 28}
                                fill={g.border}
                                fontSize={13}
                                fontWeight={700}
                                letterSpacing="1.2"
                            >
                                {g.label.toUpperCase()} · {g.count}
                            </text>
                        </g>
                    );
                })}
            </g>
        </svg>
    );
}

interface LegendBarProps {
    providerGroups: ProviderGroup[];
    focusedProvider: string | null;
    setFocusedProvider: (id: string | null) => void;
    nodes: HarnessFlowNode[];
    fitView: ReturnType<typeof useReactFlow>['fitView'];
}

export function WhiteboardLegendBar({ providerGroups, focusedProvider, setFocusedProvider, nodes, fitView }: LegendBarProps) {
    return (
        <div
            style={{
                position: 'absolute',
                top: 12,
                right: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                zIndex: 25,
            }}
        >
            <LayerLegend />

            {providerGroups.length > 1 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'var(--vscode-editorWidget-background)',
                        border: '1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border))',
                        borderRadius: 8,
                        padding: '4px 8px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                        fontSize: '0.75em',
                    }}
                >
                    <span style={{ opacity: 0.65, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '0.85em' }}>
                        Provider
                    </span>
                    <select
                        value={focusedProvider ?? '__all__'}
                        onChange={(e) => {
                            const v = e.target.value;
                            setFocusedProvider(v === '__all__' ? null : v);
                            if (v === '__all__') {
                                fitView({ padding: 0.2, duration: 400 });
                            } else {
                                const nodeIds = nodes
                                    .filter((n: any) => (n.data as any)?.metadata?._framework === v)
                                    .map((n: any) => n.id);
                                if (nodeIds.length > 0) {
                                    fitView({ nodes: nodeIds.map((id: string) => ({ id })), padding: 0.25, duration: 400 });
                                }
                            }
                        }}
                        style={{
                            background: 'var(--vscode-dropdown-background)',
                            color: 'var(--vscode-dropdown-foreground)',
                            border: '1px solid var(--vscode-dropdown-border)',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: '1em',
                        }}
                    >
                        <option value="__all__">All ({providerGroups.reduce((acc, g) => acc + g.count, 0)})</option>
                        {providerGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.label} ({g.count})
                            </option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
}
