// FEAT-045 T1 — lazy first scan, hidden refresh, progress and state (R13–R16).
import { describe, expect, it, vi } from 'vitest';
import { ScanScheduler, type DashboardState } from './scanScheduler.js';

function make(empty = false) {
    const states: DashboardState[] = [];
    const effects = {
        scan: vi.fn(async () => ({ empty })),
        startWatchers: vi.fn(),
        setState: vi.fn((s: DashboardState) => { states.push(s); }),
        withProgress: vi.fn(async (task: () => Promise<void>) => task()),
    };
    return { scheduler: new ScanScheduler(effects, 5), effects, states };
}
const tick = (ms = 20) => new Promise(r => setTimeout(r, ms));

describe('ScanScheduler', () => {
    it('reports a failed scan as its own state, not as ready (R8)', async () => {
        const { scheduler, effects, states } = make();
        effects.scan.mockRejectedValueOnce(new Error('boom'));
        await scheduler.ensureScanned();
        expect(states).toEqual(['scanning', 'error']);
    });

    it('starts no scan after dispose, even when a change was pending', async () => {
        const { scheduler, effects } = make();
        let release!: () => void;
        effects.scan.mockImplementationOnce(() => new Promise(r => { release = () => r({ empty: false }); }));
        scheduler.setVisible('sources', true);
        await tick();
        scheduler.onChange();                 // during the first scan: marks stale
        scheduler.dispose();
        release();
        await tick(40);
        expect(effects.scan).toHaveBeenCalledTimes(1);
        await scheduler.refresh();
        expect(effects.scan).toHaveBeenCalledTimes(1);
    });

    it('does nothing on construction (activation)', () => {
        const { effects } = make();
        expect(effects.scan).not.toHaveBeenCalled();
        expect(effects.startWatchers).not.toHaveBeenCalled();
        expect(effects.setState).not.toHaveBeenCalled();
    });

    it.each(['sources-view', 'dashboard-panel'])('starts the first scan once when %s becomes visible, then the watchers', async surface => {
        const { scheduler, effects } = make();
        scheduler.setVisible(surface, true);
        scheduler.setVisible('findings-view', true);
        await scheduler.ensureScanned();
        expect(effects.scan).toHaveBeenCalledTimes(1);
        expect(effects.startWatchers).toHaveBeenCalledTimes(1);
        expect(effects.withProgress).toHaveBeenCalledTimes(1);
    });

    it('runs the first scan when a command needs data', async () => {
        const { scheduler, effects } = make();
        await scheduler.ensureScanned();
        await scheduler.ensureScanned();
        expect(effects.scan).toHaveBeenCalledTimes(1);
    });

    it('marks changes stale while hidden and rescans once when shown again', async () => {
        const { scheduler, effects } = make();
        scheduler.setVisible('sources-view', true);
        await scheduler.ensureScanned();
        scheduler.setVisible('sources-view', false);
        scheduler.onChange(); scheduler.onChange(); scheduler.onChange();
        await tick();
        expect(effects.scan).toHaveBeenCalledTimes(1);
        expect(scheduler.isStale).toBe(true);
        scheduler.setVisible('sources-view', true);
        await tick();
        expect(effects.scan).toHaveBeenCalledTimes(2);
        expect(scheduler.isStale).toBe(false);
    });

    it('debounces visible changes into one rescan', async () => {
        const { scheduler, effects } = make();
        scheduler.setVisible('dashboard-panel', true);
        await scheduler.ensureScanned();
        scheduler.onChange(); scheduler.onChange();
        await tick();
        expect(effects.scan).toHaveBeenCalledTimes(2);
    });

    it('moves the state through scanning to ready or empty', async () => {
        const ready = make(false);
        await ready.scheduler.ensureScanned();
        expect(ready.states).toEqual(['scanning', 'ready']);
        const empty = make(true);
        await empty.scheduler.ensureScanned();
        expect(empty.states).toEqual(['scanning', 'empty']);
        expect(empty.scheduler.currentState).toBe('empty');
    });

    it('ignores changes before the first scan', async () => {
        const { scheduler, effects } = make();
        scheduler.onChange();
        await tick();
        expect(effects.scan).not.toHaveBeenCalled();
    });
});

describe('explicit refresh', () => {
    it('scans now even when nothing is visible', async () => {
        const { scheduler, effects } = make();
        await scheduler.refresh();
        await scheduler.refresh();
        expect(effects.scan).toHaveBeenCalledTimes(2);
    });
});
