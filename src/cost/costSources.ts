// FEAT-044 — cost inputs from the components the Optimizer already loaded.
// Pure. Reuses the local estimator (DESIGN.md principle 4: no tokenizer dependency).
import type { ComponentSource } from '../optimizer/types.js';
import { estimateTokens } from '../optimizer/tokenEstimator.js';
import type { CostSource } from './sessionCost.js';

/** Readable, owned components only: a synthetic or missing node has no content to load. */
export function costSourcesFrom(components: readonly ComponentSource[]): CostSource[] {
    return components.flatMap(c => {
        const owner = c.source?.providerId;
        if (!owner || !c.exists) return [];
        const description = typeof c.frontmatter.description === 'string' ? c.frontmatter.description : '';
        return [{
            owner, nodeId: c.nodeId, label: c.label, sourceUri: c.source?.sourceUri,
            loadMode: c.source?.loadMode ?? 'unknown',
            tokens: c.tokenEstimate,
            descriptionTokens: estimateTokens(description),
        }];
    });
}
