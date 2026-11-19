// FEAT-047 R5 — which Dashboard tabs exist for the current scan. The Specs
// Manager appears only when some provider supplied feature or spec data;
// a restored or requested tab that is not available falls back to the whiteboard.
import type { DashboardData } from '../types.js';

export type DashboardTab = 'whiteboard' | 'timeline' | 'advisory' | 'optimizer';
const ALL_TABS: readonly DashboardTab[] = ['whiteboard', 'timeline', 'advisory', 'optimizer'];

export function specsAvailable(data: DashboardData | null): boolean {
    return !!data && (data.milestones.length > 0 || data.graph.nodes.some(n => n.type === 'feature'));
}

/**
 * `specsRequested`: the user explicitly asked to create a spec (the wizard's
 * "Generate spec"), which is how a first feature comes to exist — the tab is
 * shown for that even before any feature data.
 */
export function availableTabs(data: DashboardData | null, specsRequested = false): DashboardTab[] {
    return ALL_TABS.filter(tab => tab !== 'timeline' || specsRequested || specsAvailable(data));
}

/** The tab to show for a requested one. Before the first data arrives, any known tab is kept. */
export function resolveTab(requested: string, data: DashboardData | null, specsRequested = false): DashboardTab {
    const known = (ALL_TABS as readonly string[]).includes(requested) ? requested as DashboardTab : 'whiteboard';
    return data && !availableTabs(data, specsRequested).includes(known) ? 'whiteboard' : known;
}
