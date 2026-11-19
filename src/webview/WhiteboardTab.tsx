// FEAT-045 T6 — the whiteboard tab's own chunk: React Flow loads only with it.
import * as React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { WhiteboardCanvas } from './WhiteboardCanvas.js';

export default function WhiteboardTab(props: React.ComponentProps<typeof WhiteboardCanvas>) {
    return (
        <ReactFlowProvider>
            <WhiteboardCanvas {...props} />
        </ReactFlowProvider>
    );
}
