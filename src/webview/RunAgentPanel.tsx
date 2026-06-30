// FEAT-033: RunAgentPanel — slide-in drawer for running an agent from the whiteboard
import * as React from 'react';
import type { FeatureEntry } from './FeatureList.js';

export interface RunAgentOpts {
    adapterId: string;
    task: string;
    interactive: boolean;
    featureName?: string;
    model?: string;
    extraArgs?: string;
}

export interface RunAgentPanelProps {
    nodeId: string;
    nodeName: string;
    nodeFilePath: string;
    nodeType: 'agent' | 'subagent' | 'skill';
    adapters: { id: string; name: string }[];
    selectedAdapterId: string;
    onAdapterChange: (id: string) => void;
    features: FeatureEntry[];
    onRun: (opts: RunAgentOpts) => void;
    onClose: () => void;
    isRunning: boolean;
    noCliDetected?: boolean;
}

/** Client-side command preview — mirrors the adapter logic without calling the extension. */
function buildPreview(
    nodeFilePath: string,
    adapterId: string,
    task: string,
    interactive: boolean,
    model?: string,
    extraArgs?: string,
    featureName?: string,
): string {
    if (!task.trim()) return '(enter a task to preview the command)';

    let taskStr = nodeFilePath ? `[Context: ${nodeFilePath}]\n${task}` : task;
    if (featureName) taskStr += `\n\n---\nFeature context: <first 800 chars of ${featureName}/requirements.md>`;

    const parts: string[] = [];
    if (adapterId === 'claude-code') {
        parts.push('claude');
        if (!interactive) {
            parts.push('--print', JSON.stringify(taskStr));
        } else {
            parts.push('--message', JSON.stringify(taskStr));
        }
        if (model) parts.push('--model', model);
        if (extraArgs) parts.push(extraArgs);
    } else if (adapterId === 'gemini-cli') {
        parts.push('gemini');
        if (nodeFilePath) parts.push('--file', `"${nodeFilePath}"`);
        parts.push('--prompt', JSON.stringify(taskStr));
        if (model) parts.push('--model', model);
        if (extraArgs) parts.push(extraArgs);
    } else {
        return nodeFilePath ? `# Open in VS Code editor: ${nodeFilePath}` : '# Open in VS Code editor';
    }
    return parts.join(' ');
}

