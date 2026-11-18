// FEAT-043 R2: architecture radar values from evaluated dimensions only. Pure.
import type { ComponentScore, OptimizerDimension } from '../optimizer/types.js';

const DIMENSIONS: OptimizerDimension[] = ['structure', 'clarity', 'budget', 'integration', 'hygiene', 'consistency'];

/** Mean per dimension over the components that evaluated it; null when none did. */
export function averageDimensions(components: readonly ComponentScore[]): Record<OptimizerDimension, number | null> {
    const out = {} as Record<OptimizerDimension, number | null>;
    for (const d of DIMENSIONS) {
        const values = components.map(c => c.dimensions[d]).filter((v): v is number => v !== null);
        out[d] = values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
    }
    return out;
}
