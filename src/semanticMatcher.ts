export interface SemanticMatch {
    subagentId: string;
    skillId: string;
    score: number;
    method: 'tfidf' | 'llm' | 'hybrid';
}

export interface SemanticMatcherOptions {
    threshold?: number;
    /** Optional LLM scorer callback (R8). Receives subagent and skill descriptions,
     *  returns a relevance score [0.0, 1.0]. When provided, top-K TF-IDF candidates
     *  per subagent are re-ranked and their scores averaged with LLM scores. */
    llmScorer?: (subagentDesc: string, skillDesc: string) => Promise<number>;
    llmTopK?: number;
    /** N-gram size for tokenization (R9). Default 1 (unigram only). */
    nGramSize?: number;
    /** Optional name-boost map: entity-id → multiplier (R4-R5). */
    nameBoostMap?: Map<string, number>;
    /** Maximum number of suggested skills to keep per subagent after scoring. */
    maxSuggestionsPerSubagent?: number;
}

export interface EntityContent {
    id: string;
    description: string;
    fullBody?: string;
    name?: string;
}

const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'not', 'no', 'nor', 'this',
    'that', 'these', 'those', 'it', 'its', 'all', 'each', 'every', 'both',
    'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 'just', 'because', 'as', 'until', 'while',
    'about', 'between', 'through', 'during', 'before', 'after', 'above',
    'below', 'from', 'up', 'down', 'out', 'off', 'over', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'what', 'which', 'who', 'whom', 'whose',
]);

export function tokenize(text: string, nGramSize: number = 1): string[] {
    const lower = text.toLowerCase();
    const raw = lower.split(/[^a-z0-9]+/);
    const tokens = raw.filter(t => t.length >= 2 && !STOPWORDS.has(t));

    // R9: Add bigrams (nGramSize >= 2) — "term1 term2" → "term1_term2"
    if (nGramSize >= 2 && tokens.length >= 2) {
        const bigrams = new Set<string>();
        for (let i = 0; i < tokens.length - 1; i++) {
            bigrams.add(`${tokens[i]}_${tokens[i + 1]}`);
        }
        // Append bigrams after unigrams, preserving order
        tokens.push(...bigrams);
    }

    return tokens;
}

/**
 * Extract meaningful tokens from a kebab/camelCase name (R5).
 * "terraform-implementer" → ["terraform", "implementer"]
 * "typescriptImplementer" → ["typescript", "implementer"]
 * Returns deduplicated tokens ≥ 2 chars.
 */
export function extractNameTokens(name: string): string[] {
    // Split on hyphens, underscores, and camelCase boundaries
    const parts = name
        .replace(/([a-z])([A-Z])/g, '$1\0$2')  // camelCase split
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1\0$2')  // consecutive caps split
        .split(/[\0_-]+/);
    return [...new Set(
        parts
            .map(p => p.toLowerCase())
            .filter(p => p.length >= 2)
    )];
}

interface TfVector {
    terms: string[];
    vector: Map<string, number>;
}

function computeTf(terms: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const t of terms) {
        counts.set(t, (counts.get(t) || 0) + 1);
    }
    const total = terms.length || 1;
    for (const [k, v] of counts) {
        counts.set(k, v / total);
    }
    return counts;
}

export function computeIdf(corpus: Map<string, string[]>): Map<string, number> {
    const df = new Map<string, number>();
    for (const [, terms] of corpus) {
        const seen = new Set(terms);
        for (const t of seen) {
            df.set(t, (df.get(t) || 0) + 1);
        }
    }
    const N = corpus.size;
    const idf = new Map<string, number>();
    for (const [term, docFreq] of df) {
        // Scikit-learn style smooth-idf: log((N+1)/(df+1)) + 1
        // Ensures no term ever gets 0 weight, even in small corpora.
        idf.set(term, Math.log((N + 1) / (docFreq + 1)) + 1);
    }
    return idf;
}

export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (const [term, weight] of a) {
        dot += weight * (b.get(term) || 0);
        magA += weight * weight;
    }
    for (const [, weight] of b) {
        magB += weight * weight;
    }

    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}

export function buildTfidfVectors(
    documents: Map<string, string[]>,
    idf: Map<string, number>
): Map<string, Map<string, number>> {
    const result = new Map<string, Map<string, number>>();
    for (const [id, terms] of documents) {
        const tf = computeTf(terms);
        const vec = new Map<string, number>();
        for (const [term, tfVal] of tf) {
            vec.set(term, tfVal * (idf.get(term) || 0));
        }
        result.set(id, vec);
    }
    return result;
}

/**
 * Rank (subagent, skill) pairs by TF-IDF cosine similarity of their descriptions
 * and full body content (FEAT-012 R1).
 * Pairs with score >= threshold and no existing explicit edge are returned.
 * Supports name-boost (R4-R5) and n-gram tokenization (R9).
 */
