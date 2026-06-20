import type { SignalDefinition, SignalMatch, ContentPattern } from './types.js';

/**
 * Pure functions for content-based heuristic detection.
 * No VS Code dependencies — fully testable in isolation.
 */

// ─── YAML frontmatter extraction ──────────────────────────────────

/**
 * Extract YAML frontmatter from markdown content.
 * Returns the frontmatter string or null.
 */
export function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

// ─── Content line matching ────────────────────────────────────────

/**
 * Check if a content line matches a content pattern.
 */
export function contentLineMatches(line: string, pattern: ContentPattern): boolean {
  switch (pattern.type) {
    case 'yaml-frontmatter': {
      const re = new RegExp(pattern.pattern, 'm');
      return re.test(line);
    }
    case 'json-key': {
      return line.includes(pattern.pattern);
    }
    case 'import-statement': {
      const re = new RegExp(pattern.pattern);
      return re.test(line);
    }
    case 'shell-command': {
      const re = new RegExp(pattern.pattern);
      return re.test(line);
    }
    case 'regex': {
      const re = new RegExp(pattern.pattern);
      return re.test(line);
    }
    default:
      return false;
  }
}

// ─── Full content matching ────────────────────────────────────────

/**
 * Check file content against content patterns.
 * Returns array of matched SignalMatch entries.
 */
export function matchContent(
  filePath: string,
  content: string,
  signal: SignalDefinition,
): SignalMatch[] {
  if (!signal.contentPatterns || signal.contentPatterns.length === 0) {
    return [];
  }

  const matches: SignalMatch[] = [];
  const frontmatter = extractFrontmatter(content);

  for (const pattern of signal.contentPatterns) {
    let matchedLine: string | null = null;

    switch (pattern.type) {
      case 'yaml-frontmatter': {
        if (frontmatter !== null) {
          const fmLines = frontmatter.split('\n');
          for (const fmLine of fmLines) {
            if (contentLineMatches(fmLine, pattern)) {
              matchedLine = fmLine.trim();
              break;
            }
          }
        }
        break;
      }
      case 'json-key':
      case 'import-statement':
      case 'shell-command':
      case 'regex': {
        const lines = content.split('\n');
        for (const line of lines) {
          if (contentLineMatches(line, pattern)) {
            matchedLine = line.trim().slice(0, 200);
            break;
          }
        }
        break;
      }
    }

    if (matchedLine !== null) {
      matches.push({
        filePath,
        category: signal.category,
        matchedPattern: signal.id,
        confidence: 'medium',
        evidence: matchedLine.slice(0, 300),
        layer: 2,
      });
    }
  }

  return matches;
}
