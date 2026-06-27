import matter from './frontmatter.js';
import { ParserResult, Milestone, DiscoveryMethod, CrossRefInfo } from './types.js';
import { computeSemanticSuggestions, SemanticMatcherOptions } from './semanticMatcher.js';
import { computeIdoneityMatrix, detectMismatches, IdoneityMatrix, MismatchInfo } from './idoneity.js';

/**
 * Check if an edge already exists in the result (same source, target, label)
 * to prevent duplicates (R9).
 */
function edgeExists(result: ParserResult, source: string, target: string, label: string): boolean {
    return result.graph.edges.some(e => e.source === source && e.target === target && e.label === label);
}

/**
 * Check if a node exists in the result graph by ID.
 */
function nodeExists(result: ParserResult, id: string): boolean {
    return result.graph.nodes.some(n => n.id === id);
}

/**
 * Mark a skill node as 'linked' (Progressive Disclosure — Stage 2: activated / explicitly linked).
 * Updates from 'scanned' → 'linked' when a subagent references this skill.
 */
function markSkillLinked(result: ParserResult, skillId: string): void {
    const skillNode = result.graph.nodes.find(n => n.id === skillId && n.type === 'skill');
    if (skillNode && skillNode.metadata._discovery === 'scanned') {
        skillNode.metadata._discovery = 'linked';
    }
}

/**
 * Reconcile skill discovery after all parsing is complete.
 * - Skills with `_discovery: 'scanned'` that were never linked → become `'orphan'`
 * - Creates `discovered` edges from the primary agent to orphan skills
 *   (representing Progressive Disclosure Stage 1: available for activation)
 */
export function reconcileSkillDiscovery(result: ParserResult, primaryAgentId: string): void {
    const orphanSkills = result.graph.nodes.filter(
        n => n.type === 'skill' && n.metadata._discovery === 'scanned'
    );

    for (const skill of orphanSkills) {
        // Mark as orphan — scanned but never linked to any subagent
        skill.metadata._discovery = 'orphan';

        // Create a 'discovered' edge from primary agent to this orphan skill
        // This represents: "this skill exists and is available for activation"
        const edgeId = `edge-${primaryAgentId}-${skill.id}-discovered`;
        if (!edgeExists(result, primaryAgentId, skill.id, 'discovered')) {
            result.graph.edges.push({
                id: edgeId,
                source: primaryAgentId,
                target: skill.id,
                label: 'discovered'
            });
        }
    }
}

/**
 * Compute bidirectional idoneity matrix (FEAT-011) and enrich graph nodes
 * and edges with semantic ownership metadata.
 *
 * After this function:
 * - Each skill node has `_bestOwner` / `_bestOwnerScore` (R2)
 * - Each `uses` edge has `metadata.idoneity` (R3)
 * - Misassigned skills have `_mismatch: true` and `_mismatchBestOwner` (R6)
 * - Misassigned uses edges have `metadata._mismatch: true` (R6)
 *
 * Must be called AFTER reconcileSkillDiscovery but BEFORE addSemanticSuggestions.
 */
