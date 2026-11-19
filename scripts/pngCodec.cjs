// Minimal PNG codec for the extension icon (FEAT-047 R3): decodes 8-bit
// RGBA/RGB and writes an indexed (palette + tRNS) PNG. Plain Node, no deps.
const zlib = require('zlib');

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
})();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
}

/** Decode a non-interlaced 8-bit RGB, RGBA or indexed PNG to { width, height, rgba }. */
function decode(png) {
    let pos = 8, width, height, colorType, idat = [], plte = null, trns = Buffer.alloc(0);
    while (pos < png.length) {
        const len = png.readUInt32BE(pos); const type = png.toString('ascii', pos + 4, pos + 8);
        const data = png.subarray(pos + 8, pos + 8 + len);
        if (type === 'IHDR') {
            width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9];
            if (data[8] !== 8 || data[12] !== 0 || ![2, 3, 6].includes(colorType)) throw new Error('only 8-bit non-interlaced RGB/RGBA/indexed');
        } else if (type === 'IDAT') idat.push(data);
        else if (type === 'PLTE') plte = data;
        else if (type === 'tRNS') trns = data;
        pos += 12 + len;
    }
    const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1, stride = width * bpp;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const out = Buffer.alloc(width * height * 4), prev = Buffer.alloc(stride), line = Buffer.alloc(stride);
    for (let y = 0; y < height; y++) {
        const f = raw[y * (stride + 1)];
        for (let x = 0; x < stride; x++) {
            const v = raw[y * (stride + 1) + 1 + x], a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
            const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
            line[x] = (v + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 0xff;
        }
        for (let x = 0; x < width; x++) {
            const o = (y * width + x) * 4;
            if (bpp === 1) {
                const i = line[x];
                for (let k = 0; k < 3; k++) out[o + k] = plte[i * 3 + k];
                out[o + 3] = i < trns.length ? trns[i] : 255;
                continue;
            }
            for (let k = 0; k < 3; k++) out[o + k] = line[x * bpp + k];
            out[o + 3] = bpp === 4 ? line[x * 4 + 3] : 255;
        }
        line.copy(prev);
    }
    return { width, height, rgba: out };
}

/** Encode RGBA as an indexed PNG; `palette` is an array of [r,g,b,a], `index` one byte per pixel. */
function encodeIndexed(width, height, palette, index) {
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 3;
    const plte = Buffer.from(palette.flatMap(([r, g, b]) => [r, g, b]));
    let lastOpaque = palette.length; while (lastOpaque > 0 && palette[lastOpaque - 1][3] === 255) lastOpaque--;
    const trns = Buffer.from(palette.slice(0, lastOpaque).map(c => c[3]));
    const raw = Buffer.alloc(height * (width + 1));
    for (let y = 0; y < height; y++) index.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
    const idat = zlib.deflateSync(raw, { level: 9, memLevel: 9 });
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', plte),
        ...(trns.length ? [chunk('tRNS', trns)] : []), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * Quantise RGBA to at most `max` colours by median cut over the distinct colours,
 * weighted by pixel count. Opaque colours sort after translucent ones so the
 * tRNS chunk stays short.
 */
function quantize(rgba, max = 256) {
    const counts = new Map();
    for (let i = 0; i < rgba.length; i += 4) { const k = rgba.readUInt32BE(i); counts.set(k, (counts.get(k) || 0) + 1); }
    const colours = [...counts].map(([k, n]) => ({ c: [(k >>> 24) & 255, (k >>> 16) & 255, (k >>> 8) & 255, k & 255], n }));
    let boxes = [colours];
    while (boxes.length < max) {
        let best = -1, bestRange = 0, bestCh = 0;
        boxes.forEach((box, i) => {
            if (box.length < 2) return;
            for (let ch = 0; ch < 4; ch++) {
                let lo = 255, hi = 0; for (const { c } of box) { lo = Math.min(lo, c[ch]); hi = Math.max(hi, c[ch]); }
                if (hi - lo > bestRange) { bestRange = hi - lo; best = i; bestCh = ch; }
            }
        });
        if (best < 0) break;
        const box = boxes[best].sort((a, b) => a.c[bestCh] - b.c[bestCh]);
        const total = box.reduce((s, x) => s + x.n, 0); let acc = 0, cut = 1;
        for (let i = 0; i < box.length - 1; i++) { acc += box[i].n; if (acc >= total / 2) { cut = i + 1; break; } }
        boxes.splice(best, 1, box.slice(0, cut), box.slice(cut));
    }
    const palette = boxes.map(box => { const t = box.reduce((s, x) => s + x.n, 0); return [0, 1, 2, 3].map(ch => Math.round(box.reduce((s, x) => s + x.c[ch] * x.n, 0) / t)); });
    const order = palette.map((_, i) => i).sort((a, b) => (palette[a][3] === 255) - (palette[b][3] === 255));
    const sorted = order.map(i => palette[i]); const remap = new Map(order.map((old, i) => [old, i]));
    const lookup = new Map(); boxes.forEach((box, i) => { for (const { c } of box) lookup.set(((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | c[3]) >>> 0, remap.get(i)); });
    const index = Buffer.alloc(rgba.length / 4);
    for (let i = 0; i < index.length; i++) index[i] = lookup.get(rgba.readUInt32BE(i * 4));
    return { palette: sorted, index, distinct: colours.length };
}

module.exports = { decode, encodeIndexed, quantize };
