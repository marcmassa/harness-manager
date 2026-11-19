// FEAT-046 R1, R2 — tree item icons: the generated light/dark SVGs in dist/icons.
import * as vscode from 'vscode';
import type { TreeIconName } from '../shared/typeIcons.js';

export function iconPath(extensionUri: vscode.Uri, name: TreeIconName): { light: vscode.Uri; dark: vscode.Uri } {
    return {
        light: vscode.Uri.joinPath(extensionUri, 'dist', 'icons', `${name}-light.svg`),
        dark: vscode.Uri.joinPath(extensionUri, 'dist', 'icons', `${name}-dark.svg`),
    };
}
