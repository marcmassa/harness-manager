// FEAT-037 (React Flow 12 migration) — shared node typings for the whiteboard.
//
// v12 made `Node` generic (`Node<NodeData, NodeType>`) and `NodeProps`
// generic over the node type (design §5). This module defines the data bag
// that WhiteboardCanvas builds for every graph node (see the initialNodes
// map in WhiteboardCanvas.tsx) so CustomNode / DiscoveredNode can read
// `data.label` / `data.metadata._framework` etc. through the FEAT-030
// discriminated union without `as any` at the read sites we control.
import type { Node, NodeProps } from '@xyflow/react';
import type * as React from 'react';
import type { NodeMetadata } from '../types.js';

/** Link-target entries shown in the node's (+) picker (FEAT-017). */
export interface LinkTargetOption {
    id: string;
    label: string;
    alreadyConnected: boolean;
}

/** Optimizer score chip payload (FEAT-034 R45). */
export interface NodeOptimizerScore {
    score: number;
    tier: string;
    findingCount: number;
}

/**
 * The data bag WhiteboardCanvas constructs for every node. Extends
 * Record<string, unknown> (v12's NodeData constraint) with an index
 * signature so forward-compatible extra keys stay legal; the declared
 * members are the ones actually read by the custom node components.
 */
export interface FlowNodeData extends Record<string, unknown> {
    label: string;
    metadata: NodeMetadata;
    /** feature nodes read data.id as a fallback for the FEAT badge */
    id?: string;
    availableLinkTargets?: LinkTargetOption[];
    /** legacy alias kept alive by the pre-FEAT-017 picker flow */
    availableSkills?: LinkTargetOption[];
    onCreateLink?: (sourceId: string, targetId: string) => void;
    /** legacy alias for onCreateLink */
    onAddSkill?: (sourceId: string, targetId: string) => void;
    onSourcePillClick?: (nodeId: string) => void;
    onTargetPillClick?: (nodeId: string) => void;
    onLinkTargetHoverChange?: (nodeId: string, isHovering: boolean) => void;
    onLinkDropOnNode?: (nodeId: string) => void;
    canLinkThroughPills?: boolean;
    isLinkSourceArmed?: boolean;
    isLinkTargetActive?: boolean;
    isDragLinkHoverTarget?: boolean;
    suggestedCount?: number;
    isActive?: boolean;
    isRunning?: boolean;
    lastRunTimestamp?: number;
    onRunNode?: (nodeId: string) => void;
    onContextMenu?: (event: React.MouseEvent) => void;
    optimizerScore?: NodeOptimizerScore;
    [key: string]: unknown;
}

/** A whiteboard node: React Flow node carrying FlowNodeData. */
export type HarnessFlowNode = Node<FlowNodeData>;

/** The props the custom node components receive from React Flow 12. */
export type HarnessNodeProps = NodeProps<HarnessFlowNode>;
