// FEAT-041 T2 — workspace Markdown profile v1 (docs/byoh/adapter-capabilities.md).
// Pure validation: no vscode import. A profile describes reads only; it can
// never name code to load.

import type { EdgeLabel, NodeType, ParserError } from '../types.js';
import { isLoadMode, type LoadMode } from '../cost/loadMode.js';

export const PROFILE_SOURCE = '.harness-dashboard/config.json';

export type ProfileEntityType = Extract<NodeType, 'agent' | 'subagent' | 'skill' | 'steering' | 'hook'>;
const ENTITY_TYPES = new Set<string>(['agent', 'subagent', 'skill', 'steering', 'hook']);
const EDGE_LABELS = new Set<string>(['uses', 'manages', 'governs', 'triggers']);
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export interface ProfileEntity {
    glob: string;
    type: ProfileEntityType;
    idField?: string;
    labelField?: string;
    /** FEAT-044: optional within version 1; omitted means `unknown`. */
    loadMode?: LoadMode;
}

export interface ProfileRelationship {
    fromType: ProfileEntityType;
    field: string;
    toType: ProfileEntityType;
    label: EdgeLabel;
}

export interface ProfileV1 {
    version: 1;
    id: string;
    label: string;
    markers: string[];
    entities: ProfileEntity[];
    relationships: ProfileRelationship[];
}

export interface ProfileValidation {
    profiles: ProfileV1[];
    diagnostics: ParserError[];
}

/**
 * A workspace-relative path or glob that cannot leave the root: no absolute
 * path, drive letter, URI scheme, home shortcut or `..` segment. Symlinked
 * targets are checked separately against the resolved file (ProfileAdapter).
 */
export function isContainedPattern(value: unknown): value is string {
    if (typeof value !== 'string' || !value.trim()) return false;
    const path = value.replace(/\\/g, '/');
    if (/^(?:\/|~|[a-z]:|[a-z][a-z0-9+.-]*:)/i.test(path)) return false;
    return !path.split('/').includes('..');
}

const optionalString = (value: unknown) => value === undefined || (typeof value === 'string' && value.trim() !== '');

/**
 * Validate `profiles[]`. An invalid or colliding profile is skipped as a whole
 * with one diagnostic; an invalid entity or relationship is skipped alone.
 * `reservedIds` holds every provider ID already registered (built-in and
 * companion), so a workspace file can never impersonate installed code.
 */
export function validateProfiles(raw: unknown, reservedIds: ReadonlySet<string>): ProfileValidation {
    const diagnostics: ParserError[] = [];
    const report = (path: string, message: string) => diagnostics.push({ file: PROFILE_SOURCE, message: `${path}: ${message}` });
    if (raw === undefined) return { profiles: [], diagnostics };
    if (!Array.isArray(raw)) {
        report('profiles', 'must be an array');
        return { profiles: [], diagnostics };
    }

    const seen = new Set<string>();
    const profiles: ProfileV1[] = [];
    raw.forEach((candidate, index) => {
        const at = `profiles[${index}]`;
        if (!candidate || typeof candidate !== 'object') return report(at, 'must be an object');
        const p = candidate as Record<string, unknown>;
        if (p.version !== 1) return report(at, `unknown schema version ${JSON.stringify(p.version)}; skipped`);
        if (typeof p.id !== 'string' || !ID_RE.test(p.id)) return report(`${at}.id`, 'must match ' + ID_RE.source);
        if (reservedIds.has(p.id) || seen.has(p.id)) return report(`${at}.id`, `"${p.id}" collides with an existing provider ID; skipped`);
        const markers = Array.isArray(p.markers) ? p.markers : [];
        if (markers.length === 0) return report(`${at}.markers`, 'must list at least one marker file');
        const badMarker = markers.findIndex(m => !isContainedPattern(m));
        if (badMarker >= 0) return report(`${at}.markers[${badMarker}]`, 'escapes the workspace root; skipped');

        const entities: ProfileEntity[] = [];
        (Array.isArray(p.entities) ? p.entities : []).forEach((e, i) => {
            const eat = `${at}.entities[${i}]`;
            const entity = (e ?? {}) as Record<string, unknown>;
            if (!isContainedPattern(entity.glob)) return report(`${eat}.glob`, 'missing or escapes the workspace root; skipped');
            if (typeof entity.type !== 'string' || !ENTITY_TYPES.has(entity.type)) return report(`${eat}.type`, `unknown type ${JSON.stringify(entity.type)}; skipped`);
            if (!optionalString(entity.idField) || !optionalString(entity.labelField)) return report(eat, 'idField and labelField must be non-empty strings; skipped');
            if (entity.loadMode !== undefined && !isLoadMode(entity.loadMode)) return report(`${eat}.loadMode`, `unknown load mode ${JSON.stringify(entity.loadMode)}; skipped`);
            entities.push({
                glob: entity.glob as string,
                type: entity.type as ProfileEntityType,
                idField: entity.idField as string | undefined,
                labelField: entity.labelField as string | undefined,
                ...(entity.loadMode !== undefined ? { loadMode: entity.loadMode as LoadMode } : {}),
            });
        });
        if (entities.length === 0) return report(`${at}.entities`, 'no valid entity; skipped');

        const relationships: ProfileRelationship[] = [];
        (Array.isArray(p.relationships) ? p.relationships : []).forEach((r, i) => {
            const rel = (r ?? {}) as Record<string, unknown>;
            const label = rel.label ?? 'uses';
            const valid = ENTITY_TYPES.has(rel.fromType as string) && ENTITY_TYPES.has(rel.toType as string)
                && typeof rel.field === 'string' && rel.field.trim() !== '' && EDGE_LABELS.has(label as string);
            if (!valid) return report(`${at}.relationships[${i}]`, 'needs fromType, toType, field and a known label; skipped');
            relationships.push({
                fromType: rel.fromType as ProfileEntityType,
                toType: rel.toType as ProfileEntityType,
                field: rel.field as string,
                label: label as EdgeLabel,
            });
        });

        seen.add(p.id);
        profiles.push({
            version: 1,
            id: p.id,
            label: typeof p.label === 'string' && p.label.trim() ? p.label : p.id,
            markers: markers as string[],
            entities,
            relationships,
        });
    });
    return { profiles, diagnostics };
}
