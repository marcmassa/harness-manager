import * as React from 'react';
import { AskHostButton } from './components/AskHostButton.js';
import { SPACE } from './styles.js';

export interface AiAssistBarProps {
    existsCurrentFile: boolean;
    aiLoading: boolean;
    onCreateFromTemplate: () => void;
    onEnterEditMode: () => void;
    onGenerateWithAI: () => void;
    /** FEAT-036 — false when the host exposes no model and no API key is set. */
    canGenerateDirectly?: boolean;
    /** Name of the host's own chat agent, when it exposes one. */
    chatHostName?: string;
    onAskEditor?: () => void;
}

export const AiAssistBar = ({
    existsCurrentFile,
    aiLoading,
    onCreateFromTemplate,
    onEnterEditMode,
    onGenerateWithAI,
    canGenerateDirectly = true,
    chatHostName,
    onAskEditor,
}: AiAssistBarProps) => {
    // Offering "Generate with AI" in a host with no model and no key is a button
    // that can only fail. Where the host has its own chat, hand the prompt there
    // instead; the user already has a model and an account in it.
    const showAsk = Boolean(chatHostName) && Boolean(onAskEditor);
    const showGenerate = canGenerateDirectly || !showAsk;
    return (
        <div style={{
            display: 'flex',
            gap: SPACE.sm,
            padding: `0 ${SPACE.md} ${SPACE.sm}`,
            flexShrink: 0,
            alignItems: 'center',
        }}>
            {!existsCurrentFile && (
                <button
                    type="button"
                    onClick={onCreateFromTemplate}
                    style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid var(--vscode-button-border)',
                        background: 'var(--vscode-button-background)',
                        color: 'var(--vscode-button-foreground)',
                        cursor: 'pointer',
                        fontSize: '0.72em',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}
                >
                    ✨ Create from Template
                </button>
            )}
            {existsCurrentFile && (
                <button
                    type="button"
                    onClick={onEnterEditMode}
                    style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid var(--vscode-panel-border)',
                        background: 'transparent',
                        color: 'var(--vscode-foreground)',
                        cursor: 'pointer',
                        fontSize: '0.72em',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}
                >
                    ✏ Edit
                </button>
            )}
            {showAsk && (
                <AskHostButton
                    hostName={chatHostName}
                    onClick={() => onAskEditor?.()}
                    primary={!canGenerateDirectly}
                    subject="this spec prompt"
                    style={{ fontSize: '0.72em', minHeight: '24px', padding: '5px 11px' }}
                />
            )}
            {showGenerate && (
            <button
                type="button"
                onClick={onGenerateWithAI}
                disabled={aiLoading}
                style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--vscode-button-border)',
                    background: aiLoading
                        ? 'var(--vscode-button-secondaryBackground, var(--vscode-panel-border))'
                        : 'var(--vscode-button-background)',
                    color: aiLoading
                        ? 'var(--vscode-button-secondaryForeground, var(--vscode-disabledForeground))'
                        : 'var(--vscode-button-foreground)',
                    cursor: aiLoading ? 'default' : 'pointer',
                    fontSize: '0.72em',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: aiLoading ? 0.6 : 1,
                }}
            >
                {aiLoading ? '⏳ Generating...' : '🤖 Generate with AI'}
            </button>
            )}
        </div>
    );
};
