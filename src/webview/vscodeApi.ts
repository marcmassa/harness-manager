// Single VS Code API acquisition for the webview (acquireVsCodeApi may run once).
// ===== SINGLE VS Code API acquisition — shared globally =====
let _vscode: any = null;
try {
    const w: any = typeof window !== 'undefined' ? window : {}; // window is absent in unit tests
    _vscode = w.acquireVsCodeApi?.() ?? w.vscode ?? {};
} catch (e) {
    _vscode = {};
}
export const vscode = _vscode;
if (typeof window !== 'undefined') (window as any).__harness_vscode_api = vscode;
