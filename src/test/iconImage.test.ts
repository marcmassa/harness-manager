// FEAT-047 R3 — the extension icon is a palettised 128×128 PNG of at most
// 8 KB that matches the 0.8 RGBA icon within 8/255 on every channel.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { decode } = createRequire(import.meta.url)('../../scripts/pngCodec.cjs');

describe('extension icon (FEAT-047 R3)', () => {
    const png = readFileSync('media/icon.png');
    it('is 128×128 and at most 8 KB', () => {
        expect(png.readUInt32BE(16)).toBe(128);
        expect(png.readUInt32BE(20)).toBe(128);
        expect(png.length).toBeLessThanOrEqual(8 * 1024);
    });

    it('differs from the 0.8 icon by at most 8/255 on any channel', () => {
        const now = decode(png).rgba as Buffer;
        const before = decode(readFileSync('src/test/fixtures/icon-rgba-0.8.png')).rgba as Buffer;
        expect(now.length).toBe(before.length);
        let max = 0;
        for (let i = 0; i < now.length; i++) max = Math.max(max, Math.abs(now[i] - before[i]));
        expect(max).toBeLessThanOrEqual(8);
    });
});
