// FEAT-044 T3 — context cost in the Optimizer panel (R4, R5, R7, R10).
import * as React from 'react';
import type { CostSection as Cost } from '../cost/costSection.js';
import { frameworkLabel } from '../frameworks.js';
import { SPACE } from './optimizerParts.js';
import { vscode } from './vscodeApi.js';
import type { CostComparison } from '../cost/baselineDiff.js';

const tok = (n: number) => `~${n.toLocaleString('en')} tok`;

const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('en')} tok`;

/** FEAT-044 R13, R14: the change per provider and resource since git HEAD. */
export const HeadComparison = ({ comparison }: { comparison: CostComparison }) => (
    !comparison.available
        ? <div data-cost-comparison="unavailable">{`Comparison unavailable: ${comparison.reason}`}</div>
        : <div data-cost-comparison="available">
            {comparison.owners.map(o => (
                <div key={o.owner}>{`${frameworkLabel(o.owner)} since HEAD: ${signed(o.delta)} per session (${o.sessionAtHead} → ${o.sessionNow})`}</div>
            ))}
            {comparison.resources.map(r => (
                <div key={r.nodeId} style={{ color: 'var(--vscode-descriptionForeground)' }}>{`${r.filePath}: ${r.status}, ${signed(r.delta)}`}</div>
            ))}
            {comparison.owners.length === 0 && <div>No cost change since HEAD.</div>}
        </div>
);

export const CostSection = ({ cost }: { cost?: Cost }) => {
    const [comparison, setComparison] = React.useState<CostComparison | null>(null);
    React.useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.data?.type === 'costComparison') setComparison(event.data.comparison as CostComparison);
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);
    if (!cost || cost.owners.length === 0) return null;
    return (
        <section aria-label="Context cost" data-cost-total={cost.sessionTotal} style={{ padding: `${SPACE.xs} ${SPACE.md}`, borderBottom: '1px solid var(--vscode-panel-border)', fontSize: '0.78em' }}>
            <div style={{ fontWeight: 700 }}>{`Context cost per session: ${tok(cost.sessionTotal)} (estimate)`}</div>
            {cost.owners.map(o => (
                <div key={o.owner} data-cost-owner={o.owner} style={{ color: 'var(--vscode-descriptionForeground)' }}>
                    {o.evaluated
                        ? `${frameworkLabel(o.owner)}: always ${tok(o.baseline)} · catalog ${tok(o.catalog)} · on demand ${o.onDemand.length} item${o.onDemand.length === 1 ? '' : 's'} (${tok(o.onDemand.reduce((s, r) => s + r.tokens, 0))})`
                        : `${frameworkLabel(o.owner)}: not evaluated — ${o.missingEvidence}`}
                    {o.unpriced.length > 0 && ` · unpriced ${o.unpriced.length} (${tok(o.unpriced.reduce((s, r) => s + r.tokens, 0))}, load mode unknown)`}
                </div>
            ))}
            {cost.inference && cost.inference.actions > 0 && (
                <div data-cost-inference style={{ color: 'var(--vscode-descriptionForeground)' }}>
                    {`Dashboard AI actions here: ${cost.inference.actions} · input ${tok(cost.inference.inputTokens)} · output ${tok(cost.inference.outputTokens)} (${cost.inference.reportedEntries} reported by the provider, the rest estimated)`}
                </div>
            )}
            {cost.money.map(m => (
                <div key={`${m.owner}:${m.model}`} data-cost-money={m.model}>
                    {`≈ ${m.perSession.toFixed(4)} per ${frameworkLabel(m.owner)} session on ${m.model} (estimate; prices as of ${m.priceDate}; calibration ×${m.factor}${m.calibrated ? '' : ', none configured'})`}
                </div>
            ))}
            <button type="button" onClick={() => vscode.postMessage?.({ type: 'compareCostWithHead' })}
                title="Compare each provider's session cost with the files at git HEAD (read-only)"
                style={{ marginTop: SPACE.xs, fontSize: '0.95em' }}>
                Compare with HEAD
            </button>
            {comparison && <HeadComparison comparison={comparison} />}
        </section>
    );
};