export function enrichWithIdoneity(result: ParserResult): IdoneityMatrix {
    const subagents = result.graph.nodes
        .filter(n => n.type === 'subagent')
        .map(n => ({
            id: n.id,
            description: (n.metadata.description as string) || '',
            fullBody: (n.metadata._fullBody as string) || undefined,
            name: n.id,
        }));

    const skills = result.graph.nodes
        .filter(n => n.type === 'skill')
        .map(n => ({
            id: n.id,
            description: (n.metadata.description as string) || '',
            fullBody: (n.metadata._fullBody as string) || undefined,
            name: n.id,
        }));

    const matrix = computeIdoneityMatrix(subagents, skills);
    const nodeTypeById = new Map(result.graph.nodes.map(node => [node.id, node.type]));

    // R2: Enrich skill nodes with best owner metadata
    for (const node of result.graph.nodes) {
        if (node.type !== 'skill') continue;
        const best = matrix.bestOwnerBySkill.get(node.id);
        if (best) {
            node.metadata._bestOwner = best.subagentId;
            node.metadata._bestOwnerScore = best.score;
        } else {
            node.metadata._bestOwner = null;
            node.metadata._bestOwnerScore = 0;
        }
    }

    // R3: Enrich ALL edges with idoneity score (uses, suggested, etc.)
    // This makes idoneity visible on suggested edges in the suggestion dialog
    const idoneityMap = new Map<string, number>();
    for (const rec of matrix.records) {
        idoneityMap.set(`${rec.subagentId}::${rec.skillId}`, rec.compositeScore);
    }

    for (const edge of result.graph.edges) {
        if (edge.label === 'uses') {
            const sourceType = nodeTypeById.get(edge.source);
            const targetType = nodeTypeById.get(edge.target);
            if (sourceType !== 'subagent' || targetType !== 'skill') {
                continue;
            }
            // For uses edges: always set idoneity (even 0) for mismatch/styling logic
            const key = `${edge.source}::${edge.target}`;
            const score = idoneityMap.get(key) ?? 0;
            edge.metadata = { ...edge.metadata, idoneity: score };
        } else if (edge.label === 'suggested') {
            // For suggested edges: only set if score > 0 to enrich the suggestion dialog
            const key = `${edge.source}::${edge.target}`;
            const score = idoneityMap.get(key) ?? 0;
            if (score > 0) {
                edge.metadata = { ...edge.metadata, idoneity: score };
            }
        }
    }

    // R6: Detect mismatches and flag nodes + edges
    const existingEdges = result.graph.edges
        .filter(e => {
            if (e.label !== 'uses') return true;
            const sourceType = nodeTypeById.get(e.source);
            const targetType = nodeTypeById.get(e.target);
            return sourceType === 'subagent' && targetType === 'skill';
        })
        .map(e => ({
            source: e.source,
            target: e.target,
            label: e.label || '',
        }));
    const mismatches = detectMismatches(matrix, existingEdges);
    const mismatchSkills = new Set(mismatches.map(m => m.skillId));
    const mismatchEdgeKeys = new Set(mismatches.map(m => `${m.currentOwner}::${m.skillId}`));

    for (const node of result.graph.nodes) {
        if (node.type === 'skill' && mismatchSkills.has(node.id)) {
            const mm = mismatches.find(m => m.skillId === node.id);
            node.metadata._mismatch = true;
            node.metadata._mismatchBestOwner = mm?.bestOwner || null;
            node.metadata._mismatchGap = mm?.gap || 0;
        }
    }

    for (const edge of result.graph.edges) {
        if (edge.label !== 'uses') continue;
        const key = `${edge.source}::${edge.target}`;
        if (mismatchEdgeKeys.has(key)) {
            edge.metadata = { ...edge.metadata, _mismatch: true };
        }
    }

    return matrix; // R10: return matrix so callers avoid re-computation
}

/**
 * Enrich ALL suggested edges (cross-ref + TF-IDF) with idoneity scores.
 * Accepts the pre-computed IdoneityMatrix from enrichWithIdoneity (R10).
 * Called AFTER addCrossRefEdges and addSemanticSuggestions have added their edges.
 */
export function enrichSuggestedEdgesWithIdoneity(result: ParserResult, matrix: IdoneityMatrix): void {
    const idoneityMap = new Map<string, number>();
    for (const rec of matrix.records) {
        idoneityMap.set(`${rec.subagentId}::${rec.skillId}`, rec.compositeScore);
    }

    for (const edge of result.graph.edges) {
        if (edge.label !== 'suggested') continue;
        if (edge.metadata?.idoneity !== undefined) continue; // already set
        const key = `${edge.source}::${edge.target}`;
        const score = idoneityMap.get(key) ?? 0;
        if (score > 0) {
            edge.metadata = { ...edge.metadata, idoneity: score };
        }
    }
}

/**
 * Create `suggested` edges from cross-references detected in markdown bodies (R3).
 * Called after all parsing and enrichment is complete.
 * For each node with _crossRefs metadata:
 *   If target node exists and no uses/suggested/discovered edge already exists:
 *     Add a suggested edge with metadata.source = 'cross-ref'
 */
export function addCrossRefEdges(result: ParserResult, dismissedSuggestions?: Set<string>): void {
    for (const node of result.graph.nodes) {
        const crossRefs = node.metadata._crossRefs as CrossRefInfo[] | undefined;
        if (!crossRefs || crossRefs.length === 0) continue;

        for (const ref of crossRefs) {
            // Verify target node exists
            if (!nodeExists(result, ref.targetId)) continue;

            // R1: Skip dismissed suggestions
            if (dismissedSuggestions?.has(`${node.id}::${ref.targetId}`)) continue;

            // Check no existing edge of these types
            const hasEdge = result.graph.edges.some(
                e => e.source === node.id && e.target === ref.targetId &&
                    (e.label === 'uses' || e.label === 'suggested' || e.label === 'discovered')
            );
            if (hasEdge) continue;

            // Add suggested edge with cross-ref metadata
            const edgeId = `edge-${node.id}-${ref.targetId}-crossref`;
            if (!edgeExists(result, node.id, ref.targetId, 'suggested')) {
                result.graph.edges.push({
                    id: edgeId,
                    source: node.id,
                    target: ref.targetId,
                    label: 'suggested',
                    metadata: {
                        score: 0.9, // high confidence for explicit links
                        method: 'cross-ref',
                        source: 'cross-ref',
                        confidence: ref.confidence,
                        context: ref.context,
                    },
                });
            }
        }
    }
}

