import * as vscode from 'vscode';
import { runCodeQualityHooks, type HookReport, type CodeQualityIssue } from './codeQualityRunner.js';

export interface CodeQualitySetup {
    disposable: vscode.Disposable;
    runManual: (uri?: vscode.Uri) => Promise<void>;
}

const TS_SOURCE_GLOB_SUFFIX = /(^|\/)src\/.+\.(ts|tsx)$/;

export function setupCodeQualityVerifier(root: vscode.Uri, log: vscode.LogOutputChannel): CodeQualitySetup | null {
    const cfg = () => vscode.workspace.getConfiguration('harness-dashboard.codeQuality');
    const diagnostics = vscode.languages.createDiagnosticCollection('harness-code-quality');
    log.info('[codeQuality] verifier initialised');

    function shouldVerify(doc: vscode.TextDocument): boolean {
        if (!cfg().get<boolean>('verifyOnSave', true)) return false;
        if (doc.languageId !== 'typescript' && doc.languageId !== 'typescriptreact') return false;
        const rel = vscode.workspace.asRelativePath(doc.uri, false);
        return TS_SOURCE_GLOB_SUFFIX.test(rel.replace(/\\/g, '/'));
    }

    function readOptions() {
        return {
            kissEnabled: cfg().get<boolean>('kissEnabled', true),
            dryEnabled: cfg().get<boolean>('dryEnabled', true),
            severity: cfg().get<'warning' | 'error'>('severity', 'warning'),
        };
    }

    async function runAndReport(doc: vscode.TextDocument): Promise<HookReport[]> {
        const rel = vscode.workspace.asRelativePath(doc.uri, false);
        const reports = await runCodeQualityHooks(rel, root.fsPath, readOptions());
        const allIssues: Array<CodeQualityIssue & { hook: 'harness-kiss' | 'harness-dry' }> = [];
        for (const r of reports) {
            for (const issue of r.issues) {
                allIssues.push({ ...issue, hook: r.hook });
            }
        }
        diagnostics.set(doc.uri, allIssues.map(toDiagnostic));
        if (reports.length > 0) {
            const summary = reports.map(r =>
                `${r.hook}: ${r.issues.length} issue${r.issues.length === 1 ? '' : 's'}`).join(', ');
            log.info(`[codeQuality] ${rel} — ${summary}`);
        }
        return reports;
    }

    const willSave = vscode.workspace.onWillSaveTextDocument(async (event) => {
        if (!shouldVerify(event.document)) return;
        if (!cfg().get<boolean>('blockOnSave', false)) return;
        const reports = await runAndReport(event.document);
        const hasError = reports.some(r => r.issues.some(i => i.severity === 'error'));
        if (hasError) {
            vscode.window.showWarningMessage(
                `Harness Dashboard: code quality errors detected in ${event.document.fileName.split('/').pop()}. Save cancelled.`
            );
            event.waitUntil(Promise.resolve([]));
        }
    });

    const didSave = vscode.workspace.onDidSaveTextDocument(async (doc) => {
        if (!shouldVerify(doc)) return;
        await runAndReport(doc);
    });

    return {
        disposable: vscode.Disposable.from(willSave, didSave, diagnostics),
        runManual: async (uri?: vscode.Uri) => {
            const target = uri ?? await pickTsFile();
            if (!target) return;
            const doc = await vscode.workspace.openTextDocument(target);
            await runAndReport(doc);
            log.show(true);
        },
    };
}

async function pickTsFile(): Promise<vscode.Uri | undefined> {
    const files = await vscode.workspace.findFiles('src/**/*.{ts,tsx}', '**/node_modules/**');
    if (files.length === 0) return undefined;
    const picks = files.map(f => ({ label: vscode.workspace.asRelativePath(f), uri: f }));
    const selected = await vscode.window.showQuickPick(picks, { placeHolder: 'Pick a TS/TSX file to verify' });
    return selected?.uri;
}

function toDiagnostic(issue: CodeQualityIssue & { hook: 'harness-kiss' | 'harness-dry' }): vscode.Diagnostic {
    const range = new vscode.Range(
        Math.max(0, issue.line - 1), 0,
        Math.max(0, issue.line - 1), Number.MAX_SAFE_INTEGER,
    );
    const severity = issue.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;
    const diag = new vscode.Diagnostic(range, `[${issue.hook}] ${issue.message}`, severity);
    diag.source = issue.hook;
    diag.code = issue.id;
    return diag;
}
