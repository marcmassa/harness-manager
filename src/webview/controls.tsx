// FEAT-047 T1 (R1, R2) — native controls in place of @vscode/webview-ui-toolkit.
// Plain elements styled from VS Code theme variables; keyboard and screen-reader
// behaviour come from the native element itself.
import * as React from 'react';

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
    appearance?: 'primary' | 'secondary' | 'icon';
};

export const Button = ({ appearance = 'primary', className, disabled, ...rest }: ButtonProps) => (
    <button
        type="button"
        className={['hd-btn', `hd-btn-${appearance}`, className].filter(Boolean).join(' ')}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        {...rest}
    />
);

export const Badge = ({ className, ...rest }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span className={['hd-badge', className].filter(Boolean).join(' ')} {...rest} />
);

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { 'aria-label': string };

export const TextArea = ({ className, ...rest }: TextAreaProps) => (
    <textarea className={['hd-textarea', className].filter(Boolean).join(' ')} {...rest} />
);

/**
 * A text area that follows `value` from the host while it is not being edited,
 * and keeps the user's text while it has focus, as the toolkit's web component
 * did. Typing never remounts it, so focus and caret survive host echoes.
 */
export const SyncedTextArea = ({ value, onChange, onBlur, ...rest }: Omit<TextAreaProps, 'defaultValue'> & { value: string }) => {
    const [text, setText] = React.useState(value);
    const focused = React.useRef(false);
    React.useEffect(() => { if (!focused.current) setText(value); }, [value]);
    return (
        <TextArea
            {...rest}
            value={text}
            onFocus={() => { focused.current = true; }}
            onBlur={e => { focused.current = false; onBlur?.(e); }}
            onChange={e => { setText(e.target.value); onChange?.(e); }}
        />
    );
};

export const Spinner = ({ label, size = 'medium', style }: { label: string; size?: 'small' | 'medium'; style?: React.CSSProperties }) => (
    <span role="progressbar" aria-label={label} aria-busy="true" className={`hd-spinner hd-spinner-${size}`} style={style} />
);

/** Injected once by App, next to DASHBOARD_CSS. */
export const CONTROLS_CSS = `
.hd-btn { font: inherit; font-size: var(--vscode-font-size); border: 1px solid var(--vscode-button-border, transparent); border-radius: 2px; padding: 4px 11px; cursor: pointer; line-height: 18px; }
.hd-btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.hd-btn-primary:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
.hd-btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
.hd-btn-secondary:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }
.hd-btn-icon { background: transparent; color: inherit; padding: 3px; border-color: transparent; }
.hd-btn-icon:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground); }
.hd-btn:focus-visible, .hd-textarea:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
.hd-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.hd-badge { display: inline-block; min-width: 18px; padding: 3px 6px; border-radius: 11px; box-sizing: border-box; text-align: center; font-size: 11px; line-height: 1; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
.hd-textarea { width: 100%; box-sizing: border-box; resize: vertical; font: inherit; padding: 4px 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; }
.hd-textarea::placeholder { color: var(--vscode-input-placeholderForeground); }
.hd-textarea:read-only { opacity: 0.8; }
.hd-spinner { display: inline-block; box-sizing: border-box; border-radius: 50%; border: 2px solid var(--vscode-progressBar-background); border-right-color: transparent; animation: hd-spin 0.8s linear infinite; }
.hd-spinner-medium { width: 28px; height: 28px; }
.hd-spinner-small { width: 14px; height: 14px; border-width: 1.5px; }
@keyframes hd-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .hd-spinner { animation-duration: 2.4s; } }
`;
