// FEAT-037 (React Flow 12 / React 19 migration) — ambient declarations for
// the webview.
//
// 1. CSS side-effect imports (`@xyflow/react/dist/style.css`) are bundled by
//    esbuild's CSS loader; tsc just needs to know the module exists.
//    (see css.d.ts for the CSS side-effect declaration; kept apart because
//    pattern ambient modules must live in a global script file).
// 2. The @vscode/webview-ui-toolkit registers **custom elements** (web
//    components). Without React JSX declarations for them, React 19's typed
//    JSX namespace rejects every <vscode-*> tag. Declared permissively —
//    the elements are validated at runtime by the toolkit, not by tsc.
//    (React 19 pattern: augment `react`'s JSX namespace, not the removed
//    global JSX namespace.)
import type { DOMAttributes } from 'react';

interface WebComponentAttributes extends Record<string, unknown> {
    style?: unknown;
    title?: string;
    class?: string;
}

type ToolkitElementProps = DOMAttributes<HTMLElement> & WebComponentAttributes;

declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            'vscode-button': ToolkitElementProps;
            'vscode-badge': ToolkitElementProps;
            'vscode-progress-ring': ToolkitElementProps;
            'vscode-text-area': ToolkitElementProps;
            'vscode-text-field': ToolkitElementProps;
            'vscode-dropdown': ToolkitElementProps;
            'vscode-option': ToolkitElementProps;
            'vscode-checkbox': ToolkitElementProps;
            'vscode-divider': ToolkitElementProps;
        }
    }
}

export {};
