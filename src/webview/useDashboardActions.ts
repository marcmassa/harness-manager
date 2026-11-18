import * as React from 'react';
import { RunAgentPanel } from './RunAgentPanel.js';
import type { RunAgentOpts } from './RunAgentPanel.js';
import { AgentBuilderWizard } from './AgentBuilderWizard.js';
import type { OptimizerFinding, OptimizerReport } from '../optimizer/types.js';
import { vscode } from './vscodeApi.js';
import type { DashboardState } from './useDashboardState.js';

/** Derived data, effects and handlers of the Dashboard webview. */
export function useDashboardActions(s: DashboardState) {
    const { data, selectedNode, setSelectedNode, activeTab, setActiveTab, setTimelineTargetFeature, setIsAdvisoryScanning, setActionStates, setIsAuditRunning, optimizerReport, setIsOptimizerScanning, optimizerEnabled, setSelectedAiModel, setAssistStates, runHistory, runPanelNodeId, setRunPanelNodeId, runPanelNode, setRunPanelNode, setTimeTick, setWizardOpen, setWizardInitialType, setTemplatePanelOpen, templates, setApplyingTemplate, setMdContent, setMdLoading, setDetailTab, setIsDetailPanelCollapsed } = s;

    // FEAT-033: Tick every 60 s to update "last run" relative timestamps (R15)
    React.useEffect(() => {
        const id = window.setInterval(() => setTimeTick(t => t + 1), 60_000);
        return () => window.clearInterval(id);
    }, []);

    // FEAT-033: Open run panel and set node info when runPanelNodeId changes
    React.useEffect(() => {
        if (!runPanelNodeId || !data) {
            setRunPanelNode(null);
            return;
        }
        const node = data.graph.nodes.find(n => n.id === runPanelNodeId);
        if (node) {
            setRunPanelNode({
                id: node.id,
                name: node.label,
                filePath: (node.metadata as Record<string, unknown>)?._filePath as string || '',
                type: node.type as 'agent' | 'subagent' | 'skill',
            });
        }
    }, [runPanelNodeId, data]);

    // When a node is selected, request its Markdown file content (R3) and reset detail tab
    React.useEffect(() => {
        if (selectedNode) {
            setIsDetailPanelCollapsed(false);
            setMdLoading(true);
            setMdContent(null);
            setDetailTab('description');
            vscode.postMessage({ 
                type: 'getMarkdownContent', 
                nodeId: selectedNode.id, 
                nodeType: selectedNode.type,
                filePath: selectedNode.data?.metadata?._filePath,
            });
        } else {
            setMdContent(null);
            setMdLoading(false);
        }
    }, [selectedNode]);

    const filteredGraph = React.useMemo(() => {
        if (!data) return null;
        const baseNodes = data.graph.nodes;
        const baseEdges = data.graph.edges;

        // Always show all node types (specs always visible)
        const nodes = baseNodes;
        const nodeIds = new Set(nodes.map(n => n.id));
        const edges = baseEdges.filter(e => {
            if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) return false;
            // Suggested edges hidden by default (no longer toggled by checkbox)
            if (e.label === 'suggested') return false;
            return true;
        });

        return { nodes, edges };
    }, [data]);

    const detectedFrameworks = React.useMemo(() => {
        if (!data) return [] as string[];
        if (Array.isArray(data.detectedFrameworks) && data.detectedFrameworks.length > 0) {
            return data.detectedFrameworks;
        }
        const frameworkSet = new Set<string>();
        for (const node of data.graph.nodes) {
            const label = node.metadata?._frameworkLabel || node.metadata?._framework;
            if (typeof label === 'string' && label.trim().length > 0) {
                frameworkSet.add(label.trim());
            }
        }
        if (frameworkSet.size === 0 && data.graph.nodes.length > 0) {
            frameworkSet.add('Harness SDD');
        }
        return Array.from(frameworkSet);
    }, [data]);
    const shouldShowEmptyState = Boolean(filteredGraph) && detectedFrameworks.length === 0 && filteredGraph?.nodes.length === 0;

    // Handle node selection from whiteboard — FEAT nodes navigate to Specs Manager
    const handleNodeSelect = React.useCallback((node: any) => {
        if (node?.type === 'feature') {
            // Navigate to Specs Manager tab + select this feature
            // Don't set selectedNode so no stale detail panel shows on Whiteboard return
            setActiveTab('timeline');
            setTimelineTargetFeature(node.id); // e.g. "FEAT-001"
            return;
        }
        setSelectedNode(node);
    }, []);

    // FEAT-029: Dismiss a suggestion from the advisory panel
    const handleDismissSuggestion = React.useCallback((suggestionId: string) => {
        vscode.postMessage({ type: 'dismissAgenticSuggestion', suggestionId });
    }, []);

    // FEAT-031: Trigger a manual re-scan from the Advisory panel
    const handleRescan = React.useCallback(() => {
        setIsAdvisoryScanning(true);
        vscode.postMessage({ type: 'rescanAgentic' });
    }, []);

    // ── FEAT-034: Component Optimizer handlers ──────────────────────────────
    // Score lookup for the whiteboard chips (R45). Empty when the optimizer is
    // off or has not scanned yet, which renders no chips at all.
    const optimizerScoresByNodeId = React.useMemo(() => {
        const map = new Map<string, { score: number; tier: string; findingCount: number }>();
        if (!optimizerEnabled || !optimizerReport?.ok) return map;
        for (const c of optimizerReport.components) {
            // FEAT-043 R3: an unscored component gets no chip rather than a misleading number.
            if (c.score === null || c.tier === null) continue;
            map.set(c.nodeId, { score: c.score, tier: c.tier, findingCount: c.findingCount });
        }
        return map;
    }, [optimizerReport, optimizerEnabled]);

    const handleAiRefine = React.useCallback((finding: OptimizerFinding) => {
        const key = `${finding.ruleId}::${finding.nodeId}`;
        setAssistStates(prev => ({ ...prev, [key]: { state: 'pending' } }));
        vscode.postMessage({ type: 'aiRefineFinding', nodeId: finding.nodeId, ruleId: finding.ruleId });
    }, []);

    const handleHandoffToChat = React.useCallback((finding: OptimizerFinding) => {
        vscode.postMessage({ type: 'handoffToChat', nodeId: finding.nodeId, ruleId: finding.ruleId });
    }, []);

    const handleDelegate = React.useCallback((scope: { kind: string; nodeId?: string; ruleId?: string }) => {
        vscode.postMessage({ type: 'delegateFinding', scope: scope.kind, nodeId: scope.nodeId, ruleId: scope.ruleId });
    }, []);

    const handleSelectAiModel = React.useCallback((model: string) => {
        setSelectedAiModel(model);
        vscode.postMessage({ type: 'setOptimizerAiModel', model });
    }, []);

    const handleOptimizerRescan = React.useCallback(() => {
        setIsOptimizerScanning(true);
        vscode.postMessage({ type: 'runOptimizerScan' });
    }, []);

    const handleApplyQuickFix = React.useCallback((finding: OptimizerFinding) => {
        vscode.postMessage({
            type: 'applyQuickFix',
            nodeId: finding.nodeId,
            ruleId: finding.ruleId,
            fix: finding.fix,
        });
    }, []);

    const handleDismissFinding = React.useCallback((finding: OptimizerFinding) => {
        setIsOptimizerScanning(true);
        vscode.postMessage({
            type: 'dismissOptimizerFinding',
            ruleId: finding.ruleId,
            nodeId: finding.nodeId,
        });
    }, []);

    const handleRestoreFindings = React.useCallback(() => {
        setIsOptimizerScanning(true);
        vscode.postMessage({ type: 'restoreOptimizerFindings' });
    }, []);

    const handleOpenFindingFile = React.useCallback((finding: OptimizerFinding) => {
        vscode.postMessage({
            type: 'openInEditor',
            filePath: finding.filePath,
            line: finding.line,
        });
    }, []);

    // Fetch the report the first time the Optimizer tab is opened, so the scan
    // cost is not paid by users who never visit it.
    React.useEffect(() => {
        if (activeTab === 'optimizer' && optimizerReport === null) {
            setIsOptimizerScanning(true);
            vscode.postMessage({ type: 'getOptimizerReport' });
            vscode.postMessage({ type: 'getOptimizerAiModels' });
        }
    }, [activeTab, optimizerReport]);

    // FEAT-032: Execute an advisory suggestion action
    const handleExecuteAction = React.useCallback((suggestionId: string, actionId: string) => {
        const key = `${suggestionId}::${actionId}`;
        setActionStates(prev => ({ ...prev, [key]: 'running' }));
        vscode.postMessage({ type: 'executeAdvisoryAction', suggestionId, actionId });
    }, []);

    // FEAT-029 T34: Apply Harness+SDD scaffold action
    const handleApplyHarnessSDD = React.useCallback(() => {
        vscode.postMessage({ type: 'applyHarnessSDD' });
    }, []);

    // FEAT-036 R6/R12: user-triggered npm audit (explicit click only).
    const handleRunSupplyChainAudit = React.useCallback(() => {
        setIsAuditRunning(true);
        vscode.postMessage({ type: 'runSupplyChainAudit' });
    }, []);

    // FEAT-033: Open Run Agent Panel from whiteboard node toolbar
    const handleRunNode = React.useCallback((nodeId: string) => {
        setRunPanelNodeId(nodeId);
    }, []);

    // FEAT-033: Execute an agent run
    const handleRunAgent = React.useCallback((opts: RunAgentOpts) => {
        if (!runPanelNode) return;
        vscode.postMessage({
            type: 'runAgent',
            nodeId: runPanelNode.id,
            nodeName: runPanelNode.name,
            nodeFilePath: runPanelNode.filePath,
            nodeType: runPanelNode.type,
            adapterId: opts.adapterId,
            task: opts.task,
            featureName: opts.featureName,
            model: opts.model,
            interactive: opts.interactive,
            extraArgs: opts.extraArgs,
        });
    }, [runPanelNode]);

    // FEAT-033 Phase 2: Open wizard — also request available LM models
    const handleOpenWizard = React.useCallback((initialType?: import('./AgentBuilderWizard.js').WizardNodeType) => {
        vscode.postMessage({ type: 'getLmModels' });
        setWizardInitialType(initialType);
        setWizardOpen(true);
    }, []);

    // FEAT-033 Phase 2: Wizard created a node — refresh data
    const handleWizardCreated = React.useCallback(() => {
        setWizardOpen(false);
        vscode.postMessage({ type: 'getData' });
    }, []);

    // FEAT-033 Phase 2: Open template panel
    const handleOpenTemplates = React.useCallback(() => {
        setTemplatePanelOpen(true);
        if (templates.length === 0) {
            vscode.postMessage({ type: 'getArchitectureTemplates' });
        }
    }, [templates.length]);

    // FEAT-033 Phase 2: Apply a template
    const handleApplyTemplate = React.useCallback((templateId: string) => {
        setApplyingTemplate(true);
        vscode.postMessage({ type: 'applyArchitectureTemplate', templateId });
        // Close the panel after a short delay (data refreshes via init message)
        window.setTimeout(() => {
            setTemplatePanelOpen(false);
            vscode.postMessage({ type: 'getData' });
        }, 1200);
    }, []);

    // FEAT-033: Compute "last run" timestamp per node for badges (R15)
    const lastRunByNodeId = React.useMemo(() => {
        const map: Record<string, number> = {};
        for (const entry of runHistory) {
            if (!map[entry.nodeId] || entry.timestamp > map[entry.nodeId]) {
                map[entry.nodeId] = entry.timestamp;
            }
        }
        return map;
    }, [runHistory]);

    // FEAT-033: Feature list for "Attach feature" in RunAgentPanel
    const featureList = React.useMemo(() => {
        if (!data) return [];
        return data.graph.nodes
            .filter(n => n.type === 'feature')
            .map(n => {
                const m = n.metadata as Record<string, unknown>;
                return {
                    id: n.id,
                    name: (m.name as string) || n.id,
                    title: (m.title as string) || n.label,
                    description: (m.description as string) || '',
                    type: (m.type as string) || '',
                    status: (m.status as string) || '',
                    priority: (m.priority as string) || '',
                    agent: (m.agent as string) || '',
                    sprint: (m.sprint as string) || '',
                    sdd: Boolean(m.sdd),
                    source: 'json' as const,
                };
            });
    }, [data]);


    return { filteredGraph, detectedFrameworks, shouldShowEmptyState, handleNodeSelect, handleDismissSuggestion, handleRescan, optimizerScoresByNodeId, handleAiRefine, handleHandoffToChat, handleDelegate, handleSelectAiModel, handleOptimizerRescan, handleApplyQuickFix, handleDismissFinding, handleRestoreFindings, handleOpenFindingFile, handleExecuteAction, handleApplyHarnessSDD, handleRunSupplyChainAudit, handleRunNode, handleRunAgent, handleOpenWizard, handleWizardCreated, handleOpenTemplates, handleApplyTemplate, lastRunByNodeId, featureList };
}

export type DashboardActions = ReturnType<typeof useDashboardActions>;
export type DashboardContext = DashboardState & DashboardActions;
