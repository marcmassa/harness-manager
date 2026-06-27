import { parse, stringify } from 'yaml';

const FM_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/;

function parseMatter(content: string): { data: Record<string, unknown>; content: string } {
    const match = content.match(FM_RE);
    if (!match) return { data: {}, content };
    try {
        const parsed = parse(match[1]);
        const data = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
        return { data, content: match[2] };
    } catch {
        return { data: {}, content };
    }
}

function stringifyMatter(body: string, data: Record<string, unknown>): string {
    const fm = stringify(data);
    return `---\n${fm}---\n${body}`;
}

parseMatter.stringify = stringifyMatter;

export default parseMatter;
