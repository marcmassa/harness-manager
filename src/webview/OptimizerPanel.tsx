// FEAT-034 — Component Optimizer panel (T45–T51, R37–R44, R50). Pieces live in
// optimizerParts.tsx, optimizerControls.tsx and ComponentExpansion.tsx.

import * as React from 'react';
import type { OptimizerDimension, OptimizerFinding, OptimizerReport, OptimizerSeverity, OptimizableType } from '../optimizer/types.js';
import { SPACE, SEVERITY_PALETTE, ALL_SEVERITIES, formatTime, SeverityPill, TierBadge, tierOf, weakestDimension, DimensionRadar } from './optimizerParts.js';
import { averageDimensions } from './optimizerCoverage.js';
import { btnPrimary, btnIcon, btnSubtle, RadarLegend } from './optimizerControls.js';
import { OptimizerFilters, RuleBatches } from './OptimizerFilters.js';
import { ComponentExpansion } from './ComponentExpansion.js';

export { TIER_COLORS, DIMENSION_DETAIL, tierOf, weakestDimension, DimensionRadar } from './optimizerParts.js';

export type AssistState = 'idle' | 'pending' | 'ok' | 'error';

export interface OptimizerPanelProps {
    report: OptimizerReport | null;
    isScanning: boolean;
    enabled: boolean;
    // FEAT-035
    assistedEnabled?: boolean;
    assistedMode?: 'both' | 'ai-only' | 'delegate-only';
    hasTerminalAgent?: boolean;
    /** What this host can actually do — probed by the extension. */
    aiCapabilities?: { hasEditorModel: boolean; chatHostName?: string; hasApiKey: boolean };
    /** Name of the host's own chat agent, when this editor exposes one. */
    chatHostName?: string;
    onHandoffToChat?: (finding: OptimizerFinding) => void;
    aiModels?: string[];
    selectedAiModel?: string;
    assistStates?: Record<string, { state: AssistState; reason?: string }>;
    onAiRefine?: (finding: OptimizerFinding) => void;
    onDelegate?: (scope: { kind: 'finding' | 'component' | 'rule'; nodeId?: string; ruleId?: string }) => void;
    onSelectAiModel?: (model: string) => void;
    onRescan: () => void;
    onApplyFix: (finding: OptimizerFinding) => void;
    onDismissFinding: (finding: OptimizerFinding) => void;
    onRestoreFindings: () => void;
    onOpenFile: (finding: OptimizerFinding) => void;
    onOpenSettings: () => void;
}

