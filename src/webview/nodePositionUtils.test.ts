import { describe, expect, it } from 'vitest';
import {
    isValidNodePosition,
    mergeLayoutedNodesWithManualPositions,
    type ManualPositionMap,
} from './nodePositionUtils.js';

describe('nodePositionUtils', () => {
    it('isValidNodePosition returns true only for finite x/y coordinates', () => {
        expect(isValidNodePosition({ x: 10, y: 20 })).toBe(true);
        expect(isValidNodePosition({ x: Number.NaN, y: 20 })).toBe(false);
        expect(isValidNodePosition({ x: 10, y: Number.POSITIVE_INFINITY })).toBe(false);
        expect(isValidNodePosition(undefined)).toBe(false);
    });

    it('mergeLayoutedNodesWithManualPositions overrides layout when manual position exists and is valid', () => {
        const layoutedNodes = [
            { id: 'a', position: { x: 0, y: 0 } },
            { id: 'b', position: { x: 100, y: 100 } },
        ];
        const manualPositions: ManualPositionMap = {
            a: { x: 42, y: 64 },
        };

        const merged = mergeLayoutedNodesWithManualPositions(layoutedNodes, manualPositions);
        const nodeA = merged.nodes.find((node) => node.id === 'a');
        const nodeB = merged.nodes.find((node) => node.id === 'b');

        expect(nodeA?.position).toEqual({ x: 42, y: 64 });
        expect(nodeB?.position).toEqual({ x: 100, y: 100 });
    });

    it('mergeLayoutedNodesWithManualPositions ignores invalid manual positions and sanitizes the map', () => {
        const layoutedNodes = [
            { id: 'a', position: { x: 10, y: 20 } },
        ];
        const manualPositions: ManualPositionMap = {
            a: { x: Number.NaN as unknown as number, y: 30 },
            stale: { x: Number.POSITIVE_INFINITY as unknown as number, y: 0 },
        };

        const merged = mergeLayoutedNodesWithManualPositions(layoutedNodes, manualPositions);
        expect(merged.nodes[0].position).toEqual({ x: 10, y: 20 });
        expect(merged.manualPositions.a).toBeUndefined();
        expect(merged.manualPositions.stale).toBeUndefined();
    });
});
