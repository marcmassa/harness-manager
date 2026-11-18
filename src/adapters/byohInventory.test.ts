import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_FRAMEWORKS } from '../frameworks.js';

function rows(file: string, id: RegExp): string[][] {
    return readFileSync('docs/byoh/' + file, 'utf8').split('\n')
        .filter(line => line.startsWith('|'))
        .map(line => line.slice(1, -1).split('|').map(cell => cell.trim()))
        .filter(([first]) => id.test(first));
}

describe('BYOH migration inventory', () => {
    it('classifies every registered feature exactly once and records a migration decision', () => {
        const { features } = JSON.parse(readFileSync('feature_list.json', 'utf8')) as { features: { id: string }[] };
        const inventory = rows('feature-compatibility-matrix.md', /^FEAT-\d+$/);
        expect(inventory.map(([id]) => id).sort()).toEqual(features.map(f => f.id).sort());
        for (const row of inventory) {
            expect(row).toHaveLength(4);
            expect(['shared-core', 'adapter-specific', 'optional-integration', 'repository-development']).toContain(row[2]);
            expect(row[3]).not.toBe('');
        }
    });

    it('documents the seven capability levels for every built-in framework', () => {
        const table = rows('adapter-capabilities.md', /^(Adapter|[a-z][a-z-]*)$/);
        const [header, ...adapters] = table;
        expect(header).toEqual(['Adapter', 'Discovery', 'Hooks', 'Steering', 'Commands', 'Agent runs', 'Editing', 'Validation']);
        expect(adapters.map(([id]) => id).sort()).toEqual(SUPPORTED_FRAMEWORKS.map(f => f.id).sort());
        for (const row of adapters) {
            expect(row).toHaveLength(header.length);
            for (const level of row.slice(1)) expect(['supported', 'partial', 'unsupported']).toContain(level);
        }
    });
});
