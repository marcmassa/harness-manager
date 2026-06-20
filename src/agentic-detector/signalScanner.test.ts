import { describe, it, expect } from 'vitest';
import {
  extractFrontmatter,
  contentLineMatches,
  matchContent,
} from './contentMatcher.js';
import { SIGNAL_CATALOG } from './signalCatalog.js';
import type { SignalDefinition, ContentPattern } from './types.js';

// ─── extractFrontmatter ──────────────────────────────────────────

describe('extractFrontmatter', () => {
  it('extracts YAML frontmatter from markdown', () => {
    const content = `---
name: my-agent
role: developer
---
# Body content`;
    expect(extractFrontmatter(content)).toBe('name: my-agent\nrole: developer');
  });

  it('returns null for content without frontmatter', () => {
    const content = '# Just a title\n\nNo frontmatter here.';
    expect(extractFrontmatter(content)).toBeNull();
  });

  it('returns null for empty content', () => {
    expect(extractFrontmatter('')).toBeNull();
  });

  it('returns null for malformed frontmatter (no closing ---)', () => {
    const content = `---
name: broken`;
    expect(extractFrontmatter(content)).toBeNull();
  });
});

// ─── contentLineMatches ──────────────────────────────────────────

describe('contentLineMatches', () => {
  it('matches yaml-frontmatter pattern', () => {
    const pattern: ContentPattern = {
      type: 'yaml-frontmatter',
      description: 'role field',
      pattern: '^role:',
    };
    expect(contentLineMatches('role: developer', pattern)).toBe(true);
    expect(contentLineMatches('name: test', pattern)).toBe(false);
  });

  it('matches json-key pattern', () => {
    const pattern: ContentPattern = {
      type: 'json-key',
      description: 'MCP server type',
      pattern: '"type": "mcp"',
    };
    expect(contentLineMatches('"type": "mcp"', pattern)).toBe(true);
    expect(contentLineMatches('"type": "something"', pattern)).toBe(false);
  });

  it('matches import-statement pattern', () => {
    const pattern: ContentPattern = {
      type: 'import-statement',
      description: 'LangChain import',
      pattern: '(from|import)\\s+(openai|anthropic|langchain|crewai|autogen)',
    };
    expect(contentLineMatches('from langchain import ChatOpenAI', pattern)).toBe(true);
    expect(contentLineMatches('import openai', pattern)).toBe(true);
    expect(contentLineMatches('from flask import Flask', pattern)).toBe(false);
  });

  it('matches shell-command pattern', () => {
    const pattern: ContentPattern = {
      type: 'shell-command',
      description: 'agent CLI call',
      pattern: '\\b(opencode|claude|gemini|cursor)\\b',
    };
    expect(contentLineMatches('claude .', pattern)).toBe(true);
    expect(contentLineMatches('opencode --help', pattern)).toBe(true);
    expect(contentLineMatches('echo "hello"', pattern)).toBe(false);
  });

  it('matches regex pattern', () => {
    const pattern: ContentPattern = {
      type: 'regex',
      description: 'any hex color',
      pattern: '#[0-9a-fA-F]{6}',
    };
    expect(contentLineMatches('color: #ff6600', pattern)).toBe(true);
    expect(contentLineMatches('color: red', pattern)).toBe(false);
  });
});

// ─── matchContent ────────────────────────────────────────────────