export function computeSemanticSuggestions(
    subagents: EntityContent[],
    skills: EntityContent[],
    existingEdges: { source: string; target: string }[],
    options?: SemanticMatcherOptions
): SemanticMatch[] {
    const threshold = options?.threshold ?? 0.25;
    const nGramSize = options?.nGramSize ?? 1;
    if (subagents.length === 0 || skills.length === 0) return [];

    // Build corpus: use fullBody || description for each entity (R1)
    const corpus = new Map<string, string[]>();
    for (const sa of subagents) {
        const text = sa.fullBody || sa.description || '';
        if (text) {
            corpus.set(sa.id, tokenize(text, nGramSize));
        }
    }
    for (const sk of skills) {
        const text = sk.fullBody || sk.description || '';
        if (text) {
            const tokens = tokenize(text, nGramSize);
            corpus.set(sk.id, tokens);
        }
    }

    const idf = computeIdf(corpus);
    const vectors = buildTfidfVectors(corpus, idf);

    // Build set of existing edges for O(1) lookup
    const existingSet = new Set<string>();
    for (const e of existingEdges) {
        existingSet.add(`${e.source}::${e.target}`);
    }

    const matches: SemanticMatch[] = [];

    // Build name-boost lookup: for each skill extract name tokens (R4)
    const skillNameTokens = new Map<string, string[]>();
    for (const sk of skills) {
        if (sk.name) skillNameTokens.set(sk.id, extractNameTokens(sk.name));
    }

    for (const sa of subagents) {
        const saVec = vectors.get(sa.id);
        if (!saVec) continue;

        for (const sk of skills) {
            const key = `${sa.id}::${sk.id}`;
            if (existingSet.has(key)) continue;

            const skVec = vectors.get(sk.id);
            if (!skVec) continue;

            let score = cosineSimilarity(saVec, skVec);

            // R4: Name-boost — if skill name tokens appear in subagent's vector, apply 1.2x
            const nameTokens = skillNameTokens.get(sk.id);
            if (nameTokens && nameTokens.length > 0) {
                const hasMatch = nameTokens.some(nt => saVec.has(nt));
                if (hasMatch) {
                    score *= 1.2;
                }
            }

            // R5: Subagent name-token boost — count how many subagent name tokens
            // appear in the skill's vector and add a small per-match bonus
            if (sa.name) {
                const saNameTokens = extractNameTokens(sa.name);
                if (saNameTokens.length > 0) {
                    const matchCount = saNameTokens.filter(nt => skVec.has(nt)).length;
                    if (matchCount > 0) {
                        // +0.05 per matching name token, cap at +0.2 total
                        score += Math.min(matchCount * 0.05, 0.2);
                    }
                }
            }

            if (score >= threshold) {
                matches.push({
                    subagentId: sa.id,
                    skillId: sk.id,
                    score: Math.round(score * 100) / 100,
                    method: 'tfidf',
                });
            }
        }
    }

    // Optional LLM re-ranking: if llmScorer is provided, re-rank top K per subagent
    if (options?.llmScorer) {
        return llmReRank(matches, subagents, skills, options.llmScorer, options.llmTopK ?? 5);
    }

    return matches.sort((a, b) => b.score - a.score);
}

/**
 * Re-rank top-K TF-IDF candidates per subagent using an LLM scorer.
 * Averages the LLM score with the TF-IDF score for a hybrid result.
 */
async function llmReRank(
    matches: SemanticMatch[],
    subagents: EntityContent[],
    skills: EntityContent[],
    llmScorer: (subagentDesc: string, skillDesc: string) => Promise<number>,
    topK: number
): Promise<SemanticMatch[]> {
    // Use fullBody || description for LLM input (R1)
    const subagentDescs = new Map(subagents.map(sa => [sa.id, sa.fullBody || sa.description]));
    const skillDescs = new Map(skills.map(sk => [sk.id, sk.fullBody || sk.description]));

    // Group matches by subagent, take top K per subagent
    const bySubagent = new Map<string, SemanticMatch[]>();
    for (const m of matches) {
        const list = bySubagent.get(m.subagentId) || [];
        list.push(m);
        bySubagent.set(m.subagentId, list);
    }

    const reranked: SemanticMatch[] = [];

    for (const [saId, candidates] of bySubagent) {
        const top = candidates.sort((a, b) => b.score - a.score).slice(0, topK);
        const saDesc = subagentDescs.get(saId) || '';

        for (const candidate of top) {
            const skDesc = skillDescs.get(candidate.skillId) || '';
            try {
                const llmScore = await llmScorer(saDesc, skDesc);
                candidate.score = Math.round(((candidate.score + llmScore) / 2) * 100) / 100;
                candidate.method = 'hybrid';
            } catch {
                // LLM failed — keep TF-IDF score, fall back silently (R8)
            }
            reranked.push(candidate);
        }

        // Add remaining candidates (not in top K) unchanged
        const remaining = candidates.filter(c => !top.includes(c));
        reranked.push(...remaining);
    }

    return reranked.sort((a, b) => b.score - a.score);
}

/**
 * Compute bidirectional TF-IDF scores between two descriptions (R1).
 * Returns forward (descA→descB), reverse (descB→descA), and composite (mean).
 * Reuses the pre-computed IDF and vectors for efficiency.
 */
export function computeBidirectionalScore(
    descA: string,
    descB: string,
    idf: Map<string, number>,
    vectors: Map<string, Map<string, number>>,
    keyA: string,
    keyB: string
): { forward: number; reverse: number; composite: number } {
    // Use existing vectors if available, otherwise build on the fly
    let vecA = vectors.get(keyA);
    let vecB = vectors.get(keyB);

    if (!vecA) {
        const tfA = computeTf(tokenize(descA));
        vecA = new Map<string, number>();
        for (const [term, tfVal] of tfA) {
            vecA.set(term, tfVal * (idf.get(term) || 0));
        }
    }
    if (!vecB) {
        const tfB = computeTf(tokenize(descB));
        vecB = new Map<string, number>();
        for (const [term, tfVal] of tfB) {
            vecB.set(term, tfVal * (idf.get(term) || 0));
        }
    }

    const forward = cosineSimilarity(vecA, vecB);
    const reverse = cosineSimilarity(vecB, vecA);
    const composite = (forward + reverse) / 2;

    return {
        forward: Math.round(forward * 100) / 100,
        reverse: Math.round(reverse * 100) / 100,
        composite: Math.round(composite * 100) / 100,
    };
}
