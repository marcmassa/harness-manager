import * as React from 'react';

/**
 * "Ask <host>" — hands a prompt to the editor's own chat agent.
 *
 * One component for every surface that offers this. The optimizer's finding rows
 * and the SDD assist bar both had their own copy, and a third caller is likely.
 * Duplicating it means duplicating the wording of a promise that is easy to get
 * wrong: this action sends nothing and writes nothing, and the tooltip has to say
 * so wherever it appears.
 *
 * Pair it with `sendPromptToHostChat` on the host side — the two halves of the
 * same feature.
 */
export interface AskHostButtonProps {
    /** Display name of the host chat, e.g. "Kiro". Absent → renders nothing. */
    hostName?: string;
    onClick: () => void;
    /**
     * True when this is the best available action — i.e. nothing else can do the
     * job — so it takes the primary treatment instead of the secondary one.
     */
    primary?: boolean;
    /** What the prompt is for, folded into the tooltip. */
    subject?: string;
    style?: React.CSSProperties;
}

/** Shared geometry so every button in this family reads as one control set. */
export const askHostBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 12px',
    minHeight: '26px',
    fontSize: '0.88em',
    fontWeight: 600,
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.2px',
    whiteSpace: 'nowrap',
    lineHeight: 1,
};

const primaryStyle: React.CSSProperties = {
    ...askHostBase,
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: '1px solid transparent',
    boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
};

const secondaryStyle: React.CSSProperties = {
    ...askHostBase,
    fontWeight: 500,
    background: 'var(--vscode-button-secondaryBackground, color-mix(in srgb, var(--vscode-foreground) 12%, transparent))',
    color: 'var(--vscode-button-secondaryForeground, var(--vscode-foreground))',
    border: '1px solid color-mix(in srgb, var(--vscode-foreground) 18%, transparent)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
};

export const AskHostButton = ({
    hostName,
    onClick,
    primary = false,
    subject = 'this prompt',
    style,
}: AskHostButtonProps) => {
    // No host chat detected → no button. An action that cannot work is never
    // rendered disabled; there is nothing the user could do to enable it here.
    if (!hostName) return null;

    return (
        <button
            type="button"
            onClick={onClick}
            title={`Put ${subject} in ${hostName}'s chat input, using the model and account you already have configured there. This extension sends nothing and writes nothing.`}
            style={{ ...(primary ? primaryStyle : secondaryStyle), ...style }}
        >
            💬 Ask {hostName}
        </button>
    );
};

export default AskHostButton;