/**
 * Compute semantic suggestions (TF-IDF) for subagent↔skill pairs and add
 * `suggested` edges to the graph. Called after all parsing is complete.
 * Skips pairs that already have a `uses` or `discovered` edge.
 */
export function addSemanticSuggestions(result: ParserResult, options?: SemanticMatcherOptions, dismissedSuggestions?: Set<string>): void {
    const subagents = result.graph.nodes
        .filter(n => n.type === 'subagent')
        .map(n => ({
            id: n.id,
            description: (n.metadata.description as string) || '',
            fullBody: (n.metadata._fullBody as string) || undefined,
            name: n.id,
        }));

    const skills = result.graph.nodes
        .filter(n => n.type === 'skill')
        .map(n => ({
            id: n.id,
            description: (n.metadata.description as string) || '',
            fullBody: (n.metadata._fullBody as string) || undefined,
            name: n.id,
        }));

    const existingEdges = result.graph.edges
        .filter(e => e.label === 'uses' || e.label === 'discovered')
        .map(e => ({ source: e.source, target: e.target }));
    const semanticSuggestions = computeSemanticSuggestions(subagents, skills, existingEdges, options);
    if (!Array.isArray(semanticSuggestions)) return;

    const suggestions = semanticSuggestions.sort((a, b) => b.score - a.score);
    const nodeById = new Map(result.graph.nodes.map(node => [node.id, node]));
    const maxSuggestionsPerSubagent = Math.max(1, options?.maxSuggestionsPerSubagent ?? 2);
    const acceptedPerSubagent = new Map<string, number>();

    for (const s of suggestions) {
        // R1: Skip dismissed suggestions
        if (dismissedSuggestions?.has(`${s.subagentId}::${s.skillId}`)) continue;

        const sourceNode = nodeById.get(s.subagentId);
        const targetNode = nodeById.get(s.skillId);
        const sourceFramework = sourceNode?.metadata?._framework;
        const targetFramework = targetNode?.metadata?._framework;
        if (
            typeof sourceFramework === 'string' &&
            typeof targetFramework === 'string' &&
            sourceFramework !== targetFramework
        ) {
            continue;
        }

        const currentCount = acceptedPerSubagent.get(s.subagentId) || 0;
        if (currentCount >= maxSuggestionsPerSubagent) continue;
        const edgeId = `edge-${s.subagentId}-${s.skillId}-suggested`;
        if (!edgeExists(result, s.subagentId, s.skillId, 'suggested')) {
            result.graph.edges.push({
                id: edgeId,
                source: s.subagentId,
                target: s.skillId,
                label: 'suggested',
                metadata: { score: s.score, method: s.method },
            });
            acceptedPerSubagent.set(s.subagentId, currentCount + 1);
        }
    }
}

