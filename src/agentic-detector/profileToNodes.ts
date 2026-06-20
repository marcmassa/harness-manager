/**
 * profileToNodes.ts — Transform AgenticProfile into discovered HarnessNode[] + HarnessEdge[]
 *
 * Phase 5 of FEAT-029: Whiteboard Layer Visualization.
 *
 * Converts the three-layer AgenticProfile into a set of discovered nodes
 * and inferred edges that can be merged into the whiteboard graph.
 */
import type {
  AgenticProfile,
  CLIInstall,
  SignalCategoryResult,
  SignalMatch,
} from './types.js';
import type { HarnessNode, HarnessEdge } from '../types.js';

// ── Logical node aggregation ─────────────────────────────────────────────────

/**
 * When multiple signal matches refer to the same logical element, they are
 * merged into a single node. The `_evidence` field concatenates the individual
 * evidence strings.
 */
interface LogicalNodeKey {
  type: HarnessNode['type'];
  label: string;
}

/**
 * Compute a logical key for aggregating multiple matches into one node.
 * For agent methodologies, aggregate under the methodology name.
 * For skills, aggregate under the matched pattern or file stem.
 * For tools, aggregate under the tool name.
 * For everything else, aggregate under the file's category + parent directory.
 */
function logicalKey(match: SignalMatch, profile: AgenticProfile): LogicalNodeKey {
  const { category, filePath, matchedPattern } = match;

  switch (category) {
    case 'agent-methodologies': {
      // Use the matched pattern (e.g., "Harness SDD", "Custom SDD")
      const name = matchedPattern.replace(/^config:/, '').trim();
      return {
        type: 'discovered-agent',
        label: name || `Methodology (${filePath})`,
      };
    }

    case 'skills': {
      // Extract file stem for the skill name.
      // If the stem is a generic name (SKILL, README, index), use the
      // parent directory name instead (Harness convention:
      // <skill-name>/SKILL.md).
      const fileName = filePath.split('/').pop() || '';
      const stem = fileName.replace(/\.(md|yaml|yml|json)$/i, '');
      const GENERIC_NAMES = new Set(['skill', 'skills', 'readme', 'index', 'main']);
      if (GENERIC_NAMES.has(stem.toLowerCase())) {
        const parts = filePath.split('/');
        const parentDir = parts.length > 1 ? parts[parts.length - 2] : '';
        return {
          type: 'discovered-skill',
          label: parentDir || stem,
        };
      }
      return {
        type: 'discovered-skill',
        label: stem,
      };
    }

    case 'tools': {
      // Use the matched pattern as tool name
      const toolName = matchedPattern.replace(/^tool:/, '').trim() || filePath.split('/').pop() || filePath;
      return {
        type: 'discovered-tool',
        label: toolName,
      };
    }

    default: {
      // prompts, rules, mcp, agent-scripts, memory, context-identity → discovered-resource
      // Use the file's parent directory + category as a grouping label
      const parts = filePath.split('/');
      const parentDir = parts.length > 1 ? parts[parts.length - 2] : '';
      const label = parentDir
        ? `${category} (${parentDir})`
        : category;
      return {
        type: 'discovered-resource',
        label,
      };
    }
  }
}

// ── Main transformation ──────────────────────────────────────────────────────

/**
 * Transform an AgenticProfile into discovered nodes and inferred edges.
 *
 * - Layer 1 (CLI installs): one cli-install node per detected CLI
 * - Layer 2 (Signal categories): logical nodes aggregated by type
 * - Layer 3 (Methodology): discovered-agent with SDD badge
 *
 * Inferred edges connect:
 *   - CLI → methodology (when methodology is active)
 *   - CLI → categories (when CLI is installed and categories exist)
 *   - Agent methodology config → skill/tool files (when both exist)
 *   - Skill → tool (when both exist in the same category group)
 *
 * @param profile The AgenticProfile to transform
 * @param acknowledgedNodeIds Set of node IDs that have been acknowledged by the user
 * @returns Discovered nodes and inferred edges
 */
