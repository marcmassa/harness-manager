// Single VS Code API acquisition for the webview (acquireVsCodeApi may run once).
// ===== SINGLE VS Code API acquisition — shared globally =====
let _vscode: any = null;
try {
    _vscode = (window as any).acquireVsCodeApi?.() ?? (window as any).vscode ?? {};
} catch (e) {
    _vscode = {};
}
export const vscode = _vscode;
(window as any).__harness_vscode_api = vscode;
