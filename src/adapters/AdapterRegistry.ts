import * as vscode from 'vscode';
import { ParserResult } from '../types.js';
import { mergeResults, IAgentAdapter } from './IAgentAdapter.js';

interface WarnLogger {
    warn(message: string): void;
}

export class AdapterRegistry {
    constructor(
        private readonly adapters: IAgentAdapter[],
        private readonly logger?: WarnLogger
    ) {}

    public getAdapters(): IAgentAdapter[] {
        return [...this.adapters];
    }

    public watchGlobs(): string[] {
        const globs = this.adapters.flatMap((adapter) => adapter.watchGlobs());
        return Array.from(new Set(globs));
    }

    public async detect(root: vscode.Uri): Promise<string[]> {
        const detected: string[] = [];

        for (const adapter of this.adapters) {
            try {
                const isDetected = await adapter.detect(root);
                if (isDetected) detected.push(adapter.id());
            } catch (error: any) {
                this.logger?.warn(`[${adapter.id()}] detect failed: ${error?.message ?? String(error)}`);
            }
        }

        return detected;
    }

    public async parse(root: vscode.Uri): Promise<ParserResult> {
        const partials: Partial<ParserResult>[] = [];
        const detectedFrameworks: string[] = [];

        for (const adapter of this.adapters) {
            let isDetected = false;
            try {
                isDetected = await adapter.detect(root);
            } catch (error: any) {
                this.logger?.warn(`[${adapter.id()}] detect failed: ${error?.message ?? String(error)}`);
                continue;
            }

            if (!isDetected) continue;

            try {
                const parsed = await adapter.parse(root);
                partials.push(parsed);
                detectedFrameworks.push(adapter.label());
            } catch (error: any) {
                this.logger?.warn(`[${adapter.id()}] parse failed: ${error?.message ?? String(error)}`);
            }
        }

        const merged = mergeResults(partials);
        merged.detectedFrameworks = Array.from(new Set(detectedFrameworks));
        return merged;
    }
}
