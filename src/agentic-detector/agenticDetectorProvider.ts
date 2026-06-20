import * as vscode from 'vscode';
import type {
  AgenticProfile,
  CLIInstall,
  SignalCategoryResult,
  SignalMatch,
  PatternMatch,
  Suggestion,
  MethodologyInfo,
} from './types.js';
import { MATURITY_DEFINITIONS } from './types.js';
import { AgenticDetector } from './agenticDetector.js';

// ─── Tree node types ────────────────────────────────────────────────────────

export interface BaseNode {
  type: string;
  id: string;
  label: string;
  description?: string;
  icon?: string;
  tooltip?: string;
  contextValue?: string;
}

export interface RootNode extends BaseNode {
  type: 'root';
}

export interface SummaryNode extends BaseNode {
  type: 'summary';
  scanTimestamp: number;
}

export interface MaturityNode extends BaseNode {
  type: 'maturity';
  level: string;
  color: string;
  nextLevelDescription: string | undefined;
}

export interface CLIHeaderNode extends BaseNode {
  type: 'cli-header';
  cliCount: number;
}

export interface CLINode extends BaseNode {
  type: 'cli';
  cli: CLIInstall;
}

export interface SignalsHeaderNode extends BaseNode {
  type: 'signals-header';
  activeCategoryCount: number;
}

export interface SignalCategoryNode extends BaseNode {
  type: 'signal-category';
  categoryResult: SignalCategoryResult;
}

export interface SignalMatchNode extends BaseNode {
  type: 'signal-match';
  match: SignalMatch;
  category: string;
}

export interface PatternsHeaderNode extends BaseNode {
  type: 'patterns-header';
  patternCount: number;
}

export interface PatternNode extends BaseNode {
  type: 'pattern';
  pattern: PatternMatch;
}

export interface SuggestionsHeaderNode extends BaseNode {
  type: 'suggestions-header';
  suggestionCount: number;
}

export interface SuggestionNode extends BaseNode {
  type: 'suggestion';
  suggestion: Suggestion;
}

export interface MethodologyNode extends BaseNode {
  type: 'methodology';
  methodology: MethodologyInfo;
}

export type TreeNode =
  | RootNode
  | SummaryNode
  | MaturityNode
  | CLIHeaderNode
  | CLINode
  | SignalsHeaderNode
  | SignalCategoryNode
  | SignalMatchNode
  | PatternsHeaderNode
  | PatternNode
  | SuggestionsHeaderNode
  | SuggestionNode
  | MethodologyNode;

// ─── Codicon lookup helpers ──────────────────────────────────────────────────

const SIGNAL_CATEGORY_ICONS: Record<string, string> = {
  prompts: 'symbol-key',
  rules: 'checklist',
  mcp: 'plug',
  'agent-methodologies': 'symbol-class',
  tools: 'tools',
  skills: 'beaker',
  'agent-scripts': 'run-all',
  memory: 'database',
  'context-identity': 'symbol-interface',
};

function iconForCategory(category: string): string {
  return SIGNAL_CATEGORY_ICONS[category] ?? 'symbol-misc';
}

const IMPACT_ICONS: Record<string, string> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
};

const EFFORT_LABELS: Record<string, string> = {
  high: '$(hourglass) High effort',
  medium: '$(clock) Medium effort',
  low: '$(check) Low effort',
};

// ─── Provider ────────────────────────────────────────────────────────────────

