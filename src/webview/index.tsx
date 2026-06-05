import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { provideVSCodeDesignSystem, allComponents } from '@vscode/webview-ui-toolkit';

provideVSCodeDesignSystem().register(allComponents);

const App = () => {
    const [message, setMessage] = React.useState('Initializing...');

    React.useEffect(() => {
        const vscode = (window as any).acquireVsCodeApi();
        
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'init':
                    setMessage(message.data);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ type: 'ready' });

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return (
        <main>
            <h1>{message}</h1>
            <vscode-divider></vscode-divider>
            <vscode-badge>MVP Phase 1</vscode-badge>
        </main>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}

