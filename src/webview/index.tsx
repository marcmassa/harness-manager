import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { provideVSCodeDesignSystem, allComponents } from '@vscode/webview-ui-toolkit';
import { WhiteboardCanvas } from './WhiteboardCanvas.js';
import { HarnessGraph } from '../types.js';

import 'reactflow/dist/style.css';

provideVSCodeDesignSystem().register(allComponents);

const App = () => {
    const [graph, setGraph] = React.useState<HarnessGraph | null>(null);
    const [selectedNode, setSelectedNode] = React.useState<any>(null);
    const [isCreating, setIsCreating] = React.useState(false);
    const [newNodeName, setNewNodeName] = React.useState('');
    const [newNodeType, setNewNodeType] = React.useState<any>('subagent');

    const vscode = React.useMemo(() => (window as any).acquireVsCodeApi(), []);

    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'init':
                    setGraph(message.data);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ type: 'ready' });

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const onCreateNode = () => {
        if (!newNodeName) return;
        vscode.postMessage({ 
            type: 'createNode', 
            nodeType: newNodeType, 
            name: newNodeName, 
            description: `Mission for ${newNodeName}` 
        });
        setIsCreating(false);
        setNewNodeName('');
    };

    const onDeleteNode = (id: string, type: string) => {
        vscode.postMessage({ type: 'deleteNode', id, nodeType: type });
        setSelectedNode(null);
    };

    if (!graph) {
        return <vscode-progress-ring></vscode-progress-ring>;
    }

    return (
        <main style={{ padding: '10px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Harness Whiteboard</h1>
                <div>
                    <vscode-button onClick={() => setIsCreating(true)}>Add Agent/Skill</vscode-button>
                </div>
            </header>

            {isCreating && (
                <section style={{ padding: '10px', border: '1px solid var(--vscode-panel-border)', marginBottom: '10px' }}>
                    <vscode-text-field value={newNodeName} onInput={(e: any) => setNewNodeName(e.target.value)}>Name</vscode-text-field>
                    <vscode-dropdown value={newNodeType} onChange={(e: any) => setNewNodeType(e.target.value)}>
                        <vscode-option value="subagent">Sub-agent</vscode-option>
                        <vscode-option value="skill">Skill</vscode-option>
                    </vscode-dropdown>
                    <vscode-button onClick={onCreateNode}>Create</vscode-button>
                    <vscode-button appearance="secondary" onClick={() => setIsCreating(false)}>Cancel</vscode-button>
                </section>
            )}
            
            <WhiteboardCanvas graph={graph} onNodeSelect={setSelectedNode} />

            {selectedNode && (
                <section style={{ marginTop: '10px', padding: '10px', background: 'var(--vscode-sideBar-background)', border: '1px solid var(--vscode-panel-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h3>Details: {selectedNode.data.label}</h3>
                        <vscode-button appearance="icon" onClick={() => onDeleteNode(selectedNode.id, selectedNode.type)}>
                            <span className="codicon codicon-trash">Delete</span>
                        </vscode-button>
                    </div>
                    <p><strong>Type:</strong> {selectedNode.type}</p>
                    <vscode-text-area 
                        value={selectedNode.data.metadata.description || ''} 
                        style={{ width: '100%' }}
                        onInput={(e: any) => {
                            vscode.postMessage({ 
                                type: 'updateMetadata', 
                                id: selectedNode.id, 
                                nodeType: selectedNode.type, 
                                metadata: { description: e.target.value } 
                            });
                        }}
                    >Description</vscode-text-area>
                    <vscode-button onClick={() => setSelectedNode(null)}>Close</vscode-button>
                </section>
            )}
        </main>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}


