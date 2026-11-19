// The Dashboard webview's HTML shell and CSP (moved from HarnessDashboardProvider, FEAT-045).
import * as vscode from 'vscode';

/**
 * Generate the HTML for a Harness Dashboard webview (used by both sidebar and full-window panel).
 * A fresh cryptographic nonce is generated on every call so the CSP is unforgeable.
 */
export function dashboardHtml(extensionUri: vscode.Uri, webview: vscode.Webview, isFullWindow = false, tab?: string): string {
    // FEAT-045 R6: the tab to restore; only a plain identifier ever reaches the page.
    const initialTab = tab && /^[a-z]+$/.test(tab) ? tab : 'whiteboard';
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css'));
    const nonceBytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(nonceBytes);
    const nonce = btoa(Array.from(nonceBytes).map(b => String.fromCharCode(b)).join(''));

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy"
                  content="default-src 'none'; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:;">
            <link href="${styleUri}" rel="stylesheet">
            <title>Harness Dashboard</title>
        </head>
        <body>
            <div id="root"></div>
            <script nonce="${nonce}">window.__harness_is_full_window = ${isFullWindow}; window.__harness_initial_tab = "${initialTab}";</script>
            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
}
