import * as React from 'react';

// ── Legend item definition ───────────────────────────────────────────────────

interface LegendItem {
  symbol: string;
  symbolStyle: React.CSSProperties;
  label: string;
}

const LEGEND_ITEMS: LegendItem[] = [
  {
    symbol: '■',
    symbolStyle: { color: '#3399ff' },
    label: '[CLI] Layer 1: Agentic CLI Runtime',
  },
  {
    symbol: '■',
    symbolStyle: { color: '#88cc33' },
    label: '[IMPL] Layer 2: Implementation (prompts, rules, tools, etc.)',
  },
  {
    symbol: '■',
    symbolStyle: { color: '#44aa55' },
    label: '[HARNESS] Layer 2: Harness Framework',
  },
  {
    symbol: '■',
    symbolStyle: { color: '#22bb66' },
    label: '[SDD] Layer 3: SDD Methodology',
  },
  {
    symbol: '?',
    symbolStyle: { color: '#cc8844' },
    label: 'Unacknowledged node',
  },
  {
    symbol: '✓',
    symbolStyle: { color: '#2aa198' },
    label: 'Acknowledged node',
  },
  {
    symbol: '--',
    symbolStyle: { color: 'var(--vscode-descriptionForeground, #888)', opacity: 0.6, letterSpacing: '1px' },
    label: 'Inferred relationship edge',
  },
];

// ── LayerLegend component ────────────────────────────────────────────────────

/**
 * Collapsible legend toggle for the whiteboard toolbar.
 *
 * Shows color-coded layer badges, acknowledged/unacknowledged node states,
 * and the inferred edge style.
 */
export const LayerLegend = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div
      style={{
        position: 'relative',
      }}
    >
      <button
        type="button"
        title={isOpen ? 'Hide layer legend' : 'Show layer legend'}
        aria-label={isOpen ? 'Hide layer legend' : 'Show layer legend'}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '6px',
          border: '1px solid var(--vscode-dropdown-border, var(--vscode-panel-border))',
          background: isOpen
            ? 'var(--vscode-list-hoverBackground, transparent)'
            : 'var(--vscode-toolbar-hoverBackground, transparent)',
          color: 'var(--vscode-dropdown-foreground, var(--vscode-foreground))',
          cursor: 'pointer',
          fontSize: '0.75em',
          fontWeight: 600,
          letterSpacing: '0.3px',
          transition: 'background 0.16s ease, border-color 0.16s ease',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--vscode-focusBorder)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--vscode-dropdown-border, var(--vscode-panel-border))';
        }}
      >
        <span style={{ fontSize: '0.85em' }}>{isOpen ? '▾' : '▸'}</span>
        <span>Legend</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '6px',
            background: 'var(--vscode-dropdown-background, var(--vscode-editorWidget-background, #252526))',
            border: '1px solid var(--vscode-dropdown-border, var(--vscode-panel-border))',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 100,
            minWidth: '280px',
            maxWidth: '320px',
            padding: '10px 14px',
            animation: 'pickerFadeIn 0.15s ease-out',
          }}
        >
          <div
            style={{
              fontSize: '0.65em',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              opacity: 0.5,
              marginBottom: '10px',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--vscode-dropdown-border, var(--vscode-panel-border))',
            }}
          >
            Layer Legend
          </div>
          {LEGEND_ITEMS.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '5px 4px',
                fontSize: '0.78em',
                lineHeight: 1.4,
                opacity: 0.85,
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '0.9em',
                  minWidth: '22px',
                  textAlign: 'center',
                  flexShrink: 0,
                  ...item.symbolStyle,
                }}
              >
                {item.symbol}
              </span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
