// FEAT-045 T2 (R17) — every contributed command resolves even without a folder.
// Workspace commands are hidden from the palette by `workspaceFolderCount > 0`;
// invoked anyway (a keybinding, another extension), each shows one message.
import * as vscode from 'vscode';

export const FOLDERLESS_MESSAGE = 'Harness Dashboard: open a folder to use this command.';

/** Command IDs that work without a workspace folder. */
export const FOLDERLESS_OK = new Set(['harness-dashboard.checkLM', 'harness-dashboard.openSettings']);

/** R7: the view overflow's settings action; works with or without a folder. */
export function registerOpenSettings(context: vscode.ExtensionContext): void {
    context.subscriptions.push(vscode.commands.registerCommand('harness-dashboard.openSettings',
        () => vscode.commands.executeCommand('workbench.action.openSettings', '@ext:marcmassacapo.harness-dashboard-vscode')));
}

export function contributedCommandIds(context: vscode.ExtensionContext): string[] {
    const contributed = (context.extension?.packageJSON?.contributes?.commands ?? []) as Array<{ command: string }>;
    return contributed.map(c => c.command);
}

export function registerFolderlessCommands(
    context: vscode.ExtensionContext,
    ids: readonly string[],
    show: (message: string) => unknown = message => vscode.window.showInformationMessage(message),
): void {
    for (const id of ids) {
        if (FOLDERLESS_OK.has(id)) continue;
        context.subscriptions.push(vscode.commands.registerCommand(id, () => { show(FOLDERLESS_MESSAGE); }));
    }
}
