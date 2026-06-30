// FEAT-033: RunAdapterRegistry — detects available CLI adapters and caches results
import type { RunAdapter } from './types.js';

export class RunAdapterRegistry {
    private _adapters: RunAdapter[];
    private _available: RunAdapter[] | null = null;

    constructor(adapters: RunAdapter[]) {
        this._adapters = adapters;
    }

    /** Detect available adapters. Results are cached until forceRefresh() is called. */
    async detect(): Promise<RunAdapter[]> {
        if (this._available !== null) {
            return this._available;
        }
        const results = await Promise.all(
            this._adapters.map(async a => ({ a, ok: await a.isAvailable() }))
        );
        this._available = results.filter(r => r.ok).map(r => r.a);
        return this._available;
    }

    /** Invalidate detection cache — next detect() call will re-check binaries. */
    forceRefresh(): void {
        this._available = null;
    }

    /** Look up an adapter by id (searches all registered adapters, not just available). */
    getById(id: string): RunAdapter | undefined {
        return this._adapters.find(a => a.id === id);
    }
}
