import * as React from 'react';
import type { ActionButtonState } from './AdvisoryPanel.js';  // FEAT-032
import type { RunHistoryEntry } from '../run/types.js';
import { AgentBuilderWizard } from './AgentBuilderWizard.js';
import type { ArchitectureTemplate } from '../whiteboard/architectureTemplates.js';
import type { OptimizerFinding, OptimizerReport } from '../optimizer/types.js';
import type { ResourceOwnership } from '../operations/operationGate.js';
import { DashboardData, MarkdownFileContent } from '../types.js';
import { profileToDiscoveredNodes } from '../agentic-detector/profileToNodes.js';
import { vscode } from './vscodeApi.js';

/** All Dashboard webview state and the host message listener. */
export function useDashboardState() {
    const [data, setData] = React.useState<DashboardData | null>(null);
    const [selectedNode, setSelectedNode] = React.useState<any>(null);
    // FEAT-041 T3: host decisions per resource (provider, native path, operations).
    const [ownership, setOwnership] = React.useState<Record<string, ResourceOwnership>>({});
    // FEAT-045 R6: restore the last tab (webview state survives a reload; the host passes it to a restored panel).
    const [activeTab, setActiveTab] = React.useState<string>(() =>
        (vscode.getState?.()?.tab as string | undefined) ?? ((window as any).__harness_initial_tab as string | undefined) ?? 'whiteboard');
    React.useEffect(() => { vscode.setState?.({ ...(vscode.getState?.() ?? {}), tab: activeTab }); }, [activeTab]);
    const [startWizard, setStartWizard] = React.useState(0); // increment to trigger wizard in Specs Manager
    const [timelineTargetFeature, setTimelineTargetFeature] = React.useState<string | null>(null); // FEAT node click → select in timeline
    
    // FEAT-029: Agentic detection profile from extension
    const [advisoryProfile, setAdvisoryProfile] = React.useState<any>(null);
    // FEAT-031: scanning state + architecture summary for the tab badge
    const [isAdvisoryScanning, setIsAdvisoryScanning] = React.useState(false);
    const [architectureSummary, setArchitectureSummary] = React.useState<any>(null);
    // FEAT-032: per-action button states keyed by `"${suggestionId}::${actionId}"`
    const [actionStates, setActionStates] = React.useState<Record<string, ActionButtonState>>({});
    // FEAT-034: Component Optimizer report + scan state
    const [optimizerReport, setOptimizerReport] = React.useState<OptimizerReport | null>(null);
    const [isOptimizerScanning, setIsOptimizerScanning] = React.useState(false);
    // The host owns the `optimizer.enabled` setting; a disabled report is
    // indistinguishable from an empty one, so the flag travels with the report.
    const [optimizerEnabled, setOptimizerEnabled] = React.useState(true);
    // FEAT-035: assisted fixes
    const [assistedEnabled, setAssistedEnabled] = React.useState(false);
    const [assistedMode, setAssistedMode] = React.useState<'both' | 'ai-only' | 'delegate-only'>('both');
    const [hasTerminalAgent, setHasTerminalAgent] = React.useState(false);
    const [chatHostName, setChatHostName] = React.useState<string | undefined>(undefined);
    // FEAT-036: what this host can actually do for AI generation.
    const [aiCapabilities, setAiCapabilities] = React.useState<
        { hasEditorModel: boolean; chatHostName?: string; hasApiKey: boolean } | undefined
    >(undefined);
    const [aiModels, setAiModels] = React.useState<string[]>([]);
    const [selectedAiModel, setSelectedAiModel] = React.useState('');
    const [assistStates, setAssistStates] = React.useState<Record<string, { state: 'idle' | 'pending' | 'ok' | 'error'; reason?: string }>>({});

    // Phase 5: Discovered nodes from AgenticProfile — transformed for the whiteboard
    const [discoveredNodes, setDiscoveredNodes] = React.useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });

    // FEAT-033: Agent Run Panel state
    const [runningNodeIds, setRunningNodeIds] = React.useState<Set<string>>(new Set());
    const [runHistory, setRunHistory] = React.useState<RunHistoryEntry[]>([]);
    const [runAdapters, setRunAdapters] = React.useState<{ id: string; name: string }[]>([{ id: 'generic', name: 'Open in Editor' }]);
    const [runPanelNodeId, setRunPanelNodeId] = React.useState<string | null>(null);
    const [runPanelNode, setRunPanelNode] = React.useState<{ id: string; name: string; filePath: string; type: 'agent' | 'subagent' | 'skill' } | null>(null);
    const [selectedAdapterId, setSelectedAdapterId] = React.useState('generic');
    const [noCliDetected, setNoCliDetected] = React.useState(false);
    // Relative time for "last run" badges — tick every 60 s
    const [, setTimeTick] = React.useState(0);
    
    // FEAT-033 Phase 2: Agent Builder Wizard state
    const [wizardOpen, setWizardOpen] = React.useState(false);
    const [wizardInitialType, setWizardInitialType] = React.useState<import('./AgentBuilderWizard.js').WizardNodeType | undefined>(undefined);
    const [wizardAiCapabilities, setWizardAiCapabilities] = React.useState<string[] | null>(null);
    const [lmModels, setLmModels] = React.useState<Array<{ family: string; name: string; vendor: string }>>([]);

    // FEAT-033 Phase 2: Architecture Templates state
    const [templatePanelOpen, setTemplatePanelOpen] = React.useState(false);
    const [templates, setTemplates] = React.useState<ArchitectureTemplate[]>([]);
    const [applyingTemplate, setApplyingTemplate] = React.useState(false);
    
    // MD viewer state
    const [mdContent, setMdContent] = React.useState<MarkdownFileContent | null>(null);
    const [mdLoading, setMdLoading] = React.useState(false);
    // Detail panel tab (FEAT-011 redesigned panel)
    const [detailTab, setDetailTab] = React.useState<'description' | 'markdown'>('description');
    const [isDetailPanelCollapsed, setIsDetailPanelCollapsed] = React.useState(false);

    // Listen for messages from extension
    React.useEffect(() => {
        console.log('Webview: Initializing...');
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            console.log('Webview: Received message', message.type);
            switch (message.type) {
                case 'init':
                    setData(message.data);
                    setOwnership(message.ownership ?? {});
                    break;
                case 'operationDenied':
                    // The host already explained why; refresh so the UI matches its decision.
                    vscode.postMessage({ type: 'getData' });
                    break;
                case 'markdownContent':
                    setMdContent(message.content);
                    setMdLoading(false);
                    break;
                case 'advisoryProfile':
                    setAdvisoryProfile(message.profile);
                    setIsAdvisoryScanning(false);
                    // Phase 5: Transform the AgenticProfile into discovered nodes for the whiteboard
                    if (message.profile) {
                        const result = profileToDiscoveredNodes(
                            message.profile,
                            new Set(message.profile.acknowledgedNodeIds || [])
                        );
                        setDiscoveredNodes(result);
                    }
                    break;
                case 'architectureSummary':
                    setArchitectureSummary(message);
                    setIsAdvisoryScanning(message.isScanning === true);
                    break;
                // FEAT-034: Component Optimizer
                case 'optimizerReport':
                    setOptimizerReport(message.report);
                    setOptimizerEnabled(message.enabled !== false);
                    setAssistedEnabled(message.assistedEnabled === true);
                    if (message.assistedMode) setAssistedMode(message.assistedMode);
                    setHasTerminalAgent(message.hasTerminalAgent === true);
                    setChatHostName(message.chatHostName);
                    setIsOptimizerScanning(false);
                    break;
                case 'optimizerAiModels':
                    setAiModels(message.models ?? []);
                    setSelectedAiModel(message.selected ?? '');
                    break;
                case 'aiRefineResult': {
                    const key = `${message.ruleId}::${message.nodeId}`;
                    setAssistStates(prev => ({
                        ...prev,
                        [key]: message.ok ? { state: 'ok' } : { state: 'error', reason: message.reason },
                    }));
                    break;
                }
                case 'aiCapabilities':
                    setAiCapabilities({
                        hasEditorModel: message.hasEditorModel === true,
                        chatHostName: message.chatHostName,
                        hasApiKey: message.hasApiKey === true,
                    });
                    break;
                case 'handoffResult': {
                    const key = `${message.ruleId}::${message.nodeId}`;
                    setAssistStates(prev => ({
                        ...prev,
                        [key]: message.ok
                            ? { state: 'ok', reason: `sent to ${message.host}` }
                            : { state: 'error', reason: message.reason },
                    }));
                    break;
                }
                case 'delegateResult':
                    if (!message.ok && message.reason !== 'cancelled') {
                        console.warn('[Optimizer] delegation failed:', message.reason);
                    }
                    break;
                case 'quickFixResult':
                    // A successful fix triggers a re-scan host-side, whose report
                    // arrives as its own 'optimizerReport' message. A cancel or a
                    // failure only needs to clear the pending state.
                    if (!message.ok) setIsOptimizerScanning(false);
                    break;
                case 'activateTab':
                    if (typeof message.tab === 'string') setActiveTab(message.tab);
                    break;
                // FEAT-032: advisory action result
                case 'advisoryActionResult': {
                    const { suggestionId, actionId, ok } = message as { suggestionId: string; actionId: string; ok: boolean };
                    const key = `${suggestionId}::${actionId}`;
                    const newState: ActionButtonState = ok ? 'success' : 'error';
                    setActionStates(prev => ({ ...prev, [key]: newState }));
                    setTimeout(() => setActionStates(prev => ({ ...prev, [key]: 'idle' })), 2500);
                    break;
                }
                // FEAT-033: Agent Run Panel messages
                case 'runAdapters':
                    setRunAdapters(message.adapters as { id: string; name: string }[]);
                    setNoCliDetected(Boolean(message.noCliDetected));
                    if (Array.isArray(message.adapters) && message.adapters.length > 0) {
                        // Pick first non-generic adapter as default, fall back to generic
                        const preferred = (message.adapters as { id: string }[]).find(a => a.id !== 'generic');
                        setSelectedAdapterId((preferred ?? message.adapters[0]).id);
                    }
                    break;
                case 'agentRunStarted':
                    setRunningNodeIds(prev => new Set([...prev, message.nodeId as string]));
                    break;
                case 'agentRunEnded':
                    setRunningNodeIds(prev => {
                        const n = new Set(prev);
                        n.delete(message.nodeId as string);
                        return n;
                    });
                    break;
                case 'runHistory':
                    setRunHistory(message.history as RunHistoryEntry[]);
                    break;
                // FEAT-033 Phase 2: AI description result for wizard
                case 'agentDescriptionResult':
                    setWizardAiCapabilities(message.capabilities as string[]);
                    break;
                // FEAT-033 Provider selector: available vscode.lm models
                case 'lmModels':
                    setLmModels((message.models ?? []) as Array<{ family: string; name: string; vendor: string }>);
                    break;
                // FEAT-033 Phase 2: Architecture templates list
                case 'architectureTemplates':
                    setTemplates(message.templates as ArchitectureTemplate[]);
                    setApplyingTemplate(false);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ type: 'ready' });
        // FEAT-036: probe once — the webview cannot inspect the host itself.
        vscode.postMessage({ type: 'getAiCapabilities' });
        // FEAT-033: Request available adapters on load
        vscode.postMessage({ type: 'getRunAdapters' });
        vscode.postMessage({ type: 'getRunHistory' });

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return { data, setData, selectedNode, setSelectedNode, ownership, setOwnership, activeTab, setActiveTab, startWizard, setStartWizard, timelineTargetFeature, setTimelineTargetFeature, advisoryProfile, setAdvisoryProfile, isAdvisoryScanning, setIsAdvisoryScanning, architectureSummary, setArchitectureSummary, actionStates, setActionStates,  optimizerReport, setOptimizerReport, isOptimizerScanning, setIsOptimizerScanning, optimizerEnabled, setOptimizerEnabled, assistedEnabled, setAssistedEnabled, assistedMode, setAssistedMode, hasTerminalAgent, setHasTerminalAgent, chatHostName, setChatHostName, aiCapabilities, setAiCapabilities, aiModels, setAiModels, selectedAiModel, setSelectedAiModel, assistStates, setAssistStates, discoveredNodes, setDiscoveredNodes, runningNodeIds, setRunningNodeIds, runHistory, setRunHistory, runAdapters, setRunAdapters, runPanelNodeId, setRunPanelNodeId, runPanelNode, setRunPanelNode, selectedAdapterId, setSelectedAdapterId, noCliDetected, setNoCliDetected, setTimeTick, wizardOpen, setWizardOpen, wizardInitialType, setWizardInitialType, wizardAiCapabilities, setWizardAiCapabilities, lmModels, setLmModels, templatePanelOpen, setTemplatePanelOpen, templates, setTemplates, applyingTemplate, setApplyingTemplate, mdContent, setMdContent, mdLoading, setMdLoading, detailTab, setDetailTab, isDetailPanelCollapsed, setIsDetailPanelCollapsed };
}

export type DashboardState = ReturnType<typeof useDashboardState>;
