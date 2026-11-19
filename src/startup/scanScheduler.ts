// FEAT-045 T1 — no work before the user looks (R12–R16).
// Pure apart from the injected effects: activation constructs this and does
// nothing else. The first scan starts when a Harness view or the Dashboard
// panel becomes visible, or a command needs results; watchers start after it.
// While nothing is visible, changes only mark results stale.

export type DashboardState = 'noFolder' | 'scanning' | 'empty' | 'ready';

export interface SchedulerEffects {
    /** Load profiles, parse, scan Advisory and Optimizer. Resolves to whether any provider was found. */
    scan(): Promise<{ empty: boolean }>;
    /** Start file watchers once; every event must go to `onChange`. */
    startWatchers(): void;
    setState(state: DashboardState): void;
    /** Report progress on the Harness views (never a notification). */
    withProgress(task: () => Promise<void>): Promise<void>;
    log?(message: string): void;
}

export class ScanScheduler {
    private readonly visible = new Set<string>();
    private firstScan: Promise<void> | null = null;
    private running: Promise<void> | null = null;
    private stale = false;
    private watching = false;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private state: DashboardState = 'scanning';

    public constructor(private readonly effects: SchedulerEffects, private readonly debounceMs = 300) {}

    public get currentState(): DashboardState { return this.state; }
    public get hasScanned(): boolean { return this.firstScan !== null; }
    public get isStale(): boolean { return this.stale; }

    private set(state: DashboardState): void {
        this.state = state;
        this.effects.setState(state);
    }

    /** A view or the panel was shown or hidden. */
    public setVisible(surface: string, isVisible: boolean): void {
        if (isVisible) this.visible.add(surface);
        else this.visible.delete(surface);
        if (!isVisible) return;
        if (!this.firstScan) void this.ensureScanned();
        else if (this.stale) this.rescanSoon();
    }

    /** A command needs results: run the first scan if none happened yet. */
    public ensureScanned(): Promise<void> {
        if (!this.firstScan) {
            this.firstScan = this.run().then(() => {
                if (!this.watching) {
                    this.watching = true;
                    this.effects.startWatchers();
                }
            });
        }
        return this.firstScan;
    }

    /** A watched file, the profile or the provider set changed. */
    public onChange(): void {
        if (!this.firstScan) return;          // nothing scanned yet: the first scan will see it
        if (this.visible.size === 0) {        // R15: hidden — remember, do not work
            this.stale = true;
            return;
        }
        this.rescanSoon();
    }

    private rescanSoon(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => { this.timer = null; void this.run(); }, this.debounceMs);
    }

    private run(): Promise<void> {
        if (this.running) {                   // coalesce: one scan at a time, rerun once after
            this.stale = true;
            return this.running;
        }
        this.stale = false;
        this.set('scanning');
        this.running = this.effects.withProgress(async () => {
            try {
                const { empty } = await this.effects.scan();
                this.set(empty ? 'empty' : 'ready');
            } catch (error) {
                this.effects.log?.(`[Startup] scan failed: ${String(error)}`);
                this.set('ready');
            }
        }).finally(() => {
            this.running = null;
            if (this.stale && this.visible.size > 0) this.rescanSoon();
        });
        return this.running;
    }

    public dispose(): void {
        if (this.timer) clearTimeout(this.timer);
    }
}
