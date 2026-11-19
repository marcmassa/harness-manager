// FEAT-028 T5: checkLM — diagnostics plus a quick AI ping. Needs no workspace
// folder, so it is registered on both activation paths (FEAT-045 R17).
import * as vscode from 'vscode';
import { diagnoseLmAvailability, generateText } from '../lmUtils.js';
import { withInferenceAction } from '../cost/inferenceLedger.js';

export function registerCheckLM(context: vscode.ExtensionContext, log: vscode.LogOutputChannel): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('harness-dashboard.checkLM', async () => {
            const config = vscode.workspace.getConfiguration('harness-dashboard');
            const apiKey = config.get<string>('ai.apiKey', '');
            const endpoint = config.get<string>('ai.endpoint', 'https://api.openai.com/v1/chat/completions');
            const model = config.get<string>('ai.model', 'gpt-4o-mini');

            // Run diagnostics first
            const diagSummary = await diagnoseLmAvailability(log);

            // Then try a simple generation
            const result = await withInferenceAction('provider-check', () => generateText(
                'Say "OK" and nothing else.',
                log,
                { apiKey, endpoint, model },
            ));

            // Log full results
            const lines = [
                '--- LM Diagnostics ---',
                diagSummary,
                '--- AI Generation Test ---',
                result.ok
                    ? `✓ Response: ${result.text.slice(0, 200)}`
                    : `✗ Failed: ${result.error}`,
            ];
            log.info('[checkLM]\n' + lines.join('\n'));

            // Surface a notification
            if (result.ok) {
                const text = result.text.slice(0, 100);
                vscode.window.showInformationMessage(
                    `Harness Dashboard: AI is working (${text})`,
                    'View Output',
                ).then((selection) => {
                    if (selection === 'View Output') log.show();
                });
            } else {
                vscode.window.showWarningMessage(
                    `Harness Dashboard: AI check failed — ${result.error}`,
                    'View Output',
                ).then((selection) => {
                    if (selection === 'View Output') log.show();
                });
            }
        })
    );
}
