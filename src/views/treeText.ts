// FEAT-046 T3 (R6–R8, R10, R11) — descriptions and Markdown tooltips for the
// Sources and Findings items. Every user-derived string is escaped (R10).
import type { FindingItem, FindingResource, ProviderGroup, ResourceItem } from './treeModels.js';

/** Escape Markdown so a file name or provider label cannot inject formatting or links. */
export function md(text: string): string {
    return text.replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, '\\$&').replace(/\r?\n/g, '  \n');
}

/** R6: `~640 tok`, `~1.2k tok`, `~12k tok`. */
export function formatTokens(n: number): string {
    if (!Number.isFinite(n)) return '~? tok';
    // Round first, then pick the form, so 999.6 is ~1.0k and 9,960 is ~10k.
    if (Math.round(n) < 1000) return `~${Math.round(n)} tok`;
    const tenths = Math.round(n / 100) / 10;
    if (tenths < 10) return `~${tenths.toFixed(1)}k tok`;
    return `~${Math.round(n / 1000)}k tok`;
}

const knownMode = (mode?: string) => (mode && mode !== 'unknown' ? mode : undefined);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** R6: type, load mode, token estimate and score, leaving out each unknown part. */
export function resourceDescription(r: ResourceItem): string {
    return [r.type, knownMode(r.loadMode), r.tokens !== undefined ? formatTokens(r.tokens) : undefined, r.score !== undefined ? String(r.score) : undefined]
        .filter(Boolean).join(' · ');
}

export function resourceTooltip(r: ResourceItem): string {
    const lines = [`**${md(r.label)}**`];
    if (r.nativePath) lines.push(md(r.nativePath));
    lines.push([r.ownerLabel ? `Owner: ${md(r.ownerLabel)}` : undefined, `Type: ${md(r.type)}`, knownMode(r.loadMode) ? `Load mode: ${md(r.loadMode!)}` : undefined].filter(Boolean).join(' · '));
    const metrics = [
        r.tokens !== undefined ? formatTokens(r.tokens).replace(/ tok$/, ' tokens') : undefined,
        r.score !== undefined ? `Score ${r.score}${r.tier ? ` (${md(r.tier)})` : ''}` : undefined,
        r.findingCount !== undefined ? plural(r.findingCount, 'finding') : undefined,
    ].filter(Boolean);
    if (metrics.length) lines.push(metrics.join(' · '));
    if (r.capabilities) lines.push(`Editing ${md(r.capabilities.editing)} · Agent runs ${md(r.capabilities.agentRuns)}`);
    for (const d of r.denied) lines.push(`Not available — ${md(d.label)}: ${md(d.reason)}`);
    return lines.join('\n\n');
}

/** R7: resource count and, when evaluated, the per-session cost (baseline + catalog). */
export function providerDescription(g: ProviderGroup): string {
    const count = plural(g.resources.length, 'resource');
    if (!g.cost) return count;
    if (!g.cost.evaluated) return `${count} · cost not evaluated`;
    return `${count} · ${formatTokens(g.cost.baseline + g.cost.catalog)}/session`;
}

export function providerTooltip(g: ProviderGroup): string {
    const lines = [`**${md(g.label)}**`, plural(g.resources.length, 'resource')];
    if (g.cost && !g.cost.evaluated) lines.push(`Cost not evaluated${g.cost.reason ? `: ${md(g.cost.reason)}` : ': no load mode is declared'}`);
    else if (g.cost) {
        lines.push(`Per session: ${formatTokens(g.cost.baseline + g.cost.catalog)}`);
        lines.push(`Baseline ${formatTokens(g.cost.baseline)} · Catalog ${formatTokens(g.cost.catalog)} · On demand ${formatTokens(g.cost.onDemand)} · Unpriced ${formatTokens(g.cost.unpriced)}`);
    }
    return lines.join('\n\n');
}

/** R8: the finding count. */
export function findingResourceDescription(r: FindingResource): string {
    return plural(r.findings.length, 'finding');
}

export function findingTooltip(f: FindingItem): string {
    const head = [md(f.ruleId), f.severity, f.dimension ? md(f.dimension) : undefined].filter(Boolean).join(' · ');
    const lines = [`**${md(f.label)}**`, head, md(f.detail)];
    if (f.path) lines.push(`${md(f.path)}${f.line ? `:${f.line}` : ''}`);
    return lines.join('\n\n');
}