export const OptimizerPanel: React.FC<OptimizerPanelProps> = ({
    report, isScanning, enabled, onRescan, onApplyFix,
    onDismissFinding, onRestoreFindings, onOpenFile, onOpenSettings,
    assistedEnabled = false, assistedMode = 'both', hasTerminalAgent = false, chatHostName,
    aiCapabilities,
    aiModels = [], selectedAiModel = '', assistStates = {},
    onAiRefine, onDelegate, onSelectAiModel, onHandoffToChat,
}) => {
    // R26 / R14 — an action that cannot work is hidden, never shown disabled.
    // A model from the host, or a configured API key — without either, AI Refine
    // can only fail, so it is not offered. Mirrors the SDD panel's behaviour.
    const canRefine = aiCapabilities
        ? aiCapabilities.hasEditorModel || aiCapabilities.hasApiKey
        : true;
    const showRefine = assistedEnabled && assistedMode !== 'delegate-only'
        && Boolean(onAiRefine) && canRefine;
    const showDelegate = assistedEnabled && assistedMode !== 'ai-only' && hasTerminalAgent && Boolean(onDelegate);
    // Handoff needs no credentials at all, so it is offered wherever the host
    // exposes a chat command — including editors where AI Refine cannot work.
    const showHandoff = assistedEnabled && assistedMode !== 'delegate-only'
        && Boolean(chatHostName) && Boolean(onHandoffToChat);
    const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
    const [typeFilter, setTypeFilter] = React.useState<Set<OptimizableType>>(new Set());
    const [sevFilter, setSevFilter] = React.useState<Set<OptimizerSeverity>>(new Set());
    const [dimFilter, setDimFilter] = React.useState<Set<OptimizerDimension>>(new Set());
    const [legendOpen, setLegendOpen] = React.useState(false);

    function toggle<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void): void {
        const next = new Set(set);
        if (next.has(value)) next.delete(value); else next.add(value);
        setter(next);
    }

    const findingsByNode = React.useMemo(() => {
        const map = new Map<string, OptimizerFinding[]>();
        for (const f of report?.findings ?? []) {
            const list = map.get(f.nodeId);
            if (list) list.push(f); else map.set(f.nodeId, [f]);
        }
        return map;
    }, [report]);

    // R41: the three filters compose with AND semantics. An empty filter set
    // means "no constraint", not "match nothing".
    const visible = React.useMemo(() => {
        const components = report?.components ?? [];
        return components
            .filter(c => typeFilter.size === 0 || typeFilter.has(c.nodeType))
            .filter(c => {
                if (sevFilter.size === 0 && dimFilter.size === 0) return true;
                const findings = findingsByNode.get(c.nodeId) ?? [];
                return findings.some(f =>
                    (sevFilter.size === 0 || sevFilter.has(f.severity)) &&
                    (dimFilter.size === 0 || dimFilter.has(f.dimension)),
                );
            })
            .slice()
            // R39: worst first; FEAT-043: unscored components after every scored one.
            .sort((a, b) => (a.score ?? 101) - (b.score ?? 101) || a.label.localeCompare(b.label));
    }, [report, typeFilter, sevFilter, dimFilter, findingsByNode]);

    // R50 — disabled state naming the setting.
    if (!enabled) {
        return (
            <div style={{ padding: SPACE.lg, color: 'var(--vscode-descriptionForeground)', fontSize: '0.85em' }}>
                <p style={{ marginTop: 0 }}>The Component Optimizer is switched off.</p>
                <p>
                    Enable <code>harness-dashboard.optimizer.enabled</code> to score your agents,
                    subagents, skills, steering files and hooks.
                </p>
                <button type="button" onClick={onOpenSettings} style={btnPrimary}>
                    Open settings
                </button>
            </div>
        );
    }

    const counts = report?.findingCounts.bySeverity;

    // Architecture-level dimension means. This is the "balance" view: four
    // averages hide which components are weak, but reveal WHICH DIMENSION the
    // architecture as a whole is weakest in — a different question than the
    // per-component table answers.
    const architectureDimensions = React.useMemo(() => averageDimensions(report?.components ?? []), [report]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {/* ── Header (R38) ───────────────────────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: SPACE.md, padding: `${SPACE.sm} ${SPACE.md}`,
                borderBottom: '1px solid var(--vscode-panel-border)', flexWrap: 'wrap',
            }}>
                {report && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
                        <DimensionRadar
                            dimensions={architectureDimensions}
                            tier={tierOf(report.architectureScore)}
                            size={150}
                            title="Architecture balance across the four scoring dimensions"
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '1.9em', fontWeight: 700, lineHeight: 1 }}>
                                {report.architectureScore ?? '—'}
                            </span>
                            <span style={{ fontSize: '0.68em', color: 'var(--vscode-descriptionForeground)' }}>
                                / 100 architecture score
                            </span>
                            <span style={{ fontSize: '0.68em', color: 'var(--vscode-descriptionForeground)' }}>
                                weakest: <strong>{weakestDimension(architectureDimensions)}</strong>
                            </span>
                        </div>
                    </div>
                )}

                <span style={{ fontSize: '0.75em', color: 'var(--vscode-descriptionForeground)' }}>
                    {report ? `${report.totalComponents} component${report.totalComponents === 1 ? '' : 's'}` : '—'}
                    {report?.truncated && ' (truncated at 500)'}
                </span>

                {counts && (
                    <span style={{ display: 'inline-flex', gap: SPACE.xs }}>
                        {ALL_SEVERITIES.filter(s => counts[s] > 0).map(s => (
                            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.72em' }}>
                                <SeverityPill value={s} />
                                <strong>{counts[s]}</strong>
                            </span>
                        ))}
                    </span>
                )}

                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: SPACE.sm }}>
                    {showRefine && (
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE.xs, fontSize: '0.7em', color: 'var(--vscode-descriptionForeground)' }}>
                            model
                            <select
                                value={selectedAiModel}
                                onChange={e => onSelectAiModel?.(e.target.value)}
                                title="Model used by AI refine. Auto uses the editor's own provider first, then any configured API."
                                style={{
                                    fontSize: '1em', fontFamily: 'inherit', padding: '1px 4px', borderRadius: 5,
                                    background: 'var(--vscode-dropdown-background)',
                                    color: 'var(--vscode-dropdown-foreground)',
                                    border: '1px solid var(--vscode-dropdown-border, var(--vscode-panel-border))',
                                }}
                            >
                                <option value="">Auto</option>
                                {aiModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </label>
                    )}
                    {(report?.dismissedCount ?? 0) > 0 && (
                        <button
                            type="button"
                            onClick={onRestoreFindings}
                            title="Restore all dismissed findings"
                            style={{ ...btnSubtle, fontSize: '0.72em' }}
                        >
                            ⟲ {report?.dismissedCount} dismissed
                        </button>
                    )}
                    <span style={{ fontSize: '0.7em', color: 'var(--vscode-descriptionForeground)' }}>
                        {isScanning ? 'Scanning…' : report ? formatTime(report.scanTimestamp) : ''}
                    </span>
                    <button
                        type="button"
                        onClick={onRescan}
                        disabled={isScanning}
                        title="Re-scan components"
                        aria-label="Re-scan components"
                        style={btnIcon(isScanning)}
                    >
                        <span style={{
                            display: 'inline-block',
                            animation: isScanning ? 'harnessSpin 0.9s linear infinite' : 'none',
                        }}>↻</span>
                    </button>
                </span>
            </div>

            {report && (
                <RadarLegend
                    dimensions={architectureDimensions}
                    countsByDimension={report.findingCounts.byDimension}
                    open={legendOpen}
                    onToggle={() => setLegendOpen(v => !v)}
                />
            )}

            {/* ── Filters (R41) ──────────────────────────────────────────── */}
            <OptimizerFilters typeFilter={typeFilter} setTypeFilter={setTypeFilter} sevFilter={sevFilter}
                setSevFilter={setSevFilter} dimFilter={dimFilter} setDimFilter={setDimFilter} toggle={toggle} />

            {/* ── Per-rule batch delegation (R23) ────────────────────────── */}
            {showDelegate && report?.ok && report.findings.length > 0 && <RuleBatches findings={report.findings} onDelegate={onDelegate} />}

            {/* ── Body ───────────────────────────────────────────────────── */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {report && !report.ok && (
                    <div style={{ padding: SPACE.md, color: SEVERITY_PALETTE.error.fg, fontSize: '0.8em' }}>
                        Scan failed: {report.error ?? 'unknown error'}
                    </div>
                )}

                {/* R44 — empty state, not an empty table. */}
                {report && report.ok && report.totalComponents === 0 && (
                    <div style={{ padding: SPACE.lg, color: 'var(--vscode-descriptionForeground)', fontSize: '0.85em' }}>
                        <p style={{ marginTop: 0 }}>No optimizable components found.</p>
                        <p>
                            The optimizer scores agents, subagents, skills, steering files and hooks.
                            Add one from the whiteboard and re-scan.
                        </p>
                    </div>
                )}

                {report && report.ok && report.totalComponents > 0 && visible.length === 0 && (
                    <div style={{ padding: SPACE.lg, color: 'var(--vscode-descriptionForeground)', fontSize: '0.85em' }}>
                        No component matches the active filters.
                    </div>
                )}

                {visible.map(component => {
                    const findings = (findingsByNode.get(component.nodeId) ?? []).filter(f =>
                        (sevFilter.size === 0 || sevFilter.has(f.severity)) &&
                        (dimFilter.size === 0 || dimFilter.has(f.dimension)),
                    );
                    const isOpen = expanded.has(component.nodeId);
                    return (
                        <div key={component.nodeId} style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
                            {/* Row (R39, R40) */}
                            <div
                                onClick={() => toggle(expanded, component.nodeId, setExpanded)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: SPACE.sm, cursor: 'pointer',
                                    padding: `${SPACE.sm} ${SPACE.md}`, fontSize: '0.82em', userSelect: 'none',
                                }}
                            >
                                <span style={{ opacity: 0.6, width: '10px' }}>{isOpen ? '▾' : '▸'}</span>
                                <TierBadge tier={component.tier} score={component.score} />
                                <strong style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {component.label}
                                </strong>
                                <span style={{ fontSize: '0.82em', color: 'var(--vscode-descriptionForeground)' }}>
                                    {component.nodeType}
                                </span>
                                <span
                                    title="Estimated tokens"
                                    style={{ fontSize: '0.82em', color: 'var(--vscode-descriptionForeground)', minWidth: '64px', textAlign: 'right' }}
                                >
                                    ~{component.tokenEstimate} tok
                                </span>
                                <span style={{ fontSize: '0.82em', color: 'var(--vscode-descriptionForeground)', minWidth: '58px', textAlign: 'right' }}>
                                    {component.findingCount} finding{component.findingCount === 1 ? '' : 's'}
                                </span>
                                <span title="Dimensions evaluated for this component's format" style={{ fontSize: '0.82em', color: 'var(--vscode-descriptionForeground)', minWidth: '40px', textAlign: 'right' }}>
                                    {`${component.coverage?.evaluated.length ?? 6}/6`}
                                </span>
                                {showDelegate && component.findingCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); onDelegate?.({ kind: 'component', nodeId: component.nodeId }); }}
                                        style={{ ...btnSubtle, fontSize: '0.8em' }}
                                        title={`Delegate all ${component.findingCount} findings on this component to a terminal agent`}
                                    >
                                        Delegate all
                                    </button>
                                )}
                            </div>

                            {/* Expansion (R40) */}
                            {isOpen && <ComponentExpansion onApplyFix={onApplyFix} onDismissFinding={onDismissFinding} onOpenFile={onOpenFile} chatHostName={chatHostName} assistStates={assistStates} onAiRefine={onAiRefine} onDelegate={onDelegate} onHandoffToChat={onHandoffToChat} showRefine={showRefine} showDelegate={showDelegate} showHandoff={showHandoff} component={component} findings={findings} />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default OptimizerPanel;
