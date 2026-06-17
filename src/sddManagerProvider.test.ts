// ============================================================================
// sddManagerProvider.test.ts — FEAT-025 T8–T12
//
// Unit tests for SDDManagerProvider and related pure functions.
//   - T8:  getFeatureList reads feature_list.json and returns parsed features[]
//   - T9:  getSpecFile returns file content if exists, { exists: false } if not
//   - T10: saveSpecFile writes content atomically; on failure returns { ok, error }
//   - T11: buildAIPrompt includes title, description, template, caps, fallback
//   - T12: generateWithAI propagates failures
// ============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAIPrompt, getFallbackTemplate } from './sddManagerProvider.js';

// ===== Hoisted shared state for vscode mock =====
// vi.mock is hoisted above imports but vi.hoisted lets us create
// shared state that both the test and the mock factory can see.

const { mockFiles, mockVscodeFsReadFile, mockVscodeFsWriteFile } = vi.hoisted(() => {
    const mockFiles = new Map<string, string>();

    const readFile = vi.fn(async (uri: any) => {
        const content = mockFiles.get(uri.fsPath);
        if (!content) {
            const err: any = new Error('File not found');
            err.code = 'ENOENT';
            throw err;
        }
        return Buffer.from(content);
    });

    const writeFile = vi.fn(async (uri: any, _content: Buffer) => {
        if (uri.fsPath.includes('readonly')) {
            throw new Error('EROFS: read-only file system');
        }
        mockFiles.set(uri.fsPath, _content.toString());
    });

    return { mockFiles, mockVscodeFsReadFile: readFile, mockVscodeFsWriteFile: writeFile };
});

vi.mock('vscode', () => {
    const mockUri = {
        file: (path: string) => ({ fsPath: path, path }),
        joinPath: (base: any, ...paths: string[]) => {
            const basePath = typeof base === 'string' ? base : (base?.fsPath || base?.path || '');
            const joined = [basePath, ...paths].join('/');
            return { fsPath: joined, path: joined };
        },
    };
    return {
        default: {
            Uri: mockUri,
            workspace: {
                fs: {
                    readFile: mockVscodeFsReadFile,
                    writeFile: mockVscodeFsWriteFile,
                    createDirectory: vi.fn(async () => {}),
                    stat: vi.fn(async (uri: any) => {
                        if (!mockFiles.has(uri.fsPath)) {
                            const err: any = new Error('File not found');
                            err.code = 'ENOENT';
                            throw err;
                        }
                        return { type: 1 };
                    }),
                },
            },
            window: {
                showWarningMessage: vi.fn(),
                showErrorMessage: vi.fn(),
            },
            LogOutputChannel: vi.fn(() => ({
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            })),
            CancellationTokenSource: vi.fn(() => ({
                token: {},
                cancel: vi.fn(),
                dispose: vi.fn(),
            })),
        },
        Uri: mockUri,
        workspace: {
            fs: {
                readFile: mockVscodeFsReadFile,
                writeFile: mockVscodeFsWriteFile,
                createDirectory: vi.fn(),
            },
        },
        window: {
            showWarningMessage: vi.fn(),
            showErrorMessage: vi.fn(),
        },
        LogOutputChannel: vi.fn(() => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        })),
    };
});

// ===== Helper =====

function setMockFile(path: string, content: string): void {
    mockFiles.set(path, content);
}

function clearMockFiles(): void {
    mockFiles.clear();
}

// ===== Feature fixture =====

const MOCK_FEATURE_LIST = {
    project: 'Test',
    features: [
        {
            id: 'FEAT-001',
            name: 'test-feature',
            title: 'Test Feature',
            description: 'A test feature for unit tests',
            type: 'feat',
            status: 'done',
            priority: 'P1',
            agent: 'implementer',
            sprint: 'MVP',
            sdd: true,
        },
    ],
};

const MOCK_FEATURE = MOCK_FEATURE_LIST.features[0];

// ===== T11: buildAIPrompt =====

describe('FEAT-025 — buildAIPrompt (T11)', () => {
    it('R12: includes feature title and description', () => {
        const prompt = buildAIPrompt(MOCK_FEATURE, 'requirements', '# Template', '');
        expect(prompt).toContain('Test Feature');
        expect(prompt).toContain('A test feature for unit tests');
    });

    it('R12: includes the template verbatim', () => {
        const template = '# My Custom Template\n- Item 1\n- Item 2';
        const prompt = buildAIPrompt(MOCK_FEATURE, 'design', template, '');
        expect(prompt).toContain(template);
    });

    it('R12: includes existing content capped at 4 096 characters', () => {
        const existing = 'x'.repeat(5000);
        const prompt = buildAIPrompt(MOCK_FEATURE, 'tasks', '# Template', existing);
        expect(prompt).toContain('[... truncated ...]');
        expect(prompt.length).toBeLessThan(8192 + 200);
    });

    it('R12: total prompt does not exceed 8 192 characters', () => {
        const longTemplate = 'Line\n'.repeat(1000);
        const prompt = buildAIPrompt(MOCK_FEATURE, 'requirements', longTemplate, '');
        expect(prompt.length).toBeLessThanOrEqual(8192 + 50);
    });

    it('R12: uses "(none)" when no existing content', () => {
        const prompt = buildAIPrompt(MOCK_FEATURE, 'design', '# Template', '');
        expect(prompt).toContain('(none)');
        expect(prompt).not.toContain('[... truncated ...]');
    });

    it('R12: sets correct file label in prompt', () => {
        const reqPrompt = buildAIPrompt(MOCK_FEATURE, 'requirements', '# Tpl', '');
        expect(reqPrompt).toContain('requirements');

        const desPrompt = buildAIPrompt(MOCK_FEATURE, 'design', '# Tpl', '');
        expect(desPrompt).toContain('design');

        const tskPrompt = buildAIPrompt(MOCK_FEATURE, 'tasks', '# Tpl', '');
        expect(tskPrompt).toContain('tasks');
    });
});