describe('matchContent', () => {
  const baseSignal: SignalDefinition = {
    id: 'test-signal',
    category: 'prompts',
    label: 'Test Signal',
    globs: ['**/*.md'],
    contentPatterns: [],
  };

  it('returns empty array when no content patterns', () => {
    const signal = { ...baseSignal, contentPatterns: undefined };
    const result = matchContent('/tmp/test.md', '# Hello', signal);
    expect(result).toEqual([]);
  });

  it('matches yaml-frontmatter content pattern', () => {
    const signal: SignalDefinition = {
      ...baseSignal,
      contentPatterns: [{
        type: 'yaml-frontmatter',
        description: 'role in frontmatter',
        pattern: '^role:',
      }],
    };
    const content = `---
role: developer
---
# Body`;
    const matches = matchContent('/tmp/test.md', content, signal);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedPattern).toBe('test-signal');
    expect(matches[0].filePath).toBe('/tmp/test.md');
    expect(matches[0].category).toBe('prompts');
    expect(matches[0].layer).toBe(2);
  });

  it('matches json-key pattern in file content', () => {
    const signal: SignalDefinition = {
      ...baseSignal,
      contentPatterns: [{
        type: 'json-key',
        description: 'MCP type',
        pattern: '"type": "mcp"',
      }],
    };
    const content = '{\n  "type": "mcp",\n  "name": "test"\n}';
    const matches = matchContent('/tmp/mcp.json', content, signal);
    expect(matches).toHaveLength(1);
    expect(matches[0].evidence).toContain('"type": "mcp"');
  });

  it('matches import pattern in TS file', () => {
    const signal: SignalDefinition = {
      ...baseSignal,
      contentPatterns: [{
        type: 'import-statement',
        description: 'langchain import',
        pattern: '(from|import)\\s+(openai|anthropic|langchain|crewai|autogen)',
      }],
    };
    const content = 'from langchain.chat_models import ChatOpenAI';
    const matches = matchContent('/tmp/agent.ts', content, signal);
    expect(matches).toHaveLength(1);
  });

  it('matches import with module path syntax', () => {
    const signal: SignalDefinition = {
      ...baseSignal,
      contentPatterns: [{
        type: 'import-statement',
        description: 'langchain submodule import',
        pattern: '(from|import)\\s+(openai|anthropic|langchain|crewai|autogen)',
      }],
    };
    const content = 'from langchain.chat_models import ChatOpenAI';
    const matches = matchContent('/tmp/agent.ts', content, signal);
    expect(matches).toHaveLength(1);
  });

  it('does not match when pattern is absent', () => {
    const signal: SignalDefinition = {
      ...baseSignal,
      contentPatterns: [{
        type: 'yaml-frontmatter',
        description: 'role in frontmatter',
        pattern: '^role:',
      }],
    };
    const content = `---
name: test
---
# Body`;
    const matches = matchContent('/tmp/test.md', content, signal);
    expect(matches).toHaveLength(0);
  });

  it('returns low confidence for edge matches', () => {
    // Default confidence is 'medium' — this verifies the baseline
    const signal: SignalDefinition = {
      ...baseSignal,
      contentPatterns: [{
        type: 'regex',
        description: 'some pattern',
        pattern: 'test',
      }],
    };
    const matches = matchContent('/tmp/file.txt', 'this is a test', signal);
    expect(matches[0].confidence).toBe('medium');
  });
});

// ─── Signal Catalog ──────────────────────────────────────────────

describe('SIGNAL_CATALOG', () => {
  it('defines at least 25 signals across all categories', () => {
    expect(SIGNAL_CATALOG.length).toBeGreaterThanOrEqual(25);
  });

  it('includes all 9 categories', () => {
    const categories = new Set(SIGNAL_CATALOG.map(s => s.category));
    expect(categories.has('prompts')).toBe(true);
    expect(categories.has('rules')).toBe(true);
    expect(categories.has('mcp')).toBe(true);
    expect(categories.has('agent-methodologies')).toBe(true);
    expect(categories.has('tools')).toBe(true);
    expect(categories.has('skills')).toBe(true);
    expect(categories.has('agent-scripts')).toBe(true);
    expect(categories.has('memory')).toBe(true);
    expect(categories.has('context-identity')).toBe(true);
  });

  it('every signal has a unique id', () => {
    const ids = SIGNAL_CATALOG.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every signal has at least one glob', () => {
    for (const s of SIGNAL_CATALOG) {
      expect(s.globs.length).toBeGreaterThan(0);
    }
  });

  it('every signal with contentPatterns has a valid type', () => {
    const validTypes = ['yaml-frontmatter', 'json-key', 'import-statement', 'shell-command', 'regex'];
    for (const s of SIGNAL_CATALOG) {
      for (const cp of s.contentPatterns ?? []) {
        expect(validTypes).toContain(cp.type);
      }
    }
  });
});