export function parseAgenticJson(content: string, result: ParserResult) {
    try {
        const data = JSON.parse(content);
        const primaryId = data.default_agent || 'harness';

        // 1. Primary Agent Node
        result.graph.nodes.push({
            id: primaryId,
            type: 'agent',
            label: primaryId,
            metadata: { description: data.description, isPrimary: true }
        });

        // 2. Sub-agents
        if (data.subagents) {
            for (const sa of data.subagents) {
                // Ensure unique ID by preferring 'name'
                const saId = sa.name;
                
                // Skip if same as primary (already added)
                if (saId === primaryId) {
                    const primaryNode = result.graph.nodes.find(n => n.id === primaryId);
                    if (primaryNode) primaryNode.metadata = { ...primaryNode.metadata, ...sa };

                    // Primary agent can also own skills[]; persist as uses edges from agent → skill.
                    if (sa.skills) {
                        for (const skillId of sa.skills) {
                            if (!nodeExists(result, skillId)) {
                                result.errors.push({ file: '.agents/agentic.json', message: `Skill '${skillId}' referenced by agent '${primaryId}' does not exist as a node` });
                                continue;
                            }
                            if (!edgeExists(result, primaryId, skillId, 'uses')) {
                                result.graph.edges.push({
                                    id: `edge-${primaryId}-${skillId}`,
                                    source: primaryId,
                                    target: skillId,
                                    label: 'uses'
                                });
                            }
                            markSkillLinked(result, skillId);
                        }
                    }
                    continue;
                }

                // Add subagent node even if Markdown doesn't exist yet
                result.graph.nodes.push({
                    id: saId,
                    type: 'subagent',
                    label: saId,
                    metadata: { ...sa }
                });

                // Edge from Primary to Sub-agent
                result.graph.edges.push({
                    id: `edge-${primaryId}-${saId}`,
                    source: primaryId,
                    target: saId,
                    label: 'manages'
                });

                // 3. Skills (from agentic.json if defined)
                if (sa.skills) {
                    for (const skillId of sa.skills) {
                        // R8: Skip if skill node doesn't exist
                        if (!nodeExists(result, skillId)) {
                            result.errors.push({ file: '.agents/agentic.json', message: `Skill '${skillId}' referenced by subagent '${saId}' does not exist as a node` });
                            continue;
                        }
                        // R9: Skip if edge already exists
                        if (!edgeExists(result, saId, skillId, 'uses')) {
                            result.graph.edges.push({
                                id: `edge-${saId}-${skillId}`,
                                source: saId,
                                target: skillId,
                                label: 'uses'
                            });
                        }
                        // Progressive Disclosure Stage 2: linked (explicitly referenced)
                        markSkillLinked(result, skillId);
                    }
                }
            }
        }
        // 4. Steering entries (R1, R6, R11)
        if (data.steering) {
            for (const entry of data.steering) {
                const steeringId = `steering-${entry.name}`;
                result.graph.nodes.push({
                    id: steeringId,
                    type: 'steering',
                    label: entry.name,
                    metadata: {
                        name: entry.name,
                        file: entry.file,
                        description: entry.description,
                        applies_to: entry.applies_to,
                        _filePath: entry.file,
                    }
                });

                // Create 'governs' edges to matching subagents (R6)
                const subagentNodes = result.graph.nodes.filter(n => n.type === 'subagent');
                const appliesToAll = Array.isArray(entry.applies_to) && entry.applies_to.includes('*');

                if (appliesToAll) {
                    for (const sa of subagentNodes) {
                        if (!edgeExists(result, steeringId, sa.id, 'governs')) {
                            result.graph.edges.push({
                                id: `edge-${steeringId}-${sa.id}-governs`,
                                source: steeringId,
                                target: sa.id,
                                label: 'governs'
                            });
                        }
                    }
                } else if (Array.isArray(entry.applies_to)) {
                    for (const targetId of entry.applies_to) {
                        const targetNode = result.graph.nodes.find(n => n.id === targetId && n.type === 'subagent');
                        if (targetNode) {
                            if (!edgeExists(result, steeringId, targetId, 'governs')) {
                                result.graph.edges.push({
                                    id: `edge-${steeringId}-${targetId}-governs`,
                                    source: steeringId,
                                    target: targetId,
                                    label: 'governs'
                                });
                            }
                        } else {
                            // R11: Warning if applies_to subagent does not exist
                            result.errors.push({
                                file: '.agents/agentic.json',
                                message: `Steering '${entry.name}' applies_to subagent '${targetId}' which does not exist`
                            });
                        }
                    }
                }

                // R11: Warning if no edges were created
                if (!appliesToAll && (!Array.isArray(entry.applies_to) || entry.applies_to.length === 0)) {
                    result.errors.push({
                        file: '.agents/agentic.json',
                        message: `Steering '${entry.name}' has no applicable subagents (applies_to is empty)`
                    });
                }
            }
        }

        // 5. Hook entries (R2, R7, R11)
        if (data.hooks) {
            for (const entry of data.hooks) {
                const hookId = `hook-${entry.event}`;
                result.graph.nodes.push({
                    id: hookId,
                    type: 'hook',
                    label: entry.event,
                    metadata: {
                        event: entry.event,
                        script: entry.script,
                        description: entry.description,
                        on_failure: entry.on_failure,
                        _filePath: entry.script,
                    }
                });

                // Create 'triggers' edge to primary agent (R7)
                const primaryAgent = result.graph.nodes.find(n => n.type === 'agent');
                if (primaryAgent) {
                    if (!edgeExists(result, hookId, primaryAgent.id, 'triggers')) {
                        result.graph.edges.push({
                            id: `edge-${hookId}-${primaryAgent.id}-triggers`,
                            source: hookId,
                            target: primaryAgent.id,
                            label: 'triggers'
                        });
                    }
                } else {
                    // R11: Warning if no primary agent exists
                    result.errors.push({
                        file: '.agents/agentic.json',
                        message: `Hook '${entry.event}' has no primary agent to trigger`
                    });
                }
            }
        }
    } catch (e: any) {
        result.errors.push({ file: '.agents/agentic.json', message: e.message });
    }
}

