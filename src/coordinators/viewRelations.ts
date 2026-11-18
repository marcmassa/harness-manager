// View-only relationships: kept in workspace state, never written to a
// harness file (cross-owner links under FEAT-041, non-`uses` labels).
import type * as vscode from 'vscode';

export type CustomUsesEdge = { source: string; target: string };
export type CustomEdge = { source: string; target: string; label: string };

export const CUSTOM_USES_EDGES_KEY = 'harness-dashboard.customUsesEdges';
export const CUSTOM_EDGES_KEY = 'harness-dashboard.customEdges';

export async function upsertUsesEdge(state: vscode.Memento, source: string, target: string): Promise<void> {
    if (!source || !target || source === target) return;
    const current = state.get<CustomUsesEdge[]>(CUSTOM_USES_EDGES_KEY, []);
    if (current.some((edge) => edge.source === source && edge.target === target)) return;
    await state.update(CUSTOM_USES_EDGES_KEY, [...current, { source, target }]);
}

export async function upsertEdge(state: vscode.Memento, source: string, target: string, label: string): Promise<void> {
    if (!source || !target || source === target) return;
    const current = state.get<CustomEdge[]>(CUSTOM_EDGES_KEY, []);
    if (current.some(e => e.source === source && e.target === target && e.label === label)) return;
    await state.update(CUSTOM_EDGES_KEY, [...current, { source, target, label }]);
}

export async function removeUsesEdge(state: vscode.Memento, source: string, target: string): Promise<void> {
    const current = state.get<CustomUsesEdge[]>(CUSTOM_USES_EDGES_KEY, []);
    const updated = current.filter(
        (edge) => !((edge.source === source && edge.target === target) ||
                    (edge.source === target && edge.target === source))
    );
    if (updated.length !== current.length) {
        await state.update(CUSTOM_USES_EDGES_KEY, updated);
    }
}

export async function removeEdge(state: vscode.Memento, source: string, target: string, label: string): Promise<void> {
    const current = state.get<CustomEdge[]>(CUSTOM_EDGES_KEY, []);
    const updated = current.filter(
        e => !((e.source === source && e.target === target && e.label === label) ||
               (e.source === target && e.target === source && e.label === label))
    );
    if (updated.length !== current.length) {
        await state.update(CUSTOM_EDGES_KEY, updated);
    }
}