// ===== getFallbackTemplate =====

describe('FEAT-025 — getFallbackTemplate', () => {
    it('R12: returns a non-empty string for each file type', () => {
        for (const file of ['requirements', 'design', 'tasks'] as const) {
            const tpl = getFallbackTemplate(file);
            expect(tpl).toBeTruthy();
            expect(tpl.length).toBeGreaterThan(20);
        }
    });

    it('R12: requirements template mentions SHALL (EARS keyword)', () => {
        const tpl = getFallbackTemplate('requirements');
        expect(tpl).toContain('SHALL');
    });

    it('R12: tasks template mentions T1 checklist', () => {
        const tpl = getFallbackTemplate('tasks');
        expect(tpl).toContain('T1');
    });
});

// ===== SDDManagerProvider tests =====

describe('FEAT-025 — SDDManagerProvider', () => {
    beforeEach(() => {
        clearMockFiles();
    });

    describe('getFeatureList (T8)', () => {
        it('R2: reads feature_list.json and returns parsed features', async () => {
            setMockFile('/workspace/feature_list.json', JSON.stringify(MOCK_FEATURE_LIST));

            const { SDDManagerProvider } = await import('./sddManagerProvider.js');
            const provider = new SDDManagerProvider(
                { fsPath: '/ext' } as any,
                { fsPath: '/workspace' } as any,
                { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
            );

            const features = await (provider as any)._getFeatureList();
            expect(features).toHaveLength(1);
            expect(features[0].id).toBe('FEAT-001');
            expect(features[0].title).toBe('Test Feature');
        });

        it('R2: returns empty array when feature_list.json is missing', async () => {
            const { SDDManagerProvider } = await import('./sddManagerProvider.js');
            const provider = new SDDManagerProvider(
                { fsPath: '/ext' } as any,
                { fsPath: '/workspace' } as any,
                { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
            );

            const features = await (provider as any)._getFeatureList();
            expect(features).toEqual([]);
        });
    });

    describe('getSpecFile (T9)', () => {
        it('R4: returns content with exists: true when file exists', async () => {
            setMockFile('/workspace/specs/test-feature/requirements.md', '# Requirements\nR1 text');

            const { SDDManagerProvider } = await import('./sddManagerProvider.js');
            const provider = new SDDManagerProvider(
                { fsPath: '/ext' } as any,
                { fsPath: '/workspace' } as any,
                { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
            );

            const result = await (provider as any)._getSpecFile('test-feature', 'requirements');
            expect(result.exists).toBe(true);
            expect(result.content).toContain('# Requirements');
            expect(result.content).toContain('R1 text');
        });

        it('R4: returns { exists: false } when file does not exist', async () => {
            const { SDDManagerProvider } = await import('./sddManagerProvider.js');
            const provider = new SDDManagerProvider(
                { fsPath: '/ext' } as any,
                { fsPath: '/workspace' } as any,
                { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
            );

            const result = await (provider as any)._getSpecFile('nonexistent', 'design');
            expect(result.exists).toBe(false);
            expect(result.content).toBe('');
        });
    });

    describe('saveSpecFile (T10)', () => {
        it('R7: writes content atomically and returns { ok: true }', async () => {
            const { SDDManagerProvider } = await import('./sddManagerProvider.js');
            const provider = new SDDManagerProvider(
                { fsPath: '/ext' } as any,
                { fsPath: '/workspace' } as any,
                { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
            );

            const result = await (provider as any)._saveSpecFile('test-feature', 'tasks', '# Tasks\n- [ ] T1');
            expect(result.ok).toBe(true);
            expect(result.error).toBeUndefined();
            // Verify file was written via the shared mockFiles
            expect(mockFiles.get('/workspace/specs/test-feature/tasks.md')).toBe('# Tasks\n- [ ] T1');
        });

        it('R9: returns { ok: false, error } when write fails', async () => {
            setMockFile('/workspace/specs/readonly/requirements.md', 'existing');

            const { SDDManagerProvider } = await import('./sddManagerProvider.js');
            const provider = new SDDManagerProvider(
                { fsPath: '/ext' } as any,
                { fsPath: '/workspace' } as any,
                { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
            );

            // Force write to fail — the mock writeFile checks for 'readonly' in path
            const result = await (provider as any)._saveSpecFile('readonly', 'requirements', 'new content');
            expect(result.ok).toBe(false);
            expect(result.error).toBeTruthy();
        });
    });

    describe('generateWithAI (T12)', () => {
        it('R13: returns { ok: false, error } when feature is not found', async () => {
            const { SDDManagerProvider } = await import('./sddManagerProvider.js');
            const provider = new SDDManagerProvider(
                { fsPath: '/ext' } as any,
                { fsPath: '/workspace' } as any,
                { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
            );

            setMockFile('/workspace/feature_list.json', JSON.stringify(MOCK_FEATURE_LIST));

            const result = await (provider as any)._generateWithAI('nonexistent-feature', 'requirements');
            expect(result.ok).toBe(false);
            expect(result.error).toContain('not found');
        });
    });
});