export function parseFeatureList(content: string, result: ParserResult) {
    try {
        const data = JSON.parse(content);
        if (data.features) {
            for (const f of data.features) {
                result.graph.nodes.push({
                    id: f.id,
                    type: 'feature',
                    label: f.title,
                    metadata: { ...f }
                });

                // Link feature to its assigned agent
                if (f.agent) {
                    result.graph.edges.push({
                        id: `edge-${f.agent}-${f.id}`,
                        source: f.agent,
                        target: f.id,
                        label: 'executing'
                    });
                }

                // Add feature as a milestone for the timeline
                result.milestones.push({
                    date: f.sprint || '—',
                    featureId: f.id,
                    title: f.title,
                    status: f.status === 'done' ? 'COMPLETED' : f.status === 'in_progress' ? 'IN PROGRESS' : f.status === 'spec_ready' ? 'SPEC READY' : 'PENDING',
                    outcome: f.description || ''
                });
            }
        }
    } catch (e: any) {
        result.errors.push({ file: 'feature_list.json', message: e.message });
    }
}

export function parseMarkdown(content: string, filePath: string, result: ParserResult) {
    try {
        const normalizedPath = filePath.replace(/\\/g, '/');
        const { data, content: body } = matter(content);
        const fileName = normalizedPath.split('/').pop();
        const folderName = normalizedPath.split('/').slice(-2, -1)[0];
        
        // 1. Identify if this is a subagent/agent file
        if (fileName === 'SUBAGENT.md') {
            const agentId = data.name || folderName;
            const existingNode = result.graph.nodes.find(n => 
                n.id === agentId || 
                (n.metadata.role_file && normalizedPath.endsWith(n.metadata.role_file))
            );

            // Extract Skills from body (## Skills section)
            const skillsMatch = body.match(/##\s+Skills\s*\n([\s\S]*?)(?:\n##|$)/i);
            const skillsList = skillsMatch 
                ? skillsMatch[1].split('\n')
                    .map(s => s.replace(/^[-*]\s*/, '').trim())
                    .filter(s => s.length > 0)
                : [];

            if (existingNode) {
                existingNode.metadata = { ...existingNode.metadata, ...data, body: body.substring(0, 500), _fullBody: body, markdownSkills: skillsList, _filePath: normalizedPath };
                if (data.name) existingNode.label = data.name;
            } else {
                result.graph.nodes.push({
                    id: agentId,
                    type: 'subagent',
                    label: agentId,
                    metadata: { ...data, body: body.substring(0, 500), _fullBody: body, markdownSkills: skillsList, _filePath: normalizedPath }
                });
            }

            // R2: Scan body for cross-references to other entities
            const allIds = new Set(result.graph.nodes.map(n => n.id));
            const crossRefs = scanCrossReferences(body, agentId, allIds);
            if (crossRefs.length > 0) {
                const node = existingNode || result.graph.nodes.find(n => n.id === agentId);
                if (node) node.metadata._crossRefs = crossRefs;
            }

            // Create links to detected skills (R9: deduplicate)
            for (const skillName of skillsList) {
                // R8: Skip if skill node doesn't exist
                if (!nodeExists(result, skillName)) {
                    result.errors.push({ file: normalizedPath, message: `Skill '${skillName}' referenced by subagent '${agentId}' does not exist as a node` });
                    continue;
                }
                if (!edgeExists(result, agentId, skillName, 'uses')) {
                    result.graph.edges.push({
                        id: `edge-${agentId}-${skillName}`,
                        source: agentId,
                        target: skillName,
                        label: 'uses'
                    });
                }
                // Progressive Disclosure Stage 2: linked (explicitly referenced in ## Skills)
                markSkillLinked(result, skillName);
            }
        } 
        // 2. Identify if this is a skill file
        else if (fileName === 'SKILL.md' || normalizedPath.includes('/skills/')) {
            const skillId = data.name || folderName;
            const existingSkillNode = result.graph.nodes.find(n => n.id === skillId);
            
            // Avoid duplicates
            if (!existingSkillNode) {
                result.graph.nodes.push({
                    id: skillId,
                    type: 'skill',
                    label: skillId,
                    metadata: { 
                        ...data, 
                        body: body.substring(0, 500), _fullBody: body,
                        _filePath: normalizedPath,
                        // Progressive Disclosure — Stage 1: scanned via directory discovery
                        _discovery: 'scanned' as DiscoveryMethod
                    }
                });
            } else {
                existingSkillNode.metadata = { 
                        ...existingSkillNode.metadata, 
                        ...data, 
                        body: body.substring(0, 500), _fullBody: body,
                        _filePath: normalizedPath,
                        // Preserve existing discovery status if already set
                        _discovery: existingSkillNode.metadata._discovery || 'scanned'
                    };
            }

            // R2: Scan body for cross-references to other entities
            const allIds = new Set(result.graph.nodes.map(n => n.id));
            const crossRefs = scanCrossReferences(body, skillId, allIds);
            if (crossRefs.length > 0) {
                const node = result.graph.nodes.find(n => n.id === skillId) || existingSkillNode;
                if (node) node.metadata._crossRefs = crossRefs;
            }

            // Auto-link: If a skill is inside a subagent's folder, link them
            // Path example: .agents/subagents/harness-vscode/skills/some-skill/SKILL.md
            if (normalizedPath.includes('/subagents/')) {
                const parts = normalizedPath.split('/');
                const subagentIdx = parts.indexOf('subagents') + 1;
                if (subagentIdx > 0 && subagentIdx < parts.length) {
                    const subagentId = parts[subagentIdx];
                    // R9: deduplicate edges
                    if (!edgeExists(result, subagentId, skillId, 'uses')) {
                        result.graph.edges.push({
                            id: `edge-${subagentId}-${skillId}`,
                            source: subagentId,
                            target: skillId,
                            label: 'uses'
                        });
                    }
                    // Progressive Disclosure Stage 2: linked (auto-linked via file path)
                    markSkillLinked(result, skillId);
                }
            }
        }
    } catch (e: any) {
        result.errors.push({ file: filePath.replace(/\\/g, '/'), message: e.message });
    }
}

/**
 * Enrich a steering node with content from its markdown file.
 * Called by the adapter after file reading.
 *
 * @param filePath  - relative path to the steering file
 * @param content   - file content, or null if the file doesn't exist
 * @param node      - the steering node to enrich
 * @param result    - the ParserResult to push errors into
 */
export function parseSteeringFile(filePath: string, content: string | null, node: { metadata: Record<string, any> }, result: ParserResult): void {
    node.metadata._filePath = filePath;
    if (content !== null) {
        node.metadata._body = content;
        node.metadata._fileMissing = false;
    } else {
        // R4: handle missing steering file gracefully
        node.metadata._fileMissing = true;
        result.errors.push({
            file: filePath,
            message: `Steering file '${filePath}' referenced in agentic.json does not exist`
        });
    }
}

/**
 * Enrich a hook node with a preview of its script content.
 * Called by the adapter after file reading.
 *
 * @param filePath  - relative path to the hook script
 * @param content   - file content, or null if the file doesn't exist
 * @param node      - the hook node to enrich
 */
export function parseHookFile(filePath: string, content: string | null, node: { metadata: Record<string, any> }): void {
    node.metadata._filePath = filePath;
    if (content !== null) {
        // R5: store first 500 characters as preview
        node.metadata._preview = content.substring(0, 500);
    }
}

/**
 * Build a set of all existing node IDs from the result graph.
 */
function buildNodeIdSet(result: ParserResult): Set<string> {
    return new Set(result.graph.nodes.map(n => n.id));
}

/**
 * Scan markdown body for cross-references to other entities (R2).
 * Detects:
 * - Markdown links [text](../skills/foo/SKILL.md) → target = "foo"
 * - Wiki links [[foo]] or [[foo|label]] → target = "foo"
 *
 * External URLs (http://, https://, file://) are ignored.
 * Results are deduplicated by targetId + linkType.
 */
export function scanCrossReferences(
    body: string,
    sourceNodeId: string,
    allNodeIds: Set<string>
): CrossRefInfo[] {
    const results: CrossRefInfo[] = [];
    const seen = new Set<string>();

    if (!body) return results;

    // Regex for markdown links: [text](path)
    const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = mdLinkRegex.exec(body)) !== null) {
        const fullMatch = match[0];
        const linkText = match[1];
        const url = match[2].trim();

        // Skip external URLs
        if (/^https?:\/\//i.test(url) || /^file:\/\//i.test(url) || /^vscode:\/\//i.test(url)) continue;
        if (url.startsWith('#')) continue; // anchor link

        // Extract target ID from path: last directory or filename without extension
        const pathParts = url.replace(/\\/g, '/').split('/');
        const lastSegment = pathParts[pathParts.length - 1] || '';
        const secondLast = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : '';

        // Try: filename without extension (SKILL.md → "skill"), or directory name
        const candidates: string[] = [];
        const withoutExt = lastSegment.replace(/\.md$/i, '');
        if (withoutExt && withoutExt !== lastSegment) {
            // It was a .md file — use the stem
            candidates.push(withoutExt);
        }
        if (secondLast && !secondLast.endsWith('.md') && secondLast !== 'skills' && secondLast !== 'subagents') {
            candidates.push(secondLast);
        }

        for (const candidate of candidates) {
            const key = `${candidate}::markdown`;
            if (seen.has(key)) continue;
            if (candidate === sourceNodeId) continue; // skip self-references
            if (allNodeIds.has(candidate)) {
                seen.add(key);
                // Extract surrounding context (up to 80 chars around the match)
                const start = Math.max(0, match.index - 40);
                const end = Math.min(body.length, match.index + fullMatch.length + 40);
                const context = (start > 0 ? '…' : '') +
                    body.substring(start, end).replace(/\n+/g, ' ') +
                    (end < body.length ? '…' : '');
                results.push({
                    targetId: candidate,
                    linkType: 'markdown',
                    confidence: 'high',
                    context: context.trim().substring(0, 120),
                });
            }
        }
    }

    // Regex for wiki links: [[target]] or [[target|label]]
    const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
    while ((match = wikiLinkRegex.exec(body)) !== null) {
        const target = match[1].trim().toLowerCase().replace(/\s+/g, '-');
        const key = `${target}::wiki`;
        if (seen.has(key)) continue;
        if (target === sourceNodeId) continue;
        if (allNodeIds.has(target)) {
            seen.add(key);
            const fullMatch = match[0];
            const start = Math.max(0, match.index - 40);
            const end = Math.min(body.length, match.index + fullMatch.length + 40);
            const context = (start > 0 ? '…' : '') +
                body.substring(start, end).replace(/\n+/g, ' ') +
                (end < body.length ? '…' : '');
            results.push({
                targetId: target,
                linkType: 'wiki',
                confidence: 'high',
                context: context.trim().substring(0, 120),
            });
        }
    }

    return results;
}

