import * as vscode from 'vscode';

/**
 * Open a file in the VS Code editor given a workspace root and a relative/absolute path.
 */
export async function openFileInEditor(workspaceRoot: vscode.Uri, filePath: string): Promise<void> {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const fileUri = /^([a-zA-Z]:\/|\/)/.test(normalizedPath)
        ? vscode.Uri.file(normalizedPath)
        : vscode.Uri.joinPath(workspaceRoot, normalizedPath);
    try {
        await vscode.workspace.fs.stat(fileUri);
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc, { preserveFocus: true });
    } catch {
        vscode.window.showWarningMessage(`File not found: ${filePath}`);
    }
}
