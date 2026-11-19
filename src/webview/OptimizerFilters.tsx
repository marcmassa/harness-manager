// Optimizer panel filter bar (R41): node type, severity and dimension chips.
import * as React from 'react';
import type { OptimizableType, OptimizerDimension, OptimizerFinding, OptimizerSeverity } from '../optimizer/types.js';
import { SPACE, ALL_TYPES, ALL_SEVERITIES, ALL_DIMENSIONS } from './optimizerParts.js';
import { FilterChip, btnSubtle } from './optimizerControls.js';

type Toggle = <T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) => void;

export const OptimizerFilters = ({ typeFilter, setTypeFilter, sevFilter, setSevFilter, dimFilter, setDimFilter, toggle }: {
    typeFilter: Set<OptimizableType>; setTypeFilter: (s: Set<OptimizableType>) => void;
    sevFilter: Set<OptimizerSeverity>; setSevFilter: (s: Set<OptimizerSeverity>) => void;
    dimFilter: Set<OptimizerDimension>; setDimFilter: (s: Set<OptimizerDimension>) => void;
    toggle: Toggle;
}) => (
    <div style={{
        display: 'flex', gap: SPACE.md, padding: `${SPACE.xs} ${SPACE.md}`, flexWrap: 'wrap',
        borderBottom: '1px solid var(--vscode-panel-border)',
    }}>
        <span style={{ display: 'inline-flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
            {ALL_TYPES.map(t => (
                <FilterChip key={t} label={t} active={typeFilter.has(t)}
                    onClick={() => toggle(typeFilter, t, setTypeFilter)} />
            ))}
        </span>
        <span style={{ display: 'inline-flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
            {ALL_SEVERITIES.map(s => (
                <FilterChip key={s} label={s} active={sevFilter.has(s)}
                    onClick={() => toggle(sevFilter, s, setSevFilter)} />
            ))}
        </span>
        <span style={{ display: 'inline-flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
            {ALL_DIMENSIONS.map(d => (
                <FilterChip key={d} label={d} active={dimFilter.has(d)}
                    onClick={() => toggle(dimFilter, d, setDimFilter)} />
            ))}
        </span>
    </div>
);

/** Per-rule batch delegation (R23), one button per rule with more than one finding. */
export const RuleBatches = ({ findings, onDelegate }: {
    findings: readonly OptimizerFinding[];
    onDelegate?: (scope: { kind: 'rule'; ruleId: string }) => void;
}) => {
    const report = { findings };
    // Grouped by rule because that is the shape a batch actually has:
    // one kind of defect across many components, fixable with one
    // consistent instruction.
    const byRule = new Map<string, number>();
    for (const f of report.findings) byRule.set(f.ruleId, (byRule.get(f.ruleId) ?? 0) + 1);
    const batches = [...byRule.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
    if (batches.length === 0) return null;
    return (
        <div style={{
            display: 'flex', gap: SPACE.xs, alignItems: 'center', flexWrap: 'wrap',
            padding: `${SPACE.xs} ${SPACE.md}`,
            borderBottom: '1px solid var(--vscode-panel-border)',
        }}>
            <span style={{ fontSize: '0.7em', color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                batch
            </span>
            {batches.map(([ruleId, count]) => (
                <button
                    key={ruleId}
                    type="button"
                    onClick={() => onDelegate?.({ kind: 'rule', ruleId })}
                    style={{ ...btnSubtle, fontSize: '0.8em' }}
                    title={`Delegate all ${count} ${ruleId} findings to a terminal agent. The agent edits files directly — no diff preview.`}
                >
                    {ruleId} · {count}
                </button>
            ))}
        </div>
    );
};
