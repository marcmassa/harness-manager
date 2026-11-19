// FEAT-041 T3 (R3) — provider, native path and operation availability of the
// selected resource. Renders the host's decisions; it never computes its own.
import * as React from 'react';
import type { ResourceOwnership } from '../../operations/operationGate.js';
import { SPACE } from '../styles.js';

const LEVEL_LABEL: Record<string, string> = { supported: 'Supported', partial: 'Partial', unsupported: 'Unsupported' };

export const SourceOwnershipSection = ({ ownership }: { ownership?: ResourceOwnership }) => {
    if (!ownership) return null;
    const { providerLabel, nativePath, operations, capabilities } = ownership;
    return (
        <section aria-label="Source and operations" style={{ marginBottom: SPACE.md, fontSize: '0.9em' }}>
            <div style={{ fontSize: '0.8em', fontWeight: 600, opacity: 0.7, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: SPACE.xs }}>
                Source
            </div>
            <div><strong>Provider:</strong> {providerLabel ?? 'Unknown'}</div>
            <div style={{ wordBreak: 'break-all' }}><strong>Native path:</strong> {nativePath ?? 'Not file-backed'}</div>
            {capabilities && (
                <div style={{ opacity: 0.8, marginTop: SPACE.xs }}>
                    Editing {LEVEL_LABEL[capabilities.editing]} · Agent runs {LEVEL_LABEL[capabilities.agentRuns]}
                </div>
            )}
            <ul style={{ listStyle: 'none', padding: 0, margin: `${SPACE.xs} 0 0` }}>
                {operations.map(op => (
                    <li key={op.op} data-operation={op.op} data-available={op.available} style={{ display: 'flex', gap: SPACE.xs, alignItems: 'baseline' }}>
                        <span aria-hidden="true">{op.available ? '✓' : '—'}</span>
                        <span>
                            {op.label}
                            {op.viewLocal && <span style={{ opacity: 0.7 }}> (view only, not written to files)</span>}
                            {!op.available && op.reason && <span style={{ opacity: 0.7 }}>: {op.reason}</span>}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
};

/** Whether the host allows `op` for this resource; unknown ownership means not allowed. */
export function canPerform(ownership: ResourceOwnership | undefined, op: string): boolean {
    return ownership?.operations.find(o => o.op === op)?.available === true;
}