export function parseProgressMd(content: string, result: ParserResult) {
    const lines = content.split('\n');
    let currentMilestone: Partial<Milestone> | null = null;

    for (const line of lines) {
        // Match: ## [2026-06-05] FEAT-001: webview-foundation (COMPLETED)
        const headerMatch = line.match(/^##\s+\[(.*?)\]\s+(FEAT-\d+):\s+(.*?)(?:\s+\((.*?)\))?$/);
        if (headerMatch) {
            // Add the previous milestone if it exists
            if (currentMilestone) {
                // Deduplicate: don't add if a milestone with same featureId already exists
                const alreadyExists = result.milestones.some(m => m.featureId === currentMilestone!.featureId);
                if (!alreadyExists) {
                    result.milestones.push(currentMilestone as Milestone);
                } else {
                    // Update existing milestone with actual date/outcome from progress.md
                    const existing = result.milestones.find(m => m.featureId === currentMilestone!.featureId);
                    if (existing) {
                        existing.date = currentMilestone.date;
                        if (currentMilestone.outcome) existing.outcome = currentMilestone.outcome;
                        if (currentMilestone.status) existing.status = currentMilestone.status;
                    }
                }
            }
            currentMilestone = {
                date: headerMatch[1],
                featureId: headerMatch[2],
                title: headerMatch[3],
                status: headerMatch[4] || 'DONE',
                outcome: ''
            };
            continue;
        }

        if (currentMilestone && line.startsWith('- **Outcome:**')) {
            currentMilestone.outcome = line.replace('- **Outcome:**', '').trim();
        }
    }

    if (currentMilestone) {
        const alreadyExists = result.milestones.some(m => m.featureId === currentMilestone!.featureId);
        if (!alreadyExists) {
            result.milestones.push(currentMilestone as Milestone);
        } else {
            const existing = result.milestones.find(m => m.featureId === currentMilestone!.featureId);
            if (existing) {
                existing.date = currentMilestone.date;
                if (currentMilestone.outcome) existing.outcome = currentMilestone.outcome;
                if (currentMilestone.status) existing.status = currentMilestone.status;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// No-overlap guarantee (FEAT-023, R16–R18)
// ---------------------------------------------------------------------------

/**
 * Visual half-width of the smallest node type. Two nodes are
 * considered "overlapping" if their `(x, y)` anchors are within
 * this many pixels of each other. 4 px is the canonical value
 * for the current CustomNode design (FEAT-023 R16).
 */
const OVERLAP_TOLERANCE_PX = 4;

/**
 * When an overlap is detected, the colliding node (or nodes)
 * is offset by `N × STRIDE` pixels on each axis, where `N` is
 * the collision index (1 for the second node, 2 for the
 * third, etc.). The first colliding node stays put so that any
 * manually-set anchor (e.g., the root agent) is preserved.
 */
const OVERLAP_OFFSET_STRIDE_PX = 8;

/**
 * Safety bound for the iterative offset pass. After 5 passes
 * any cascading overlaps are very unlikely (each pass pushes
 * nodes 8 px further apart on both axes). The cap exists to
 * prevent infinite loops in pathological inputs.
 */
const MAX_ITERATIONS = 5;

interface NodePosition { x: number; y: number; }

function readNodePosition(node: { metadata: Record<string, any> }): NodePosition | null {
    const candidate = node.metadata?._position;
    if (
        candidate &&
        typeof candidate === 'object' &&
        Number.isFinite(candidate.x) &&
        Number.isFinite(candidate.y)
    ) {
        return { x: candidate.x, y: candidate.y };
    }
    return null;
}

function binKey(x: number, y: number): string {
    return `${Math.round(x / OVERLAP_TOLERANCE_PX)}:${Math.round(y / OVERLAP_TOLERANCE_PX)}`;
}

function pushOverlapError(
    result: ParserResult,
    nodeA: { id: string; metadata: Record<string, any> },
    nodeB: { id: string; metadata: Record<string, any> },
    x: number,
    y: number
): void {
    const adapterId = String(nodeA.metadata?._framework ?? 'parser');
    result.errors.push({
        file: adapterId,
        message: `Node ${nodeA.id} and ${nodeB.id} overlap at (${Math.round(x)}, ${Math.round(y)})`,
    });
}

/**
 * Detect and fix overlapping node positions in a
 * `ParserResult`.
 *
 * The function looks at `node.metadata._position` on each
 * node (set by the dagre auto-layout in the webview, or by
 * the user via manual position persistence). If two or more
 * nodes share a `(x, y)` to within `OVERLAP_TOLERANCE_PX`
 * pixels, the function:
 *
 *   1. Emits a non-fatal `ParserError` for each colliding pair.
 *   2. Applies a deterministic offset `(x + N × STRIDE,
 *      y + N × STRIDE)` to the colliding node(s), where `N`
 *      is the collision index (1, 2, 3, ...). The first
 *      colliding node stays put so that any manually-set
 *      anchor is preserved.
 *   3. Iterates up to `MAX_ITERATIONS` to handle cascading
 *      overlaps.
 *
 * The function returns the same `ParserResult` (mutated in
 * place for performance and so the caller can keep its
 * reference). The return value is provided for convenience
 * and matches the spec's API.
 *
 * At parse time no positions are set on the nodes, so the
 * function is a no-op. The intended caller is the webview
 * layout code, which calls this function after dagre layout
 * and before the manual-position merge (per R17/R18).
 */
export function detectAndFixOverlaps(result: ParserResult): ParserResult {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
        const buckets = new Map<string, Array<{ id: string; metadata: Record<string, any> }>>();
        let anyCollision = false;

        for (const node of result.graph.nodes) {
            const position = readNodePosition(node);
            if (!position) continue;
            const key = binKey(position.x, position.y);
            const bucket = buckets.get(key) ?? [];
            bucket.push(node);
            buckets.set(key, bucket);
        }

        for (const [, bucket] of buckets) {
            if (bucket.length <= 1) continue;
            anyCollision = true;

            // First node stays put. Subsequent nodes get the
            // deterministic N × STRIDE offset (N = 1, 2, ...).
            for (let i = 1; i < bucket.length; i += 1) {
                const nodeA = bucket[0];
                const nodeB = bucket[i];
                const position = readNodePosition(nodeB);
                if (!position) continue;
                pushOverlapError(result, nodeA, nodeB, position.x, position.y);
                const offset = i * OVERLAP_OFFSET_STRIDE_PX;
                nodeB.metadata._position = {
                    x: position.x + offset,
                    y: position.y + offset,
                };
            }
        }

        // If no collisions were found in this pass, the layout
        // is now overlap-free. Bail out.
        if (!anyCollision) break;
    }

    return result;
}
