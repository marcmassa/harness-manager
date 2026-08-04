// FEAT-034 — Component Optimizer — diff preview virtual document (design.md §H, R33)
//
// DEVIATION from design.md: the design calls this "a TextDocumentContentProvider
// on the harness-optimizer scheme", which is a `vscode.TextDocumentContentProvider`
// — a type that lives in the 'vscode' module. Importing 'vscode' here would
// violate this task's hard, non-negotiable constraint ("Nothing in
// src/optimizer/ may import vscode"). Instead, OptimizerDiffProvider is
// written as a plain class whose `provideTextDocumentContent` method is
// *structurally* compatible with vscode.TextDocumentContentProvider (it
// takes anything with `.toString()` and returns `string | undefined`), so
// Group E's extension.ts can register an instance of this class directly
// with `vscode.workspace.registerTextDocumentContentProvider` without any
// adapter shim. That registration, and the `harness-optimizer:` URI
// scheme itself, belong to extension.ts (Group E, out of this module's
// scope) — this file only owns the in-memory staging Map.

/** Anything with a stable string identity — a real vscode.Uri satisfies this. */
export interface UriLike {
    toString(): string;
}

export class OptimizerDiffProvider {
    private readonly store = new Map<string, string>();

    /** Stage `content` to be served for `uri` until cleared. */
    stage(uri: UriLike, content: string): void {
        this.store.set(uri.toString(), content);
    }

    /** Drop any staged content for `uri` (call after the user accepts/declines). */
    clear(uri: UriLike): void {
        this.store.delete(uri.toString());
    }

    /** vscode.TextDocumentContentProvider-compatible read. */
    provideTextDocumentContent(uri: UriLike): string | undefined {
        return this.store.get(uri.toString());
    }
}