export const RunAgentPanel: React.FC<RunAgentPanelProps> = ({
    nodeId: _nodeId,
    nodeName,
    nodeFilePath,
    nodeType: _nodeType,
    adapters,
    selectedAdapterId,
    onAdapterChange,
    features,
    onRun,
    onClose,
    isRunning,
    noCliDetected,
}) => {
    const [task, setTask] = React.useState('');
    const [interactive, setInteractive] = React.useState(true);
    const [model, setModel] = React.useState('');
    const [extraArgs, setExtraArgs] = React.useState('');
    const [featureName, setFeatureName] = React.useState('');
    const [featureSearch, setFeatureSearch] = React.useState('');
    const [featureOpen, setFeatureOpen] = React.useState(false);
    const [advancedOpen, setAdvancedOpen] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    const preview = React.useMemo(
        () => buildPreview(nodeFilePath, selectedAdapterId, task, interactive, model || undefined, extraArgs || undefined, featureName || undefined),
        [nodeFilePath, selectedAdapterId, task, interactive, model, extraArgs, featureName],
    );

    const filteredFeatures = React.useMemo(
        () => features.filter(f =>
            f.id.toLowerCase().includes(featureSearch.toLowerCase()) ||
            f.title.toLowerCase().includes(featureSearch.toLowerCase())
        ).slice(0, 20),
        [features, featureSearch],
    );

    const handleRun = () => {
        if (!task.trim()) return;
        onRun({
            adapterId: selectedAdapterId,
            task,
            interactive,
            featureName: featureName || undefined,
            model: model || undefined,
            extraArgs: extraArgs || undefined,
        });
    };

    const handleCopy = () => {
        navigator.clipboard?.writeText(preview).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        });
    };

    const btnBase: React.CSSProperties = {
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: 6,
        padding: '5px 12px',
        cursor: 'pointer',
        fontSize: '0.82em',
        fontFamily: 'inherit',
        background: 'transparent',
        color: 'var(--vscode-foreground)',
        transition: 'background 0.12s ease',
    };

    const sectionLabel: React.CSSProperties = {
        fontSize: '0.7em',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        fontWeight: 700,
        opacity: 0.55,
        marginBottom: 4,
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderBottom: '1px solid var(--vscode-panel-border)',
                flexShrink: 0,
            }}>
                <span style={{ fontWeight: 700, fontSize: '0.92em' }}>⚡ Run Agent</span>
                <button onClick={onClose} style={{ ...btnBase, padding: '2px 8px', border: 'none' }} title="Close">✕</button>
            </div>

            {/* Body (scrollable) */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Agent info */}
                <div>
                    <div style={sectionLabel}>Agent</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9em' }}>{nodeName}</div>
                    {nodeFilePath && (
                        <div style={{ fontSize: '0.75em', opacity: 0.55, marginTop: 2, fontFamily: 'monospace' }}>
                            {nodeFilePath}
                        </div>
                    )}
                </div>

                {/* No CLI notice (R7) */}
                {noCliDetected && (
                    <div style={{
                        padding: '8px 10px',
                        background: 'color-mix(in srgb, #d4a84a 12%, transparent)',
                        border: '1px solid color-mix(in srgb, #d4a84a 40%, transparent)',
                        borderRadius: 6,
                        fontSize: '0.8em',
                        lineHeight: 1.5,
                    }}>
                        <strong>No agent CLI detected.</strong> Install Claude Code or Gemini CLI to run agents directly.
                    </div>
                )}

                {/* CLI selector */}
                <div>
                    <div style={sectionLabel}>CLI</div>
                    <select
                        value={selectedAdapterId}
                        onChange={e => onAdapterChange(e.target.value)}
                        style={{
                            width: '100%',
                            background: 'var(--vscode-dropdown-background)',
                            color: 'var(--vscode-dropdown-foreground)',
                            border: '1px solid var(--vscode-dropdown-border)',
                            borderRadius: 4,
                            padding: '5px 8px',
                            fontSize: '0.9em',
                            fontFamily: 'inherit',
                        }}
                    >
                        {adapters.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>

                {/* Mode toggle (Claude Code only) */}
                {selectedAdapterId === 'claude-code' && (
                    <div>
                        <div style={sectionLabel}>Mode</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {(['interactive', 'one-shot'] as const).map(m => (
                                <button
                                    key={m}
                                    onClick={() => setInteractive(m === 'interactive')}
                                    style={{
                                        ...btnBase,
                                        background: (m === 'interactive') === interactive
                                            ? 'var(--vscode-button-background)'
                                            : 'transparent',
                                        color: (m === 'interactive') === interactive
                                            ? 'var(--vscode-button-foreground)'
                                            : 'var(--vscode-foreground)',
                                        border: (m === 'interactive') === interactive
                                            ? '1px solid var(--vscode-button-background)'
                                            : '1px solid var(--vscode-panel-border)',
                                    }}
                                >
                                    {m === 'interactive' ? '● Interactive' : '○ One-shot'}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Task textarea */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={sectionLabel}>Task</div>
                    <textarea
                        rows={4}
                        value={task}
                        onChange={e => setTask(e.target.value)}
                        placeholder="Describe what this agent should do…"
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            resize: 'vertical',
                            background: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            border: '1px solid var(--vscode-input-border, var(--vscode-panel-border))',
                            borderRadius: 4,
                            padding: '6px 8px',
                            fontSize: '0.88em',
                            fontFamily: 'var(--vscode-editor-font-family)',
                            lineHeight: 1.5,
                        }}
                    />
                </div>

                {/* Attach feature (collapsible) */}
                <div>
                    <button
                        onClick={() => setFeatureOpen(o => !o)}
                        style={{ ...btnBase, display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'space-between' }}
                    >
                        <span style={sectionLabel}>▸ Attach feature</span>
                        <span style={{ fontSize: '0.75em', opacity: 0.6 }}>{featureName || 'none'}</span>
                    </button>
                    {featureOpen && (
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <input
                                type="text"
                                placeholder="Search features…"
                                value={featureSearch}
                                onChange={e => setFeatureSearch(e.target.value)}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    background: 'var(--vscode-input-background)',
                                    color: 'var(--vscode-input-foreground)',
                                    border: '1px solid var(--vscode-input-border, var(--vscode-panel-border))',
                                    borderRadius: 4,
                                    padding: '4px 8px',
                                    fontSize: '0.85em',
                                    fontFamily: 'inherit',
                                }}
                            />
                            <div style={{ maxHeight: 140, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {featureName && (
                                    <button
                                        onClick={() => { setFeatureName(''); setFeatureSearch(''); }}
                                        style={{ ...btnBase, fontSize: '0.78em', color: 'var(--vscode-errorForeground, #e86f4a)', textAlign: 'left' }}
                                    >
                                        ✕ Clear attachment
                                    </button>
                                )}
                                {filteredFeatures.map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => { setFeatureName(f.id); setFeatureOpen(false); setFeatureSearch(''); }}
                                        style={{
                                            ...btnBase,
                                            fontSize: '0.8em',
                                            textAlign: 'left',
                                            background: featureName === f.id ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
                                            color: featureName === f.id ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
                                        }}
                                    >
                                        <span style={{ fontWeight: 600 }}>{f.id}</span>
                                        {' '}
                                        <span style={{ opacity: 0.7 }}>{f.title}</span>
                                    </button>
                                ))}
                                {filteredFeatures.length === 0 && (
                                    <div style={{ fontSize: '0.78em', opacity: 0.5, padding: '4px 0' }}>No features found</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Advanced section (collapsible) */}
                <div>
                    <button
                        onClick={() => setAdvancedOpen(o => !o)}
                        style={{ ...btnBase, display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'flex-start' }}
                    >
                        <span style={sectionLabel}>▸ Advanced</span>
                    </button>
                    {advancedOpen && (
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div>
                                <div style={sectionLabel}>Model override</div>
                                <input
                                    type="text"
                                    placeholder="e.g. claude-opus-4-5"
                                    value={model}
                                    onChange={e => setModel(e.target.value)}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        background: 'var(--vscode-input-background)',
                                        color: 'var(--vscode-input-foreground)',
                                        border: '1px solid var(--vscode-input-border, var(--vscode-panel-border))',
                                        borderRadius: 4,
                                        padding: '4px 8px',
                                        fontSize: '0.85em',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>
                            <div>
                                <div style={sectionLabel}>Extra args</div>
                                <input
                                    type="text"
                                    placeholder="e.g. --verbose"
                                    value={extraArgs}
                                    onChange={e => setExtraArgs(e.target.value)}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        background: 'var(--vscode-input-background)',
                                        color: 'var(--vscode-input-foreground)',
                                        border: '1px solid var(--vscode-input-border, var(--vscode-panel-border))',
                                        borderRadius: 4,
                                        padding: '4px 8px',
                                        fontSize: '0.85em',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Command preview */}
                <div>
                    <div style={sectionLabel}>Command preview</div>
                    <pre style={{
                        margin: 0,
                        padding: '8px 10px',
                        background: 'var(--vscode-terminal-background, var(--vscode-editor-background))',
                        border: '1px solid var(--vscode-panel-border)',
                        borderRadius: 4,
                        fontSize: '0.76em',
                        fontFamily: 'var(--vscode-editor-font-family, monospace)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        overflowWrap: 'anywhere',
                        color: 'var(--vscode-terminal-foreground, var(--vscode-foreground))',
                        lineHeight: 1.4,
                        maxHeight: 100,
                        overflow: 'auto',
                    }}>
                        {preview}
                    </pre>
                </div>
            </div>

            {/* Footer actions */}
            <div style={{
                padding: '10px 14px',
                borderTop: '1px solid var(--vscode-panel-border)',
                display: 'flex',
                gap: 8,
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
            }}>
                <button
                    onClick={handleCopy}
                    disabled={!task.trim()}
                    title="Copy command to clipboard"
                    style={{
                        ...btnBase,
                        opacity: !task.trim() ? 0.4 : 1,
                        cursor: !task.trim() ? 'default' : 'pointer',
                    }}
                >
                    {copied ? '✓ Copied' : '□ Copy'}
                </button>

                <button
                    onClick={handleRun}
                    disabled={!task.trim() || isRunning}
                    style={{
                        ...btnBase,
                        background: (!task.trim() || isRunning)
                            ? 'color-mix(in srgb, var(--vscode-button-background) 50%, transparent)'
                            : 'var(--vscode-button-background)',
                        color: 'var(--vscode-button-foreground)',
                        border: 'none',
                        fontWeight: 700,
                        padding: '6px 18px',
                        opacity: (!task.trim() || isRunning) ? 0.6 : 1,
                        cursor: (!task.trim() || isRunning) ? 'default' : 'pointer',
                    }}
                >
                    {isRunning ? '⏳ Running…' : '▶ Run Agent'}
                </button>
            </div>
        </div>
    );
};
