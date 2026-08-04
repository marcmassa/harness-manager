import * as vscode from 'vscode';

/**
 * Open a file in the VS Code editor given a workspace root and a relative/absolute path.
 *
 * @param line 1-based line to reveal and place the cursor on (FEAT-034 R42).
 *             Omitted or out of range → the file opens at the top, unchanged.
 */
export async function openFileInEditor(
    workspaceRoot: vscode.Uri,
    filePath: string,
    line?: number,
): Promise<void> {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const fileUri = /^([a-zA-Z]:\/|\/)/.test(normalizedPath)
        ? vscode.Uri.file(normalizedPath)
        : vscode.Uri.joinPath(workspaceRoot, normalizedPath);
    try {
        await vscode.workspace.fs.stat(fileUri);
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const options: vscode.TextDocumentShowOptions = { preserveFocus: true };
        if (typeof line === 'number' && Number.isFinite(line) && line >= 1) {
            // Clamp: a stale finding may point past the end of an edited file.
            const zeroBased = Math.min(Math.floor(line) - 1, Math.max(doc.lineCount - 1, 0));
            const position = new vscode.Position(zeroBased, 0);
            options.selection = new vscode.Range(position, position);
        }
        await vscode.window.showTextDocument(doc, options);
    } catch {
        vscode.window.showWarningMessage(`File not found: ${filePath}`);
    }
}
