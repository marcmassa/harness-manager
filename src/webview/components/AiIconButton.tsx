import * as React from 'react';

// FEAT-048 R6: the 20 px AI "generate" (sparkle) / "refine" (pencil) icon
// buttons overlaid on SpecEditor and SpecWizard text areas. One definition
// for the style, hover handlers and icons. Callers keep their own guards in
// onClick. Only the refine button sets the HTML `disabled` attribute, and it
// dims further (0.3) than generate (0.5) while disabled, as before.

interface Props {
    kind: 'generate' | 'refine';
    disabled: boolean;
    title: string;
    onClick: () => void;
}

const ICONS: Record<Props['kind'], React.ReactNode> = {
    generate: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/>
            <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
        </svg>
    ),
    refine: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
        </svg>
    ),
};

export function AiIconButton({ kind, disabled, title, onClick }: Props) {
    return (
        <button type="button" title={title}
            disabled={kind === 'refine' ? disabled : undefined}
            onClick={onClick}
            style={{
                width: '20px', height: '20px', padding: 0, border: 'none', borderRadius: '3px',
                background: disabled ? 'var(--vscode-button-secondaryBackground, rgba(128,128,128,0.3))' : 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)', cursor: disabled ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: disabled ? (kind === 'refine' ? 0.3 : 0.5) : 0.7, transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
        >
            {ICONS[kind]}
        </button>
    );
}
