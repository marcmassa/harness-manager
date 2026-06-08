import {
    tokenize,
    computeIdf,
    buildTfidfVectors,
    cosineSimilarity,
    extractNameTokens,
} from './semanticMatcher.js';

export interface EntityInput {
    id: string;
    description: string;
    fullBody?: string;
    name?: string;
}

// ===== TYPES =====

export interface IdoneityRecord {
    skillId: string;
    subagentId: string;
    forwardScore: number;    // subagent→skill TF-IDF (R1)
    reverseScore: number;    // skill→subagent TF-IDF (R1)
    compositeScore: number;  // (forwardScore + reverseScore) / 2 (R1)
}

export interface IdoneityMatrix {
    records: IdoneityRecord[];
    /** Per-skill: best semantic owner and its composite score (R2) */
    bestOwnerBySkill: Map<string, { subagentId: string; score: number }>;
    /** Per-subagent: skills ranked by composite score (R7) */
    bestSkillsBySubagent: Map<string, { skillId: string; score: number }[]>;
}

export interface MismatchInfo {
    skillId: string;
    currentOwner: string;   // subagent with the 'uses' edge
    bestOwner: string;       // subagent with highest composite score
    currentScore: number;    // idoneity of current uses edge
    bestScore: number;       // idoneity of best owner pair
    gap: number;             // bestScore - currentScore (≥ 0.2 = mismatch)
}

// ===== CONSTANTS =====

/** Minimum gap for a skill to be flagged as mismatch (R6) */
export const MISMATCH_GAP_THRESHOLD = 0.2;
/** Minimum composite score to appear in bestSkillsBySubagent (R7) */
export const IDONEITY_MIN_SCORE = 0.1;

// ===== CORE =====

/**
 * Compute full bidirectional idoneity matrix for all (subagent, skill) pairs (R1).
 * Returns:
 * - records: all pairs with forward/reverse/composite scores
 * - bestOwnerBySkill: per-skill, the subagent with highest composite score (R2)
 * - bestSkillsBySubagent: per-subagent, skills ranked by composite score (R7)
 *
 * Backward compatibility (R9, R10):
 * - Empty descriptions → score 0, excluded from bestOwner
 * - Fewer than 2 documents → empty matrix
 */