export class AgenticDetectorProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined> = this._onDidChangeTreeData.event;

  constructor(private readonly _detector: AgenticDetector) {
    this._detector.on('scanComplete', () => this.refresh());
    this._detector.on('scanError', () => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label);
    this._applyNodeStyle(element, item);
    return item;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) return this._getRootNodes();
    switch (element.type) {
      case 'root': return this._getRootChildren();
      case 'cli-header': return this._getCLINodes();
      case 'signals-header': return this._getSignalCategoryNodes();
      case 'signal-category': return this._getSignalMatchNodes(element as SignalCategoryNode);
      case 'patterns-header': return this._getPatternNodes();
      case 'suggestions-header': return this._getSuggestionNodes();
      default: return [];
    }
  }

  // ── style helpers ───────────────────────────────────────────────────────────

  private _applyNodeStyle(element: TreeNode, item: vscode.TreeItem): void {
    switch (element.type) {
      case 'root':
        item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        break;

      case 'summary': {
        const n = element as SummaryNode;
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.iconPath = new vscode.ThemeIcon('search');
        item.description = n.scanTimestamp
          ? new Date(n.scanTimestamp).toLocaleTimeString()
          : undefined;
        item.tooltip = n.tooltip ?? 'Click to re-scan';
        item.contextValue = 'summary';
        item.command = {
          command: 'harness-dashboard.rescanAgentic',
          title: 'Re-scan agentic architecture',
        };
        break;
      }

      case 'maturity': {
        const n = element as MaturityNode;
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.iconPath = new vscode.ThemeIcon('dashboard');
        item.description = n.nextLevelDescription;
        item.tooltip = n.tooltip ?? '';
        // Color the label via a small decorator: use the description for the
        // hex colour so context-aware themes can style it.  VS Code doesn't
        // natively support per-item colours in TreeItem, so we encode the
        // colour into the resourceUri trick (a synthetic URI) or set the
        // label with a colour badge via a custom TreeItemCheckboxState.
        // The most reliable approach is VS Code's label highlighting with
        // a custom highlighter, but we'll store the colour in the resourceUri
        // for extension-level CSS usage and rely on the icon + label clarity.
        item.resourceUri = vscode.Uri.parse(`harness-maturity://${n.level}`);
        break;
      }

      case 'cli-header': {
        const n = element as CLIHeaderNode;
        item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        item.iconPath = new vscode.ThemeIcon('terminal');
        item.description = `${n.cliCount} installed`;
        item.contextValue = 'cli-header';
        break;
      }

      case 'cli': {
        const n = element as CLINode;
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.iconPath = new vscode.ThemeIcon(
          n.cli.isActive ? 'pass' : 'circle-outline',
        );
        item.description = n.cli.detectedBy;
        item.tooltip = [
          `CLI: ${n.cli.cliName}`,
          `Detected by: ${n.cli.detectedBy}`,
          `Config files: ${n.cli.configFiles.join(', ') || '(none)'}`,
          `Active: ${n.cli.isActive ? 'Yes' : 'No'}`,
        ].join('\n');
        item.contextValue = n.cli.isActive ? 'cli-active' : 'cli-inactive';
        break;
      }

      case 'signals-header': {
        const n = element as SignalsHeaderNode;
        item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        item.iconPath = new vscode.ThemeIcon('layers');
        item.description = `${n.activeCategoryCount} categories`;
        item.contextValue = 'signals-header';
        break;
      }

      case 'signal-category': {
        const n = element as SignalCategoryNode;
        item.collapsibleState = n.categoryResult.count > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None;
        item.iconPath = new vscode.ThemeIcon(iconForCategory(n.categoryResult.category));
        item.description = `(${n.categoryResult.count})`;
        item.tooltip = `${n.categoryResult.label}: ${n.categoryResult.count} match${n.categoryResult.count === 1 ? '' : 'es'}`
          + (n.categoryResult.truncated ? ' (truncated)' : '');
        item.contextValue = 'signal-category';
        break;
      }

      case 'signal-match': {
        const n = element as SignalMatchNode;
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.iconPath = new vscode.ThemeIcon('file');
        item.description = n.match.confidence;
        item.tooltip = [
          `File: ${n.match.filePath}`,
          `Pattern: ${n.match.matchedPattern}`,
          `Confidence: ${n.match.confidence}`,
          n.match.evidence ? `Evidence: ${n.match.evidence}` : '',
        ].filter(Boolean).join('\n');
        item.contextValue = 'signal-match';
        break;
      }

      case 'patterns-header': {
        const n = element as PatternsHeaderNode;
        item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        item.iconPath = new vscode.ThemeIcon('circuit-board');
        item.description = `${n.patternCount} pattern${n.patternCount === 1 ? '' : 's'}`;
        item.contextValue = 'patterns-header';
        break;
      }

      case 'pattern': {
        const n = element as PatternNode;
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.iconPath = n.pattern.status === 'detected'
          ? new vscode.ThemeIcon('verified', new vscode.ThemeColor('testing.iconPassed'))
          : new vscode.ThemeIcon('question', new vscode.ThemeColor('testing.iconQueued'));
        const pct = `${Math.round(n.pattern.confidence * 100)}%`;
        item.description = `${n.pattern.status} (${pct})`;
        item.tooltip = [
          `Pattern: ${n.pattern.label}`,
          `Status: ${n.pattern.status}`,
          `Confidence: ${pct}`,
          n.pattern.evidence.length > 0
            ? `Evidence:\n  ${n.pattern.evidence.join('\n  ')}`
            : '',
        ].filter(Boolean).join('\n');
        item.contextValue = 'pattern';
        break;
      }

      case 'suggestions-header': {
        const n = element as SuggestionsHeaderNode;
        item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        item.iconPath = new vscode.ThemeIcon('lightbulb');
        item.description = `${n.suggestionCount} suggestion${n.suggestionCount === 1 ? '' : 's'}`;
        item.contextValue = 'suggestions-header';
        break;
      }

      case 'suggestion': {
        const n = element as SuggestionNode;
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.iconPath = new vscode.ThemeIcon(
          IMPACT_ICONS[n.suggestion.impact] ?? 'info',
        );
        const effortLabel = EFFORT_LABELS[n.suggestion.effort] ?? '';
        item.description = `[${n.suggestion.impact}] ${effortLabel}`;
        item.tooltip = [
          n.suggestion.title,
          '',
          n.suggestion.description,
          '',
          `Impact: ${n.suggestion.impact}`,
          `Effort: ${n.suggestion.effort}`,
          `Layer: L${n.suggestion.layer}`,
          n.suggestion.actionType ? `Action: ${n.suggestion.actionType}` : '',
        ].filter(Boolean).join('\n');
        item.contextValue = `suggestion-${n.suggestion.impact}`;
        break;
      }

      case 'methodology': {
        const n = element as MethodologyNode;
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.iconPath = new vscode.ThemeIcon('book');
        if (n.methodology.hasMethodology) {
          const name = n.methodology.methodologyName ?? 'Unknown';
          const version = n.methodology.methodologyVersion
            ? ` v${n.methodology.methodologyVersion}`
            : '';
          item.description = n.methodology.isActive ? 'Active' : 'Inactive';
          item.tooltip = [
            `Methodology: ${name}${version}`,
            n.methodology.configFile ? `Config: ${n.methodology.configFile}` : '',
            `Active: ${n.methodology.isActive ? 'Yes' : 'No'}`,
          ].filter(Boolean).join('\n');
        } else {
          item.description = 'Not detected';
          item.tooltip = 'No agentic methodology detected in this workspace.';
        }
        item.contextValue = 'methodology';
        break;
      }
    }

    if (element.tooltip && !item.tooltip) {
      item.tooltip = element.tooltip;
    }
  }

  // ── tree construction ──────────────────────────────────────────────────────

  private _rootNode(): RootNode {
    return {
      type: 'root',
      id: 'root',
      label: 'Root',
    };
  }

  private _getRootNodes(): TreeNode[] {
    return [this._rootNode()];
  }

  private _getRootChildren(): TreeNode[] {
    const profile = this._detector.getProfile();
    if (!profile) {
      // No profile yet — show a single actionable node
      return [this._emptySummaryNode()];
    }

    const children: TreeNode[] = [];

    // 1. Summary node
    children.push(this._buildSummaryNode(profile));

    // 2. Maturity node
    children.push(this._buildMaturityNode(profile));

    // 3. CLI header
    children.push(this._buildCLIHeaderNode(profile));

    // 4. Signals header
    children.push(this._buildSignalsHeaderNode(profile));

    // 5. Methodology
    children.push(this._buildMethodologyNode(profile));

    // 6. Patterns header
    children.push(this._buildPatternsHeaderNode(profile));

    // 7. Suggestions header
    children.push(this._buildSuggestionsHeaderNode(profile));

    return children;
  }

  private _emptySummaryNode(): SummaryNode {
    return {
      type: 'summary',
      id: 'empty-summary',
      label: 'Run scan to detect agentic architecture',
      scanTimestamp: 0,
      tooltip: 'Click to start a scan',
      contextValue: 'summary',
    };
  }

  private _buildSummaryNode(profile: AgenticProfile): SummaryNode {
    return {
      type: 'summary',
      id: 'summary',
      label: 'Agentic Scan',
      scanTimestamp: profile.scanTimestamp,
      tooltip: `Last scanned: ${new Date(profile.scanTimestamp).toLocaleString()}\nClick to re-scan`,
      contextValue: 'summary',
    };
  }

  private _buildMaturityNode(profile: AgenticProfile): MaturityNode {
    const def = MATURITY_DEFINITIONS[profile.maturity.level];
    const nextLevelDescription = profile.maturity.nextLevel
      ? `Next: ${profile.maturity.nextLevel.level} — ${profile.maturity.nextLevel.whatIsNeeded}`
      : undefined;
    return {
      type: 'maturity',
      id: `maturity-${profile.maturity.level}`,
      label: `${profile.maturity.level} — ${profile.maturity.label}`,
      level: profile.maturity.level,
      color: def?.color ?? '#888',
      nextLevelDescription,
      tooltip: [
        `${profile.maturity.level} — ${profile.maturity.label}`,
        profile.maturity.description,
        '',
        nextLevelDescription ?? 'Highest level reached.',
      ].filter(Boolean).join('\n'),
      contextValue: `maturity-${profile.maturity.level}`,
    };
  }

  private _buildCLIHeaderNode(profile: AgenticProfile): CLIHeaderNode {
    return {
      type: 'cli-header',
      id: 'cli-header',
      label: 'CLI Installs (L1)',
      cliCount: profile.layers['1'].cliInstalls.length,
      contextValue: 'cli-header',
    };
  }

  private _buildSignalsHeaderNode(profile: AgenticProfile): SignalsHeaderNode {
    const activeCount = profile.layers['2'].categories.filter((c: SignalCategoryResult) => c.count > 0).length;
    return {
      type: 'signals-header',
      id: 'signals-header',
      label: 'Signal Categories (L2)',
      activeCategoryCount: activeCount,
      contextValue: 'signals-header',
    };
  }

  private _buildMethodologyNode(profile: AgenticProfile): MethodologyNode {
    return {
      type: 'methodology',
      id: 'methodology',
      label: profile.layers['3'].methodology.hasMethodology
        ? `Methodology: ${profile.layers['3'].methodology.methodologyName ?? 'Active'}`
        : 'Methodology: None',
      methodology: profile.layers['3'].methodology,
      contextValue: 'methodology',
    };
  }

  private _buildPatternsHeaderNode(profile: AgenticProfile): PatternsHeaderNode {
    return {
      type: 'patterns-header',
      id: 'patterns-header',
      label: 'Architecture Patterns',
      patternCount: profile.patterns.length,
      contextValue: 'patterns-header',
    };
  }

  private _buildSuggestionsHeaderNode(profile: AgenticProfile): SuggestionsHeaderNode {
    // Exclude dismissed suggestions from the count
    const active = profile.suggestions.filter(
      s => !profile.dismissedSuggestionIds.includes(s.id),
    );
    return {
      type: 'suggestions-header',
      id: 'suggestions-header',
      label: 'Suggestions',
      suggestionCount: active.length,
      contextValue: 'suggestions-header',
    };
  }

  // ── child accessors ─────────────────────────────────────────────────────────

  private _getCLINodes(): CLINode[] {
    const profile = this._detector.getProfile();
    if (!profile) return [];
    return profile.layers['1'].cliInstalls.map((cli: CLIInstall) => ({
      type: 'cli',
      id: `cli-${cli.cliId}`,
      label: cli.cliName,
      cli,
      contextValue: cli.isActive ? 'cli-active' : 'cli-inactive',
    }));
  }

  private _getSignalCategoryNodes(): SignalCategoryNode[] {
    const profile = this._detector.getProfile();
    if (!profile) return [];
    return profile.layers['2'].categories.map((cat: SignalCategoryResult) => ({
      type: 'signal-category',
      id: `signal-category-${cat.category}`,
      label: cat.label,
      categoryResult: cat,
      contextValue: 'signal-category',
    }));
  }

  private _getSignalMatchNodes(parent: SignalCategoryNode): SignalMatchNode[] {
    const matches = parent.categoryResult.matches;
    return matches.map((match, idx) => ({
      type: 'signal-match',
      id: `signal-match-${parent.categoryResult.category}-${idx}`,
      label: match.filePath.split('/').pop() ?? match.filePath,
      description: match.confidence,
      match,
      category: parent.categoryResult.category,
      contextValue: 'signal-match',
    }));
  }

  private _getPatternNodes(): PatternNode[] {
    const profile = this._detector.getProfile();
    if (!profile) return [];
    return profile.patterns.map((p: PatternMatch) => ({
      type: 'pattern',
      id: `pattern-${p.pattern}`,
      label: p.label,
      pattern: p,
      contextValue: 'pattern',
    }));
  }

  private _getSuggestionNodes(): SuggestionNode[] {
    const profile = this._detector.getProfile();
    if (!profile) return [];
    const dismissed = new Set(profile.dismissedSuggestionIds);
    return profile.suggestions
      .filter((s: Suggestion) => !dismissed.has(s.id))
      .map((s: Suggestion) => ({
        type: 'suggestion',
        id: `suggestion-${s.id}`,
        label: s.title,
        suggestion: s,
        contextValue: `suggestion-${s.impact}`,
      }));
  }
}
