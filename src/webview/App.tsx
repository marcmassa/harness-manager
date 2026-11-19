import * as React from 'react';
import { canPerform } from './components/SourceOwnershipSection.js';
import { ReactFlowProvider } from '@xyflow/react';
import { WhiteboardCanvas } from './WhiteboardCanvas.js';
import { FeatureSpecPanel } from './FeatureSpecPanel.js';
import { AdvisoryPanel } from './AdvisoryPanel.js';
import { RunAgentPanel } from './RunAgentPanel.js';
import { AgentBuilderWizard } from './AgentBuilderWizard.js';
import { ArchitectureTemplatePanel } from './ArchitectureTemplatePanel.js';
import { OptimizerPanel } from './OptimizerPanel.js';
import { SPACE } from './styles.js';
import { IconGear, IconExpand } from './panelChrome.js';
import { SkeletonLoading, harnessActionBtnStyle, FrameworkBadge, MaturityBadge, EmptyState } from './dashboardChrome.js';
import { vscode } from './vscodeApi.js';
import { NodeDetailPanel } from './NodeDetailPanel.js';
import { DASHBOARD_CSS } from './dashboardStyles.js';
import { useDashboardState } from './useDashboardState.js';
import { useDashboardActions } from './useDashboardActions.js';

export const App = () => {
    const s = useDashboardState();
    const a = useDashboardActions(s);
    const ctx = { ...s, ...a };
    const { data, selectedNode, activeTab, setActiveTab, startWizard, setStartWizard, timelineTargetFeature, advisoryProfile, isAdvisoryScanning, architectureSummary, actionStates, isAuditRunning, optimizerReport, isOptimizerScanning, optimizerEnabled, assistedEnabled, assistedMode, hasTerminalAgent, chatHostName, aiCapabilities, aiModels, selectedAiModel, assistStates, discoveredNodes, runningNodeIds, runAdapters, runPanelNodeId, setRunPanelNodeId, runPanelNode, selectedAdapterId, setSelectedAdapterId, noCliDetected, wizardOpen, setWizardOpen, wizardInitialType, wizardAiCapabilities, setWizardAiCapabilities, lmModels, templatePanelOpen, setTemplatePanelOpen, templates, applyingTemplate, filteredGraph, detectedFrameworks, shouldShowEmptyState, handleNodeSelect, handleDismissSuggestion, handleRescan, optimizerScoresByNodeId, handleAiRefine, handleHandoffToChat, handleDelegate, handleSelectAiModel, handleOptimizerRescan, handleApplyQuickFix, handleDismissFinding, handleRestoreFindings, handleOpenFindingFile, handleExecuteAction, handleApplyHarnessSDD, handleRunSupplyChainAudit, handleRunNode, handleRunAgent, handleOpenWizard, handleWizardCreated, handleOpenTemplates, handleApplyTemplate, lastRunByNodeId, featureList, ownership } = ctx;

    if (!data || !filteredGraph) {
        return <SkeletonLoading />;
    }

    return (
        <div style={{ 
            height: '100vh', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden', 
            background: 'var(--vscode-editor-background)',
            animation: 'appear 0.3s ease-out',
        }}>
            <header style={{ 
                padding: SPACE.sm, 
                borderBottom: '1px solid var(--vscode-panel-border)', 
                zIndex: 10,
                animation: 'fadeInUp 0.35s ease-out',
            }}>
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: SPACE.sm,
                    gap: SPACE.sm,
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.1em', fontWeight: 'normal' }}>
                        Harness <span style={{ opacity: 0.6 }}>Manager</span>
                    </h2>
                    <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center' }}>
                        <FrameworkBadge frameworks={detectedFrameworks} />
                        <button style={harnessActionBtnStyle} onClick={() => handleOpenWizard('feature-spec')}>
                            ✨ Generate Spec
                        </button>
                        <button style={harnessActionBtnStyle} onClick={() => handleOpenWizard()}>
                            + New Node
                        </button>
                        <button
                            type="button"
                            className="harness-settings-button"
                            title="Extension Settings"
                            aria-label="Extension Settings"
                            onClick={() => vscode.postMessage?.({ type: 'openSettings', query: '@ext:marcmassacapo.harness-dashboard-vscode' })}
                        >
                            <IconGear />
                        </button>
                    </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid var(--vscode-panel-border)', marginTop: SPACE.xs }}>
                    {(['whiteboard', 'timeline', 'advisory', 'optimizer'] as const).map(tab => {
                        const label = tab === 'timeline' ? 'Specs Manager'
                            : tab === 'advisory' ? 'Advisory'
                            : tab === 'optimizer' ? 'Optimizer'
                            : 'Whiteboard';
                        return (
                            <div
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    padding: `${SPACE.sm} ${SPACE.md}`,
                                    cursor: 'pointer',
                                    fontSize: '0.75em',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    fontWeight: activeTab === tab ? 700 : 500,
                                    opacity: 1,
                                    // BLOCKER-2 fix: tab-activeForeground is the semantic token for
                                    // tab text (Dark+ = #fff = 15.3:1 AAA; Light+ = #333 = AAA).
                                    // focusBorder (#007fd4) is a focus-ring token, not a text token.
                                    color: activeTab === tab
                                        ? 'var(--vscode-tab-activeForeground)'
                                        : 'var(--vscode-tab-inactiveForeground, var(--vscode-descriptionForeground))',
                                    borderBottom: activeTab === tab
                                        ? '2px solid var(--vscode-focusBorder)'
                                        : '2px solid transparent',
                                    transition: 'color 0.2s ease, opacity 0.2s ease, border-color 0.2s ease',
                                    userSelect: 'none',
                                }}
                            >
                                {label}
                            </div>
                        );
                    })}
                    {/* FEAT-031: Maturity badge — always visible from any tab */}
                    {architectureSummary && (
                        <div style={{ marginLeft: 'auto', paddingRight: SPACE.xs }}>
                            <MaturityBadge summary={architectureSummary} />
                        </div>
                    )}
                </div>
            </header>

            {/* Row: canvas/timeline column + right detail panel */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

            {/* Left column */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <section style={{ 
                flex: 1, 
                position: 'relative', 
                display: activeTab === 'whiteboard' ? 'flex' : 'none', 
                flexDirection: 'column', 
                minHeight: 0,
                animation: activeTab === 'whiteboard' ? 'fadeIn 0.22s ease-out' : 'none',
            }}>
                {shouldShowEmptyState ? (
                    <EmptyState />
                ) : (
                    <ReactFlowProvider>
                        <WhiteboardCanvas
                            graph={filteredGraph}
                            onNodeSelect={handleNodeSelect}
                            selectedNodeId={selectedNode?.id}
                            discoveredNodes={discoveredNodes}
                            runningNodeIds={runningNodeIds}
                            lastRunByNodeId={lastRunByNodeId}
                            onRunNode={handleRunNode}
                            onCreateNode={handleOpenWizard}
                            onOpenTemplates={handleOpenTemplates}
                            scoresByNodeId={optimizerScoresByNodeId}
                        />
                    </ReactFlowProvider>
                )}
                {/* FEAT-033 Phase 2: Architecture Template Panel (slide from left) */}
                {!shouldShowEmptyState && templatePanelOpen && (
                    <ArchitectureTemplatePanel
                        templates={templates}
                        onApply={handleApplyTemplate}
                        onClose={() => setTemplatePanelOpen(false)}
                        applying={applyingTemplate}
                    />
                )}
                {/* FEAT-033: Run Agent Panel overlay (R9) */}
                {runPanelNodeId && runPanelNode && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '340px',
                        height: '100%',
                        background: 'var(--vscode-sideBar-background)',
                        borderLeft: '1px solid var(--vscode-panel-border)',
                        zIndex: 10,
                        overflow: 'auto',
                        boxShadow: '-6px 0 24px rgba(0,0,0,0.35)',
                        animation: 'slideInRight 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}>
                        <RunAgentPanel
                            nodeId={runPanelNode.id}
                            nodeName={runPanelNode.name}
                            nodeFilePath={runPanelNode.filePath}
                            nodeType={runPanelNode.type}
                            adapters={runAdapters}
                            selectedAdapterId={selectedAdapterId}
                            onAdapterChange={setSelectedAdapterId}
                            features={featureList}
                            onRun={handleRunAgent}
                            onClose={() => setRunPanelNodeId(null)}
                            isRunning={runningNodeIds.has(runPanelNode.id)}
                            noCliDetected={noCliDetected}
                        />
                    </div>
                )}
            </section>

            <section style={{
                flex: 1,
                display: activeTab === 'timeline' ? 'flex' : 'none',
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0,
                animation: activeTab === 'timeline' ? 'fadeIn 0.22s ease-out' : 'none',
            }}>
                <FeatureSpecPanel milestones={data.milestones} startWizard={startWizard} targetFeature={timelineTargetFeature} aiCapabilities={aiCapabilities} />
            </section>

            <section style={{ 
                flex: 1, 
                display: activeTab === 'advisory' ? 'flex' : 'none',
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0,
                animation: activeTab === 'advisory' ? 'fadeIn 0.22s ease-out' : 'none',
            }}>
                <AdvisoryPanel profile={advisoryProfile} onDismissSuggestion={handleDismissSuggestion} onApplyHarnessSDD={handleApplyHarnessSDD} onRescan={handleRescan} isScanning={isAdvisoryScanning} onExecuteAction={handleExecuteAction} actionStates={actionStates} onRunSupplyChainAudit={handleRunSupplyChainAudit} isAuditRunning={isAuditRunning} />
            </section>

            {/* FEAT-034: Component Optimizer */}
            <section style={{
                flex: 1,
                display: activeTab === 'optimizer' ? 'flex' : 'none',
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0,
                animation: activeTab === 'optimizer' ? 'fadeIn 0.22s ease-out' : 'none',
            }}>
                <OptimizerPanel
                    canEdit={nodeId => canPerform(ownership[nodeId], 'editing.reviewedTextEdit')}
                    report={optimizerReport}
                    isScanning={isOptimizerScanning}
                    enabled={optimizerEnabled}
                    onRescan={handleOptimizerRescan}
                    onApplyFix={handleApplyQuickFix}
                    onDismissFinding={handleDismissFinding}
                    onRestoreFindings={handleRestoreFindings}
                    onOpenFile={handleOpenFindingFile}
                    onOpenSettings={() => vscode.postMessage?.({ type: 'openSettings', query: 'harness-dashboard.optimizer' })}
                    assistedEnabled={assistedEnabled}
                    assistedMode={assistedMode}
                    hasTerminalAgent={hasTerminalAgent}
                    aiModels={aiModels}
                    selectedAiModel={selectedAiModel}
                    assistStates={assistStates}
                    chatHostName={chatHostName}
                    aiCapabilities={aiCapabilities}
                    onHandoffToChat={handleHandoffToChat}
                    onAiRefine={handleAiRefine}
                    onDelegate={handleDelegate}
                    onSelectAiModel={handleSelectAiModel}
                />
            </section>
            </div>{/* end left column */}

            {/* Right: detail panel — slides in from right when a node is selected */}
            {selectedNode && activeTab === 'whiteboard' && <NodeDetailPanel ctx={ctx} />}
            </div>{/* end row wrapper */}

            {/* ── Wizard — rendered at root so it works from any tab ── */}
            {wizardOpen && data && (
                <AgentBuilderWizard
                    existingNodeIds={data.graph.nodes.map(n => n.id)}
                    existingSkills={data.graph.nodes
                        .filter(n => n.type === 'skill')
                        .map(n => ({ id: n.id, name: n.label }))}
                    onClose={() => setWizardOpen(false)}
                    onCreated={handleWizardCreated}
                    onGenerateSpec={() => {
                        setWizardOpen(false);
                        setActiveTab('timeline');
                        setStartWizard(n => n + 1);
                    }}
                    initialType={wizardInitialType}
                    pendingAiCapabilities={wizardAiCapabilities}
                    onClearAiCapabilities={() => setWizardAiCapabilities(null)}
                    lmModels={lmModels}
                />
            )}

            {/* ── Floating expand button — only shown in sidebar mode ── */}
            {!(window as any).__harness_is_full_window && <button
                title="Open in full-window editor"
                aria-label="Open in full-window editor"
                onClick={() => vscode.postMessage?.({ type: 'openFullWindow' })}
                style={{
                    position: 'fixed',
                    bottom: 14,
                    right: 14,
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    fontSize: '0.72em',
                    fontWeight: 600,
                    background: 'var(--vscode-editorWidget-background)',
                    border: '1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border))',
                    borderRadius: 20,
                    cursor: 'pointer',
                    color: 'var(--vscode-foreground)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    fontFamily: 'inherit',
                    opacity: 0.75,
                    letterSpacing: '0.2px',
                    transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.75')}
            >
                <IconExpand />
                Expand
            </button>}

            <style>{DASHBOARD_CSS}</style>
        </div>
    );
};
