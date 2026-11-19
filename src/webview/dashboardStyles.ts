// Global stylesheet of the Dashboard webview, extracted from index.tsx.
export const DASHBOARD_CSS = `
                :root {
                    --space-xs: 4px;
                    --space-sm: 8px;
                    --space-md: 16px;
                    --space-lg: 24px;
                    --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
                }
                .harness-panel-action-button {
                    width: 30px;
                    height: 30px;
                    border-radius: 6px;
                    border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
                    background: var(--vscode-toolbar-hoverBackground, color-mix(in srgb, var(--vscode-sideBar-background) 80%, var(--vscode-editor-background)));
                    color: var(--vscode-foreground);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease, color 0.16s ease;
                    padding: 0;
                }
                .harness-panel-action-button:hover {
                    background: var(--vscode-list-hoverBackground);
                    border-color: var(--vscode-focusBorder);
                }
                .harness-panel-action-button:active {
                    transform: scale(0.96);
                }
                .harness-panel-action-button--danger {
                    background: color-mix(in srgb, var(--vscode-errorForeground, #e86f4a) 16%, transparent);
                    border-color: color-mix(in srgb, var(--vscode-errorForeground, #e86f4a) 42%, var(--vscode-panel-border));
                    color: color-mix(in srgb, var(--vscode-errorForeground, #e86f4a) 90%, var(--vscode-foreground));
                }
                .harness-panel-action-button--danger:hover {
                    background: color-mix(in srgb, var(--vscode-errorForeground, #e86f4a) 24%, transparent);
                    color: var(--vscode-errorForeground, #e86f4a);
                    border-color: var(--vscode-errorForeground, #e86f4a);
                }
                .harness-panel-action-button:focus-visible {
                    outline: 2px solid var(--vscode-focusBorder);
                    outline-offset: 1px;
                }

                /* Settings gear button in the header toolbar */
                .harness-settings-button {
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    border: none;
                    background: transparent;
                    color: var(--vscode-foreground, var(--vscode-sideBar-foreground));
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    padding: 0;
                    transition: background 0.16s ease, color 0.16s ease;
                }
                .harness-settings-button:hover {
                    background: var(--vscode-toolbar-hoverBackground, color-mix(in srgb, var(--vscode-sideBar-background) 80%, var(--vscode-editor-background)));
                    color: var(--vscode-foreground);
                }
                .harness-settings-button:active {
                    transform: scale(0.92);
                }
                .harness-settings-button:focus-visible {
                    outline: 2px solid var(--vscode-focusBorder);
                    outline-offset: 1px;
                }

                /* ===== ANIMATIONS ===== */
                @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
                @keyframes appear { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeInLeft { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes popIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
                /* FEAT-034: Optimizer re-scan spinner */
                @keyframes harnessSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                /* FEAT-033: Running node pulse animation (R12) */
                @keyframes runPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(99, 179, 237, 0.4); }
                    50%       { box-shadow: 0 0 0 6px rgba(99, 179, 237, 0); }
                }
                .harness-node--running {
                    animation: runPulse 1.2s ease-out infinite;
                    --run-color-rgb: 99, 179, 237;
                }

                @keyframes pickerFadeIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                @keyframes pickerItemFadeIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes shimmer {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.6; }
                }
                @keyframes dotPulse {
                    0%, 100% { box-shadow: 0 0 0 2px var(--vscode-editorInfo-foreground); transform: scale(1); }
                    50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--vscode-editorInfo-foreground) 25%, transparent); transform: scale(1.2); }
                }
                @keyframes mismatchPulse {
                    0%, 100% { border-color: rgba(232, 111, 74, 0.4); }
                    50% { border-color: rgba(232, 111, 74, 1); }
                }

                /* ===== REACT FLOW OVERRIDES ===== */
                .react-flow__controls {
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    background: var(--vscode-editor-background);
                }
                .react-flow__controls-button {
                    transition: background 0.15s var(--ease-smooth);
                }
                .react-flow__controls-button:hover {
                    background: var(--vscode-list-hoverBackground);
                }

                .react-flow__node:hover { z-index: 10; }

                /* ===== FEAT-023 R19 — node appear/disappear animation ===== */
                @keyframes nodeAppear {
                    from {
                        opacity: 0;
                        transform: scale(0.85);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                .node-enter {
                    animation: nodeAppear 200ms ease-out forwards;
                }
                @media (prefers-reduced-motion: reduce) {
                    .node-enter {
                        animation: none;
                    }
                }

                /* ===== ACTIVE NODE — panel open ===== */
                @keyframes activeNodePulse {
                    0%, 100% {
                        box-shadow:
                            0 0 0 3px var(--vscode-focusBorder),
                            0 0 0 7px rgba(0, 122, 204, 0.22),
                            0 0 24px 8px rgba(0, 122, 204, 0.15),
                            0 12px 40px rgba(0,0,0,0.5);
                    }
                    50% {
                        box-shadow:
                            0 0 0 3px var(--vscode-focusBorder),
                            0 0 0 11px rgba(0, 122, 204, 0.12),
                            0 0 36px 12px rgba(0, 122, 204, 0.28),
                            0 12px 40px rgba(0,0,0,0.5);
                    }
                }
                .react-flow__node.harness-active-node {
                    z-index: 20;
                }
                .react-flow__node.harness-active-node .harness-node {
                    border: 2px solid var(--vscode-focusBorder) !important;
                    box-shadow:
                        0 0 0 3px var(--vscode-focusBorder),
                        0 0 0 7px rgba(0, 122, 204, 0.22),
                        0 0 24px 8px rgba(0, 122, 204, 0.15),
                        0 12px 40px rgba(0,0,0,0.5) !important;
                    animation: activeNodePulse 2.4s ease-in-out infinite !important;
                }

                /* ===== DESCRIPTION TEXTAREA — fills right panel ===== */
                .hd-textarea.hd-description {
                    flex: 1;
                    min-height: 100px;
                    resize: vertical;
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    line-height: 1.5;
                }

                /* ===== EDGE VISIBILITY ===== */
                /* FEAT-023 R21 — edge style transitions: stroke, stroke-width,
                   opacity, stroke-dasharray animate over 150ms when the
                   edge's style changes (e.g., from "manages" to "uses"
                   after a re-parse, or from "uses" to "disabled" after
                   the user toggles a connection). */
                .react-flow__edge-path {
                    transition:
                        stroke 150ms ease,
                        stroke-width 150ms ease,
                        opacity 150ms ease,
                        stroke-dasharray 150ms ease;
                }
                @media (prefers-reduced-motion: reduce) {
                    .react-flow__edge-path {
                        transition: none;
                    }
                }

                @keyframes dash-scroll {
                    from { stroke-dashoffset: 24; }
                    to   { stroke-dashoffset: 0; }
                }

                /* manages (blue) */
                .harness-edge--manages .react-flow__edge-path {
                    filter: drop-shadow(0 0 3px rgba(74, 125, 255, 0.30));
                }
                .harness-edge--manages:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 6px rgba(74, 125, 255, 0.50));
                    stroke-width: 5 !important;
                }
                .harness-edge--manages.selected .react-flow__edge-path {
                    filter: drop-shadow(0 0 10px rgba(74, 125, 255, 0.70));
                    stroke-width: 5 !important;
                }

                /* uses (teal) */
                .harness-edge--uses .react-flow__edge-path {
                    filter: drop-shadow(0 0 3px rgba(42, 161, 152, 0.30));
                }
                .harness-edge--uses:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 6px rgba(42, 161, 152, 0.50));
                    stroke-width: 4.5 !important;
                }
                .harness-edge--uses.selected .react-flow__edge-path {
                    filter: drop-shadow(0 0 10px rgba(42, 161, 152, 0.70));
                    stroke-width: 4.5 !important;
                }

                /* executing (orange) */
                .harness-edge--executing .react-flow__edge-path {
                    filter: drop-shadow(0 0 3px rgba(232, 111, 74, 0.30));
                }
                .harness-edge--executing:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 6px rgba(232, 111, 74, 0.50));
                    stroke-width: 5.5 !important;
                }
                .harness-edge--executing.selected .react-flow__edge-path {
                    filter: drop-shadow(0 0 10px rgba(232, 111, 74, 0.70));
                    stroke-width: 5.5 !important;
                }

                /* discovered (grey) */
                .harness-edge--discovered .react-flow__edge-path {
                    filter: drop-shadow(0 0 2px rgba(108, 108, 138, 0.20));
                }
                .harness-edge--discovered:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 5px rgba(108, 108, 138, 0.40));
                    stroke-width: 3.5 !important;
                }
                .harness-edge--discovered.selected .react-flow__edge-path {
                    filter: drop-shadow(0 0 8px rgba(108, 108, 138, 0.60));
                    stroke-width: 3.5 !important;
                }

                /* suggested (amber) — scroll animation */
                .harness-edge--suggested .react-flow__edge-path {
                    filter: drop-shadow(0 0 3px rgba(212, 168, 74, 0.25));
                    animation: dash-scroll 1.2s linear infinite;
                }
                .harness-edge--suggested:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 6px rgba(212, 168, 74, 0.50));
                    stroke-width: 4 !important;
                }
                .harness-edge--suggested.selected .react-flow__edge-path {
                    filter: drop-shadow(0 0 10px rgba(212, 168, 74, 0.70));
                    stroke-width: 4 !important;
                }

                /* governs (amber, solid) */
                .harness-edge--governs .react-flow__edge-path {
                    filter: drop-shadow(0 0 3px rgba(212, 168, 74, 0.30));
                }
                .harness-edge--governs:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 6px rgba(212, 168, 74, 0.50));
                    stroke-width: 4.5 !important;
                }
                .harness-edge--governs.selected .react-flow__edge-path {
                    filter: drop-shadow(0 0 10px rgba(212, 168, 74, 0.70));
                    stroke-width: 4.5 !important;
                }

                /* inferred (green, subtle dashed) — Phase 5 */
                .harness-edge--inferred .react-flow__edge-path {
                    filter: drop-shadow(0 0 2px rgba(136, 204, 51, 0.20));
                }
                .harness-edge--inferred:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 4px rgba(136, 204, 51, 0.40));
                    stroke-width: 3 !important;
                }
                .harness-edge--inferred.selected .react-flow__edge-path {
                    filter: drop-shadow(0 0 6px rgba(136, 204, 51, 0.60));
                    stroke-width: 3 !important;
                }

                /* triggers (muted purple, dashed) */
                .harness-edge--triggers .react-flow__edge-path {
                    filter: drop-shadow(0 0 3px rgba(108, 108, 138, 0.30));
                }
                .harness-edge--triggers:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 6px rgba(108, 108, 138, 0.50));
                    stroke-width: 4 !important;
                }
                .harness-edge--triggers.selected .react-flow__edge-path {
                    filter: drop-shadow(0 0 10px rgba(108, 108, 138, 0.70));
                    stroke-width: 4 !important;
                }

                /* fallback */
                .harness-edge .react-flow__edge-path {
                    filter: drop-shadow(0 0 2px rgba(136, 136, 136, 0.20));
                }
                .harness-edge:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 5px rgba(136, 136, 136, 0.40));
                    stroke-width: 4 !important;
                }
                .react-flow__edge-textbg {
                    fill: var(--vscode-editor-background) !important;
                    fill-opacity: 0.95 !important;
                }
                .react-flow__edge-text {
                    font-size: 11px !important;
                    font-weight: 600 !important;
                }

                .react-flow__handle-connecting {
                    background: var(--vscode-editorWarning-foreground) !important;
                }
                .react-flow__node.selected { outline: none; }

`;
