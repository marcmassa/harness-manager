import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { provideVSCodeDesignSystem, allComponents } from '@vscode/webview-ui-toolkit';
import { App } from './App.js';

import '@xyflow/react/dist/style.css';

provideVSCodeDesignSystem().register(allComponents);

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
