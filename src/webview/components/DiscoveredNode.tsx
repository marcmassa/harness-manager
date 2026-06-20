import * as React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  SPACE,
  EASE_SMOOTH,
  NODE_STYLES,
  HANDLE_ACCENT,
  HANDLE_PILL_BASE,
  HIDDEN_HANDLE_STYLE,
} from '../styles.js';

// ── Layer badge definitions ──────────────────────────────────────────────────
interface LayerBadgeDef {
  label: string;
  color: string;
  bg: string;
}

const LAYER_BADGES: Record<string, LayerBadgeDef> = {
  cli:    { label: 'CLI',     color: '#fff',      bg: '#3399ff' },
  impl:   { label: 'IMPL',    color: '#fff',      bg: '#88cc33' },
  harness: { label: 'HARNESS', color: '#fff',     bg: '#44aa55' },
  sdd:    { label: 'SDD',     color: '#fff',      bg: '#22bb66' },
};

/** Determines which badge(s) to show based on node type and metadata. */
function getLayerBadges(type: string, metadata: Record<string, any>): LayerBadgeDef[] {
  if (type === 'cli-install') return [LAYER_BADGES.cli];

  const badges: LayerBadgeDef[] = [LAYER_BADGES.impl];

  if (metadata?._isHarness === true) {
    // Replace impl with harness for Harness framework nodes
    badges.pop();
    badges.push(LAYER_BADGES.harness);
  }

  if (metadata?._isSDD === true) {
    badges.push(LAYER_BADGES.sdd);
  }

  return badges;
}

/** Human-readable type label for the header */
function getTypeLabel(type: string): string {
  switch (type) {
    case 'discovered-agent':     return '▸ Discovered Agent';
    case 'discovered-skill':     return '◆ Discovered Skill';
    case 'discovered-tool':      return '🔧 Discovered Tool';
    case 'discovered-resource':  return '📄 Resource';
    case 'cli-install':          return '⚡ CLI Install';
    default:                     return type;
  }
}

// ── Evidence popup ───────────────────────────────────────────────────────────

const EvidencePopup = ({
  evidence,
  onClose,
}: {
  evidence: string;
  onClose: () => void;
}) => (
  <div
    style={{
      position: 'absolute',
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: SPACE.sm,
      background: 'var(--vscode-dropdown-background, #252526)',
      border: '1px solid var(--vscode-dropdown-border, #454545)',
      borderRadius: '8px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
      zIndex: 1000,
      minWidth: '240px',
      maxWidth: '320px',
      padding: SPACE.md,
      animation: 'pickerFadeIn 0.2s ease-out',
    }}
    onClick={(e) => e.stopPropagation()}
  >
    <div
      style={{
        fontSize: '0.7em',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        opacity: 0.5,
        marginBottom: SPACE.sm,
      }}
    >
      Detection Evidence
    </div>
    <pre
      style={{
        fontSize: '0.75em',
        lineHeight: 1.5,
        opacity: 0.85,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        margin: 0,
        fontFamily: 'var(--vscode-editor-font-family, monospace)',
      }}
    >
      {evidence}
    </pre>
    <button
      style={{
        marginTop: SPACE.sm,
        padding: '6px 16px',
        background: 'transparent',
        border: '1px solid var(--vscode-dropdown-border, #454545)',
        borderRadius: '6px',
        color: 'var(--vscode-dropdown-foreground)',
        cursor: 'pointer',
        fontSize: '0.75em',
        fontWeight: 600,
        width: '100%',
      }}
      onClick={onClose}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      Close
    </button>
  </div>
);

// ── DiscoveredNode component ─────────────────────────────────────────────────

export const DiscoveredNode = ({ id, data, type, selected }: NodeProps) => {
  const [showEvidence, setShowEvidence] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  const isAcknowledged = data.metadata?._acknowledged === true;
  const evidence: string | undefined = data.metadata?._evidence;

  // Layer badges
  const badges = getLayerBadges(type, data.metadata);

  // Base node style for this type
  const baseStyle = NODE_STYLES[type] || NODE_STYLES['discovered-resource'];

  // Hover style
  const hoverStyle: React.CSSProperties = isHovered && !selected
    ? {
        outline: '2px solid var(--vscode-focusBorder)',
        outlineOffset: '2px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
      }
    : {};

  // Selected style
  const selectedStyle: React.CSSProperties = selected
    ? {
        outline: '3px solid var(--vscode-focusBorder)',
        outlineOffset: '3px',
        boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
      }
    : {};

  // Active node style (panel open)
  const isActive: boolean = data.isActive === true;

  const mergedStyle: React.CSSProperties = {
    ...baseStyle,
    ...hoverStyle,
    ...selectedStyle,
    position: 'relative',
    cursor: 'pointer',
    transition: isActive ? undefined : `all 0.2s ${EASE_SMOOTH}`,
  };

  // Accent color for handles
  const accent = HANDLE_ACCENT[type] ?? '#888888';

  return (
    <div
      className="harness-node node-enter"
      data-type={type}
      style={mergedStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        // Don't auto-close evidence on mouse leave (user may click)
      }}
      onClick={() => {
        // Toggle evidence popup when clicking
        if (evidence && !showEvidence) {
          setShowEvidence(true);
        } else {
          setShowEvidence(false);
        }
      }}
      title="Heuristically detected — click for evidence"
    >
      {/* Layer badges — top-left corner */}
      <div
        style={{
          position: 'absolute',
          top: '-8px',
          left: '-8px',
          display: 'flex',
          gap: '3px',
          zIndex: 5,
          pointerEvents: 'none',
        }}
      >
        {badges.map((badge) => (
          <span
            key={badge.label}
            style={{
              fontSize: '0.55em',
              fontWeight: 800,
              letterSpacing: '0.8px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: badge.bg,
              color: badge.color,
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            [{badge.label}]
          </span>
        ))}
      </div>

      {/* Acknowledged/unacknowledged icon — top-right corner */}
      <div
        style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          zIndex: 5,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            fontSize: '0.65em',
            fontWeight: 800,
            background: isAcknowledged
              ? 'rgba(42, 161, 152, 0.2)'
              : 'rgba(204, 136, 68, 0.2)',
            color: isAcknowledged ? '#2aa198' : '#cc8844',
            border: `2px solid ${isAcknowledged ? '#2aa198' : '#cc8844'}`,
            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          }}
        >
          {isAcknowledged ? '✓' : '?'}
        </span>
      </div>

      {/* Header with type label */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: SPACE.sm,
          borderBottom: '1px solid rgba(128,128,128,0.18)',
          paddingBottom: SPACE.xs,
          gap: SPACE.xs,
        }}
      >
        <div
          style={{
            fontSize: '0.6em',
            textTransform: 'uppercase',
            opacity: 0.65,
            letterSpacing: '1.5px',
            fontWeight: 700,
          }}
        >
          {getTypeLabel(type)}
        </div>
      </div>

      {/* Label */}
      <div style={{ fontWeight: 600, fontSize: '1.05em', lineHeight: 1.3 }}>
        {data.label}
      </div>

      {/* Evidence popup */}
      {showEvidence && evidence && (
        <EvidencePopup
          evidence={evidence}
          onClose={() => setShowEvidence(false)}
        />
      )}

      {/* Hidden handles for edge anchoring */}
      <Handle
        type="target"
        position={Position.Top}
        style={HIDDEN_HANDLE_STYLE}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={HIDDEN_HANDLE_STYLE}
        isConnectable={false}
      />
    </div>
  );
};