export function computeIdoneityMatrix(
    subagents: EntityInput[],
    skills: EntityInput[],
    options?: { nGramSize?: number },
): IdoneityMatrix {
    const nGramSize = options?.nGramSize ?? 1;
    const records: IdoneityRecord[] = [];
    const bestOwnerBySkill = new Map<string, { subagentId: string; score: number }>();
    const bestSkillsBySubagent = new Map<string, { skillId: string; score: number }[]>();

    // Filter nodes with non-empty content: fullBody || description (R1)
    const validSubagents = subagents.filter(s => (s.fullBody || s.description)?.trim());
    const validSkills = skills.filter(s => (s.fullBody || s.description)?.trim());

    // R10: fewer than 2 documents → empty matrix
    if (validSubagents.length === 0 || validSkills.length === 0) {
        return { records, bestOwnerBySkill, bestSkillsBySubagent };
    }

    if (validSubagents.length + validSkills.length < 2) {
        return { records, bestOwnerBySkill, bestSkillsBySubagent };
    }

    // Build corpus using fullBody || description (R1), with n-gram (R9)
    const corpus = new Map<string, string[]>();
    for (const sa of validSubagents) {
        const text = sa.fullBody || sa.description || '';
        if (text) {
            corpus.set(sa.id, tokenize(text, nGramSize));
        }
    }
    for (const sk of validSkills) {
        const text = sk.fullBody || sk.description || '';
        if (text) {
            corpus.set(sk.id, tokenize(text, nGramSize));
        }
    }

    const idf = computeIdf(corpus);
    const vectors = buildTfidfVectors(corpus, idf);

    // Build skill name token lookup for R4 name-boost
    const skillNameTokens = new Map<string, string[]>();
    for (const sk of validSkills) {
        if (sk.name) skillNameTokens.set(sk.id, extractNameTokens(sk.name));
    }

    // Temporary map to track best score per skill
    const bestPerSkill = new Map<string, { subagentId: string; score: number }>();

    for (const sa of validSubagents) {
        const saVec = vectors.get(sa.id);
        if (!saVec) continue;

        const subagentSkills: { skillId: string; score: number }[] = [];

        for (const sk of validSkills) {
            const skVec = vectors.get(sk.id);
            if (!skVec) continue;

            // Forward: subagent→skill
            let forward = cosineSimilarity(saVec, skVec);
            // Reverse: skill→subagent
            let reverse = cosineSimilarity(skVec, saVec);

            // R4: Name-boost — if skill name tokens appear in subagent's vector, apply 1.2x
            const nameTokens = skillNameTokens.get(sk.id);
            if (nameTokens && nameTokens.length > 0) {
                const hasMatch = nameTokens.some(nt => saVec.has(nt));
                if (hasMatch) {
                    forward *= 1.2;
                    reverse *= 1.2;
                }
            }

            // R5: Subagent name-token boost — per matching name token in skill vector
            if (sa.name) {
                const saNameTokens = extractNameTokens(sa.name);
                if (saNameTokens.length > 0) {
                    const matchCount = saNameTokens.filter(nt => skVec.has(nt)).length;
                    if (matchCount > 0) {
                        const boost = Math.min(matchCount * 0.05, 0.2);
                        forward += boost;
                        reverse += boost;
                    }
                }
            }

            const composite = (forward + reverse) / 2;

            const record: IdoneityRecord = {
                skillId: sk.id,
                subagentId: sa.id,
                forwardScore: Math.round(forward * 100) / 100,
                reverseScore: Math.round(reverse * 100) / 100,
                compositeScore: Math.round(composite * 100) / 100,
            };
            records.push(record);

            // Track best owner for this skill
            const current = bestPerSkill.get(sk.id);
            if (!current || record.compositeScore > current.score) {
                bestPerSkill.set(sk.id, { subagentId: sa.id, score: record.compositeScore });
            }

            // Track for subagent ranking (R7)
            if (record.compositeScore >= IDONEITY_MIN_SCORE) {
                subagentSkills.push({ skillId: sk.id, score: record.compositeScore });
            }
        }

        // Sort subagent's skills by composite score descending
        subagentSkills.sort((a, b) => b.score - a.score);
        bestSkillsBySubagent.set(sa.id, subagentSkills);
    }

    // Populate bestOwnerBySkill
    for (const [skillId, owner] of bestPerSkill) {
        bestOwnerBySkill.set(skillId, owner);
    }

    return { records, bestOwnerBySkill, bestSkillsBySubagent };
}

/**
 * Detect mismatches: skills whose uses edge owner is not the best semantic owner (R6).
 * A skill is a mismatch when:
 * 1. It has a uses edge to some subagent A
 * 2. Its bestOwnerBySkill is subagent B (B !== A)
 * 3. The gap between bestScore and the edge's idoneity score is ≥ MISMATCH_GAP_THRESHOLD
 */
export function detectMismatches(
    matrix: IdoneityMatrix,
    existingEdges: { source: string; target: string; label: string }[],
): MismatchInfo[] {
    if (matrix.bestOwnerBySkill.size === 0) return [];

    // Build a lookup: skillId → { owner, score } from uses edges
    const skillOwnerMap = new Map<string, { owner: string; score: number }>();
    for (const edge of existingEdges) {
        if (edge.label !== 'uses') continue;
        // Find the record for this (source, target) pair
        const record = matrix.records.find(
            r => r.subagentId === edge.source && r.skillId === edge.target
        );
        skillOwnerMap.set(edge.target, {
            owner: edge.source,
            score: record?.compositeScore ?? 0,
        });
    }

    const mismatches: MismatchInfo[] = [];

    for (const [skillId, best] of matrix.bestOwnerBySkill) {
        const current = skillOwnerMap.get(skillId);
        if (!current) continue; // no uses edge for this skill
        if (current.owner === best.subagentId) continue; // already optimal

        const gap = best.score - current.score;
        if (gap >= MISMATCH_GAP_THRESHOLD) {
            mismatches.push({
                skillId,
                currentOwner: current.owner,
                bestOwner: best.subagentId,
                currentScore: current.score,
                bestScore: best.score,
                gap: Math.round(gap * 100) / 100,
            });
        }
    }

    return mismatches;
}