export function profileToDiscoveredNodes(
  profile: AgenticProfile,
  acknowledgedNodeIds: Set<string> = new Set(),
): { nodes: HarnessNode[]; edges: HarnessEdge[] } {
  const nodes: HarnessNode[] = [];
  const edges: HarnessEdge[] = [];

  // ── Track logical keys to avoid duplicates ──
  const seenKeys = new Set<string>();

  // ── Helper to add a unique node ──
  function addNode(key: LogicalNodeType, node: HarnessNode): void {
    const k = `${node.type}::${node.label}`;
    if (seenKeys.has(k)) return;
    seenKeys.add(k);
    nodes.push(node);
  }

  // ── Layer 1: CLI install nodes ──
  for (const cli of profile.layers['1'].cliInstalls) {
    const cliId = `discovered-cli-${cli.cliId}`;
    addNode('cli', {
      id: cliId,
      type: 'cli-install',
      label: cli.cliName,
      metadata: {
        _layer: 1,
        _evidence: `Detected via: ${cli.detectedBy}\nConfig files: ${cli.configFiles.join(', ')}`,
        _acknowledged: acknowledgedNodeIds.has(cliId),
        _isHarness: false,
        _isSDD: false,
        cliId: cli.cliId,
        configFiles: cli.configFiles,
      },
    });
  }

  // ── Layer 2: Signal category nodes ──
  const categoryNodeIds: Map<string, string> = new Map(); // logical key → node id
  const methodologyNodeIds: string[] = [];

  for (const catResult of profile.layers['2'].categories) {
    if (catResult.count === 0) continue;

    for (const match of catResult.matches) {
      const key = logicalKey(match, profile);
      const matchId = `${key.type}::${key.label}`;

      if (!categoryNodeIds.has(matchId)) {
        const nodeId = `discovered-${key.type}-${key.label.replace(/\s+/g, '-').toLowerCase()}-${nodes.length}`;
        categoryNodeIds.set(matchId, nodeId);

        // Determine if this is a Harness or SDD-related node
        const isHarness = match.matchedPattern.toLowerCase().includes('harness')
          || match.filePath.toLowerCase().includes('.agents');
        const isSDD = match.matchedPattern.toLowerCase().includes('sdd')
          || match.filePath.toLowerCase().includes('feature_list');

        addNode(key.type, {
          id: nodeId,
          type: key.type,
          label: key.label,
          metadata: {
            _layer: 2,
            _evidence: match.evidence,
            _acknowledged: acknowledgedNodeIds.has(nodeId),
            _isHarness: isHarness,
            _isSDD: isSDD,
            category: catResult.category,
            filePath: match.filePath,
            matchedPattern: match.matchedPattern,
            confidence: match.confidence,
          },
        });

        if (key.type === 'discovered-agent') {
          methodologyNodeIds.push(nodeId);
        }
      } else {
        // Merge evidence for already-existing logical node
        const existingId = categoryNodeIds.get(matchId)!;
        const existingNode = nodes.find((n) => n.id === existingId);
        if (existingNode) {
          const existingEvidence = existingNode.metadata._evidence as string || '';
          existingNode.metadata._evidence = existingEvidence
            ? `${existingEvidence}\n${match.evidence}`
            : match.evidence;
        }
      }
    }
  }

  // ── Layer 3: Methodology node ──
  const methodology = profile.layers['3'].methodology;
  if (methodology.hasMethodology && methodology.methodologyName) {
    const sddNodeId = `discovered-methodology-${methodology.methodologyName?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`;
    addNode('discovered-agent', {
      id: sddNodeId,
      type: 'discovered-agent',
      label: methodology.methodologyName,
      metadata: {
        _layer: 3,
        _evidence: `Methodology: ${methodology.methodologyName}\nConfig: ${methodology.configFile || 'N/A'}\nActive: ${methodology.isActive}`,
        _acknowledged: acknowledgedNodeIds.has(sddNodeId),
        _isHarness: methodology.methodologyName === 'Harness SDD',
        _isSDD: true,
        methodologyName: methodology.methodologyName,
        configFile: methodology.configFile,
        isActive: methodology.isActive,
      },
    });
    methodologyNodeIds.push(sddNodeId);
  }

  // ── Inferred edges ──

  // Edge counter for unique edge IDs
  let edgeCount = 0;

  // CLI → methodology (when CLI is installed + methodology active)
  const cliIds = nodes.filter((n) => n.type === 'cli-install').map((n) => n.id);
  for (const cliId of cliIds) {
    for (const methId of methodologyNodeIds) {
      edges.push({
        id: `inferred-edge-${edgeCount++}`,
        source: cliId,
        target: methId,
        label: 'inferred',
        metadata: {
          _layer: '1→3',
          _reason: 'CLI install detected alongside active methodology',
        },
      });
    }
  }

  // CLI → categories (inferred support relationship)
  const resourceIds = nodes.filter((n) =>
    n.type === 'discovered-resource' || n.type === 'discovered-skill' || n.type === 'discovered-tool'
  ).map((n) => n.id);

  if (cliIds.length > 0) {
    for (const resourceId of resourceIds) {
      edges.push({
        id: `inferred-edge-${edgeCount++}`,
        source: cliIds[0], // Connect to first CLI (most relevant)
        target: resourceId,
        label: 'inferred',
        metadata: {
          _layer: '1→2',
          _reason: 'CLI runtime supports agentic implementation resources',
        },
      });
    }
  }

  // Agent methodology → skill/tool (when methodology defines the architecture)
  const agentIds = nodes.filter((n) => n.type === 'discovered-agent').map((n) => n.id);
  const skillToolIds = nodes.filter((n) =>
    n.type === 'discovered-skill' || n.type === 'discovered-tool'
  ).map((n) => n.id);

  for (const agentId of agentIds) {
    for (const stId of skillToolIds) {
      edges.push({
        id: `inferred-edge-${edgeCount++}`,
        source: agentId,
        target: stId,
        label: 'inferred',
        metadata: {
          _layer: '2→2',
          _reason: 'Methodology defines the skills/tools in the agentic architecture',
        },
      });
    }
  }

  return { nodes, edges };
}

// Internal type helper for the addNode function
type LogicalNodeType = 'cli' | HarnessNode['type'];
