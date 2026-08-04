import { describe, it, expect } from 'vitest';
import { isKnownWebviewMessage, type WebviewMessageType } from './types.js';

const KNOWN: WebviewMessageType[] = [
    'ready', 'getData',
    'createNode', 'deleteNode', 'updateMetadata',
    'createEdge', 'deleteEdge', 'confirmAndDeleteEdge',
    'getMarkdownContent', 'openMarkdownFile',
    'acceptSuggestion', 'dismissSuggestion',
    'reassignSkill', 'updateEdgeLabel', 'toggleSkillConnection',
    'getFeatureList', 'getSpecFile', 'saveSpecFile',
    'generateWithAI', 'createSpecFile', 'generateSpecDraft',
    'openInEditor', 'createFeature', 'generateFeatureDescription', 'deleteFeature',
    'dismissAgenticSuggestion', 'applyHarnessSDD',
    'openFullWindow', 'openSettings',
    // FEAT-034: Component Optimizer
    'getOptimizerReport', 'optimizerReport', 'runOptimizerScan', 'applyQuickFix',
    'quickFixResult', 'dismissOptimizerFinding', 'restoreOptimizerFindings',
    // FEAT-035: Assisted Component Fixes
    'aiRefineFinding', 'aiRefineResult', 'delegateFinding', 'delegateResult',
    'getOptimizerAiModels', 'optimizerAiModels', 'setOptimizerAiModel',
    'handoffToChat', 'handoffResult',
    'getAiCapabilities', 'aiCapabilities', 'handoffSpecPrompt',
];

describe('isKnownWebviewMessage — FEAT-030 R5, R6', () => {
    it('accepts every type in KNOWN_MESSAGE_TYPES', () => {
        for (const type of KNOWN) {
            expect(isKnownWebviewMessage({ type }), `should accept '${type}'`).toBe(true);
        }
    });

    it('rejects an empty object', () => {
        expect(isKnownWebviewMessage({})).toBe(false);
    });

    it('rejects a primitive string', () => {
        expect(isKnownWebviewMessage('ready')).toBe(false);
    });

    it('rejects null', () => {
        expect(isKnownWebviewMessage(null)).toBe(false);
    });

    it('rejects undefined', () => {
        expect(isKnownWebviewMessage(undefined)).toBe(false);
    });

    it('rejects an unknown type string', () => {
        expect(isKnownWebviewMessage({ type: '__unknown__' })).toBe(false);
    });

    it('rejects a message with a numeric type', () => {
        expect(isKnownWebviewMessage({ type: 42 })).toBe(false);
    });

    it('accepts a message with extra payload fields', () => {
        expect(isKnownWebviewMessage({ type: 'createNode', name: 'foo', nodeType: 'skill' })).toBe(true);
    });
});
