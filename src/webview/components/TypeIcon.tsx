// FEAT-046 R3 — the tree's type icon, inlined in the webview from the same
// definition. Its colour comes from `--hd-icon-<name>` (iconThemeCss).
import * as React from 'react';
import { ICONS, iconForType } from '../../shared/typeIcons.js';

export const TypeIcon = ({ type, size = 12 }: { type: string; size?: number }) => {
    const name = iconForType(type);
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" data-icon={name}
            stroke={`var(--hd-icon-${name})`} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, verticalAlign: '-2px' }}>
            {ICONS[name].paths.map(d => <path key={d} d={d} />)}
        </svg>
    );
};

const TYPE_LABEL: Record<string, string> = { agent: 'Agent', subagent: 'Subagent', skill: 'Skill', feature: 'Feature', steering: 'Steering', hook: 'Hook' };
export const typeLabel = (type: string) => TYPE_LABEL[type] ?? type;
