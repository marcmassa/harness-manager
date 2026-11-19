// Optimizer panel: expanded component row — radar and findings with their actions.
import * as React from 'react';
import { frameworkLabel } from '../frameworks.js';
import type { ComponentScore, OptimizerFinding } from '../optimizer/types.js';
import { AskHostButton } from './components/AskHostButton.js';
import { SPACE, TIER_COLORS, SEVERITY_PALETTE, SeverityPill, DimensionRadar } from './optimizerParts.js';
import { btnPrimary, btnSubtle, btnLink } from './optimizerControls.js';

export const ComponentExpansion = (ctx: { canEdit?: (nodeId: string) => boolean; onApplyFix: any; onDismissFinding: any; onOpenFile: any; chatHostName: any; assistStates: any; onAiRefine: any; onDelegate: any; onHandoffToChat: any; showRefine: any; showDelegate: any; showHandoff: any; component: ComponentScore; findings: OptimizerFinding[] }) => {
    // FEAT-044 R9 / FEAT-041: offer edit actions only where the host would authorize them.
    const editable = (nodeId: string) => ctx.canEdit?.(nodeId) ?? true;
    const { onApplyFix, onDismissFinding, onOpenFile, chatHostName, assistStates, onAiRefine, onDelegate, onHandoffToChat, showRefine, showDelegate, showHandoff, component, findings } = ctx;
    return (
                                <div style={{ padding: `0 ${SPACE.md} ${SPACE.sm} ${SPACE.lg}`, display: 'flex', gap: SPACE.md, alignItems: 'flex-start' }}>
                                    <div style={{ flexShrink: 0, paddingTop: SPACE.sm }}>
                                        <DimensionRadar
                                            dimensions={component.dimensions}
                                            tier={component.tier}
                                            size={150}
                                            title={`${component.label} dimension balance`}
                                        />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                    <CoverageNote component={component} />
                                    {findings.length === 0 && (
                                        <div style={{ fontSize: '0.78em', color: 'var(--vscode-descriptionForeground)', padding: SPACE.sm }}>
                                            {component.score === null ? 'Not scored — no rule applies to this component\'s format.' : 'No findings — this component is clean.'}
                                        </div>
                                    )}
                                    {findings.map((f, i) => (
                                        <div
                                            key={`${f.ruleId}-${i}`}
                                            style={{
                                                display: 'flex', flexDirection: 'column', gap: SPACE.xs,
                                                padding: SPACE.sm, marginBottom: SPACE.xs, fontSize: '0.8em',
                                                border: '1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border))',
                                                borderRadius: '4px',
                                                background: 'var(--vscode-editorWidget-background, transparent)',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' }}>
                                                <SeverityPill value={f.severity} />
                                                <code style={{ fontSize: '0.9em', opacity: 0.75 }}>{f.ruleId}</code>
                                                <strong style={{ flex: 1 }}>{f.title}</strong>
                                                {f.source && (
                                                    <span data-finding-owner={f.source.providerId} style={{ opacity: 0.7 }}>
                                                        {frameworkLabel(f.source.providerId)}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ color: 'var(--vscode-descriptionForeground)' }}>{f.detail}</div>
                                            <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                                                {f.filePath && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenFile(f)}
                                                        style={btnLink}
                                                        title={f.line ? `Open at line ${f.line}` : 'Open file'}
                                                    >
                                                        {f.filePath}{f.line ? `:${f.line}` : ''}
                                                    </button>
                                                )}
                                                {!editable(f.nodeId) && (
                                                    <span data-read-only style={{ opacity: 0.7 }}>Read-only for its owner — open the file to change it yourself.</span>
                                                )}
                                                {editable(f.nodeId) && f.fix && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onApplyFix(f)}
                                                        style={btnPrimary}
                                                        title="Preview this fix in a diff before applying — nothing is written until you confirm"
                                                    >
                                                        {f.fix.label}…
                                                    </button>
                                                )}
                                                {editable(f.nodeId) && showRefine && (() => {
                                                    const key = `${f.ruleId}::${f.nodeId}`;
                                                    const st = assistStates[key];
                                                    const pending = st?.state === 'pending';
                                                    // R2: promoted only where there is no mechanical fix AND
                                                    // the rule involves judgement. A `fact` finding with no fix
                                                    // is a gap in our rules, not a question for a model.
                                                    const primary = !f.fix && f.confidence !== 'fact';
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => onAiRefine?.(f)}
                                                            disabled={pending}
                                                            style={{
                                                                ...(primary ? btnPrimary : btnSubtle),
                                                                opacity: pending ? 0.6 : 1,
                                                                cursor: pending ? 'default' : 'pointer',
                                                            }}
                                                            title="Ask the editor's model for a rewrite. You review it in a diff before anything is written."
                                                        >
                                                            {pending ? 'Refining…' : 'AI refine…'}
                                                        </button>
                                                    );
                                                })()}
                                                {editable(f.nodeId) && showHandoff && (
                                                    <AskHostButton
                                                        hostName={chatHostName}
                                                        onClick={() => onHandoffToChat?.(f)}
                                                        primary={!showRefine && !f.fix}
                                                        subject={`the fix prompt for ${f.ruleId}`}
                                                    />
                                                )}
                                                {editable(f.nodeId) && showDelegate && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onDelegate?.({ kind: 'finding', nodeId: f.nodeId, ruleId: f.ruleId })}
                                                        style={btnSubtle}
                                                        title="Hand this to a terminal agent. It edits files directly — there is no diff preview."
                                                    >
                                                        Delegate…
                                                    </button>
                                                )}
                                                {(() => {
                                                    const st = assistStates[`${f.ruleId}::${f.nodeId}`];
                                                    if (!st || st.state === 'idle' || st.state === 'pending') return null;
                                                    const good = st.state === 'ok';
                                                    return (
                                                        <span style={{
                                                            fontSize: '0.85em',
                                                            color: good ? TIER_COLORS.A : SEVERITY_PALETTE.error.fg,
                                                        }}>
                                                            {good ? '✓ applied' : `✕ ${st.reason ?? 'failed'}`}
                                                        </span>
                                                    );
                                                })()}
                                                <button
                                                    type="button"
                                                    onClick={() => onDismissFinding(f)}
                                                    style={{ ...btnSubtle, marginLeft: 'auto' }}
                                                    title="Hide this finding and exclude it from the score"
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    </div>
                                </div>
    );
};

/** FEAT-043 R2, R3: what was evaluated for this component, and why the rest was not. */
export const CoverageNote = ({ component }: { component: ComponentScore }) => {
    const { evaluated, skipped } = component.coverage ?? { evaluated: [], skipped: [] };
    return (
        <div data-coverage={evaluated.length} style={{ fontSize: '0.76em', color: 'var(--vscode-descriptionForeground)', padding: `${SPACE.xs} ${SPACE.sm}` }}>
            {`Evaluated ${evaluated.length} of 6 dimensions${evaluated.length ? ` (${evaluated.join(', ')})` : ''}`}
            {skipped.length > 0 && (
                <details>
                    <summary>{`Not evaluated: ${skipped.length} rule${skipped.length === 1 ? '' : 's'}`}</summary>
                    <ul style={{ margin: 0, paddingLeft: SPACE.md }}>
                        {skipped.map(s => <li key={s.ruleId}><code>{s.ruleId}</code> — {s.reason}</li>)}
                    </ul>
                </details>
            )}
        </div>
    );
};
