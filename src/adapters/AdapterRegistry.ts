import * as vscode from 'vscode';
import { ParserError, ParserResult } from '../types.js';
import { attributeSources, type ProviderResult } from './sourceGraph.js';
import { mergeResults, IAgentAdapter } from './IAgentAdapter.js';
import { validateProfiles } from './profileV1.js';
import { ProfileAdapter, type RealPathResolver } from './ProfileAdapter.js';

interface WarnLogger {
    warn(message: string): void;
}

export interface Disposable { dispose(): void }

/**
 * One workspace-scoped set of providers shared by the parser and the detector
 * (FEAT-041). Built-in adapters are fixed at construction; companion adapters
 * register and dispose at runtime; profile providers are rebuilt from the
 * workspace config. Every change notifies listeners so both consumers rescan.
 */
export class AdapterRegistry {
    private readonly companions: IAgentAdapter[] = [];
    private profiles: ProfileAdapter[] = [];
    private profileDiagnostics: ParserError[] = [];
    private rawProfiles: unknown;
    private readonly listeners = new Set<() => void>();

    constructor(
        private readonly adapters: IAgentAdapter[],
        private readonly logger?: WarnLogger,
        private readonly realPath?: RealPathResolver,
    ) {}

    public getAdapters(): IAgentAdapter[] {
        return [...this.adapters, ...this.companions, ...this.profiles];
    }

    public onDidChange(listener: () => void): Disposable {
        this.listeners.add(listener);
        return { dispose: () => { this.listeners.delete(listener); } };
    }

    /**
     * Register an installed provider. Throws on an ID already used by a
     * built-in or companion provider; a workspace profile with that ID is
     * displaced (installed code wins over workspace content).
     */
    public register(adapter: IAgentAdapter): Disposable {
        const id = adapter.id();
        if ([...this.adapters, ...this.companions].some(a => a.id() === id)) {
            throw new Error(`Harness Dashboard: provider ID "${id}" is already registered`);
        }
        this.companions.push(adapter);
        this.rebuildProfiles();
        this.fire();
        let disposed = false;
        return {
            dispose: () => {
                if (disposed) return;
                disposed = true;
                const index = this.companions.indexOf(adapter);
                if (index >= 0) this.companions.splice(index, 1);
                this.rebuildProfiles();
                this.fire();
            },
        };
    }

    /** Replace the workspace profiles with `config.profiles` (raw, unvalidated). */
    public setProfiles(raw: unknown): void {
        this.rawProfiles = raw;
        this.rebuildProfiles();
        this.fire();
    }

    public watchGlobs(): string[] {
        const globs = this.getAdapters().flatMap((adapter) => {
            try {
                return adapter.watchGlobs();
            } catch (error: any) {
                this.logger?.warn(`[${adapter.id()}] watchGlobs failed: ${error?.message ?? String(error)}`);
                return [];
            }
        });
        return Array.from(new Set(globs));
    }

    public async detect(root: vscode.Uri): Promise<string[]> {
        const detected: string[] = [];

        for (const adapter of this.getAdapters()) {
            try {
                const isDetected = await adapter.detect(root);
                if (isDetected) detected.push(adapter.id());
            } catch (error: any) {
                this.logger?.warn(`[${adapter.id()}] detect failed: ${error?.message ?? String(error)}`);
            }
        }

        return detected;
    }

    public async parse(root: vscode.Uri, token?: vscode.CancellationToken): Promise<ParserResult> {
        const partials: ProviderResult[] = [];
        const detectedFrameworks: string[] = [];
        const errors: ParserError[] = [...this.profileDiagnostics];

        for (const adapter of this.getAdapters()) {
            if (token?.isCancellationRequested) break;
            // A provider disposed while this scan was running is not called again.
            if (!this.isRegistered(adapter)) continue;
            let isDetected = false;
            try {
                isDetected = await adapter.detect(root);
            } catch (error: any) {
                this.logger?.warn(`[${adapter.id()}] detect failed: ${error?.message ?? String(error)}`);
                continue;
            }

            if (!isDetected || !this.isRegistered(adapter)) continue;

            try {
                const parsed = await adapter.parse(root, token);
                if (!this.isRegistered(adapter)) continue;
                partials.push({ providerId: adapter.id(), result: parsed });
                detectedFrameworks.push(adapter.label());
            } catch (error: any) {
                const message = error?.message ?? String(error);
                this.logger?.warn(`[${adapter.id()}] parse failed: ${message}`);
                errors.push({ file: adapter.id(), message: `[${adapter.id()}] parse failed: ${message}` });
            }
        }

        const merged = mergeResults(attributeSources(root, partials));
        merged.errors.push(...errors);
        merged.detectedFrameworks = Array.from(new Set(detectedFrameworks));
        return merged;
    }

    private isRegistered(adapter: IAgentAdapter): boolean {
        return this.adapters.includes(adapter) || this.companions.includes(adapter)
            || this.profiles.includes(adapter as ProfileAdapter);
    }

    private rebuildProfiles(): void {
        const reserved = new Set([...this.adapters, ...this.companions].map(a => a.id()));
        const { profiles, diagnostics } = validateProfiles(this.rawProfiles, reserved);
        this.profiles = profiles.map(profile => new ProfileAdapter(profile, this.realPath));
        this.profileDiagnostics = diagnostics;
    }

    private fire(): void {
        for (const listener of [...this.listeners]) {
            try { listener(); } catch (error: any) {
                this.logger?.warn(`[AdapterRegistry] change listener failed: ${error?.message ?? String(error)}`);
            }
        }
    }
}
