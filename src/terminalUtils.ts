import * as vscode from 'vscode';

/**
 * Send a command to a terminal without racing its shell.
 *
 * `vscode.window.createTerminal()` returns before the shell process has finished
 * starting. An immediate `sendText` is typed into a shell that is not listening
 * yet and is silently swallowed: the terminal opens and nothing runs. Observed in
 * smoke testing of the optimizer's delegation, and latent on the same pattern in
 * the FEAT-033 run path.
 *
 * Where the shell-integration API exists (VS Code 1.93+) we wait for its precise
 * ready signal. `package.json#engines` declares `^1.85.0`, so it may be absent;
 * there we fall back to a fixed delay. The delay also caps the modern path, so a
 * shell that never reports integration cannot hang the caller.
 *
 * @param waitForShell pass `false` for a terminal that is already running — a
 *        reused one is warm, and waiting again would add a pointless delay to
 *        every command after the first.
 */
export async function sendWhenShellReady(
    terminal: vscode.Terminal,
    command: string,
    waitForShell = true,
): Promise<void> {
    if (waitForShell) {
        await waitForShellReady(terminal);
    }
    terminal.sendText(command);
}

/** Exported for callers that need the wait without sending (rare). */
export async function waitForShellReady(
    terminal: vscode.Terminal,
    timeoutMs = SHELL_READY_TIMEOUT_MS,
): Promise<void> {
    const integrationApi = (vscode.window as unknown as {
        onDidChangeTerminalShellIntegration?: vscode.Event<{ terminal: vscode.Terminal }>;
    }).onDidChangeTerminalShellIntegration;

    if (typeof integrationApi !== 'function') {
        await new Promise(resolve => setTimeout(resolve, timeoutMs));
        return;
    }

    await new Promise<void>(resolve => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            sub?.dispose();
            clearTimeout(timer);
            resolve();
        };
        const sub = integrationApi(e => {
            if (e.terminal === terminal) finish();
        });
        const timer = setTimeout(finish, timeoutMs);
    });
}

export const SHELL_READY_TIMEOUT_MS = 1500;
