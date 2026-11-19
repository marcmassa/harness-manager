// Runs inside an Extension Host opened on a disposable foreign workspace.
import * as assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as vscode from 'vscode';

export async function run(): Promise<void> {
    const root = vscode.workspace.workspaceFolders![0].uri;
    const extension = vscode.extensions.getExtension('marcmassacapo.harness-dashboard-vscode');
    assert.ok(extension);
    await extension.activate();
    const legacy = vscode.workspace.getConfiguration('harness-dashboard.codeQuality', root);
    for (const key of ['verifyOnSave', 'blockOnSave', 'warnBeforeSaveOnError']) {
        assert.equal(legacy.get(key), true, key);
    }
    const uri = vscode.Uri.joinPath(root, 'src', 'sample.ts');
    const doc = await vscode.workspace.openTextDocument(uri);
    assert.equal(doc.languageId, 'typescript');
    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(0, 0), '// edited\n');
    assert.ok(await vscode.workspace.applyEdit(edit));
    assert.ok(doc.isDirty);
    assert.ok(await doc.save());
    assert.equal(readFileSync(uri.fsPath, 'utf8'), doc.getText());
    assert.equal(doc.isDirty, false);
    assert.ok(!(await vscode.commands.getCommands()).includes('harness-dashboard.verifyCodeQuality'));
    // The old didSave listener spawned a child asynchronously. Allow it to start.
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal(existsSync(vscode.Uri.joinPath(root, 'hook-ran').fsPath), false);
    assert.ok(!vscode.languages.getDiagnostics(uri).some(d => ['harness-kiss', 'harness-dry'].includes(d.source ?? '')));
    console.log('FEAT-040 save isolation passed');
}
