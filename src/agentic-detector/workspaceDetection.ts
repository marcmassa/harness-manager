import * as vscode from 'vscode';
import { EXCLUDED_GLOB_PATTERNS } from './signalScanner.js';
import type { CLIInstall, MethodologyInfo } from './types.js';
import type { SupplyChainFsDeps } from '../supply-chain/scanner.js';

/**
 * Known CLI definitions for Layer-1 detection.
 * Each entry lists characteristic configuration file globs that signal
 * the presence of a particular agentic command-line tool.
 */
const CLI_DEFINITIONS: Array<{ id: string; name: string; patterns: string[] }> = [
  { id: 'claude-code',      name: 'Claude Code',      patterns: ['CLAUDE.md', '.claude/**'] },
  { id: 'cursor',           name: 'Cursor',            patterns: ['.cursorrules', '.cursor/**'] },
  { id: 'kiro',             name: 'Kiro',              patterns: ['kiro.json', '.kiro/**'] },
  { id: 'opencode',         name: 'OpenCode',          patterns: ['opencode.json', 'opencode.jsonc', '.opencode/**'] },
  { id: 'github-copilot',   name: 'GitHub Copilot',    patterns: ['.github/copilot-instructions.md'] },
  { id: 'continue',         name: 'Continue',          patterns: ['continue.json', '.continue/**'] },
  { id: 'windsurf',         name: 'Windsurf',          patterns: ['.windsurfrules'] },
  { id: 'codebuff',         name: 'Codebuff',          patterns: ['.codebuff/**'] },
];

/**
 * Detect known agentic CLI installations by searching for their
 * characteristic configuration files in the workspace.
 *
 * Returns an empty array when no known CLI is detected.
 */
export async function detectCLIInstalls(root: vscode.Uri): Promise<CLIInstall[]> {
  const installs: CLIInstall[] = [];
  const exclude = `{${EXCLUDED_GLOB_PATTERNS.join(',')}}`;

  for (const cli of CLI_DEFINITIONS) {
    const foundFiles: string[] = [];

    for (const pattern of cli.patterns) {
      const uris = await vscode.workspace.findFiles(
        new vscode.RelativePattern(root, pattern),
        exclude,
        5,
      );
      for (const uri of uris) {
        foundFiles.push(uri.fsPath);
      }
    }

    if (foundFiles.length > 0) {
      installs.push({
        cliId: cli.id,
        cliName: cli.name,
        detectedBy: 'agentic-detector',
        configFiles: foundFiles,
        isActive: true,
        layer: 1,
      });
    }
  }

  return installs;
}

/**
 * Detect an active project methodology by checking for well-known
 * methodology configuration files.
 *
 * Currently supported:
 *   - **Harness SDD** (`.agents/agentic.json`)
 *   - **Custom SDD** (`feature_list.json`)
 *
 * Returns a "not active" `MethodologyInfo` when nothing is found.
 */
export async function detectMethodology(root: vscode.Uri): Promise<MethodologyInfo> {
  // Harness SDD
  const harnessConfig = await vscode.workspace.findFiles(
    new vscode.RelativePattern(root, '.agents/agentic.json'),
    undefined,
    1,
  );

  if (harnessConfig.length > 0) {
    return {
      hasMethodology: true,
      methodologyName: 'Harness SDD',
      methodologyVersion: null,
      configFile: harnessConfig[0].fsPath,
      isActive: true,
      layer: 3,
    };
  }

  // Custom / generic SDD (feature_list.json is the canonical entry point)
  const featureList = await vscode.workspace.findFiles(
    new vscode.RelativePattern(root, 'feature_list.json'),
    undefined,
    1,
  );

  if (featureList.length > 0) {
    return {
      hasMethodology: true,
      methodologyName: 'Custom SDD',
      methodologyVersion: null,
      configFile: featureList[0].fsPath,
      isActive: true,
      layer: 3,
    };
  }

  return {
    hasMethodology: false,
    methodologyName: null,
    methodologyVersion: null,
    configFile: null,
    isActive: false,
    layer: 3,
  };
}

/**
 * FEAT-036: Filesystem adapter for the supply-chain scanner, wired to
 * `vscode.workspace.fs`. Absent or unreadable files resolve to `null` —
 * the scanner's degradation matrix handles them (no throws).
 */
export function supplyChainDeps(root: vscode.Uri): SupplyChainFsDeps {
  return {
    async readFile(relPath: string): Promise<string | null> {
      try {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(root, relPath));
        return Buffer.from(bytes).toString('utf8');
      } catch {
        return null;
      }
    },
    async exists(relPath: string): Promise<boolean> {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, relPath));
        return true;
      } catch {
        return false;
      }
    },
  };
}
