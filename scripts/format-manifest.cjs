#!/usr/bin/env node
// Rewrites package.json compactly: small objects and short primitive arrays on
// one line. npm reformats the manifest on install/uninstall; run this after,
// because the pre-commit hook limits authored files to 20,000 bytes.
const fs = require('fs');
const file = process.argv[2] || 'package.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const prim = v => v === null || typeof v !== 'object';
function fmt(v, ind = 0) {
    const sp = '  '.repeat(ind);
    if (Array.isArray(v)) {
        if (!v.length) return '[]';
        if (v.every(prim)) { const one = `[${v.map(x => JSON.stringify(x)).join(', ')}]`; if (one.length <= 100) return one; }
        return `[\n${v.map(x => `${sp}  ${fmt(x, ind + 1)}`).join(',\n')}\n${sp}]`;
    }
    if (v && typeof v === 'object') {
        const keys = Object.keys(v);
        if (!keys.length) return '{}';
        if (keys.every(k => prim(v[k]))) { const one = `{ ${keys.map(k => `${JSON.stringify(k)}: ${JSON.stringify(v[k])}`).join(', ')} }`; if (one.length + sp.length <= 120) return one; }
        return `{\n${keys.map(k => `${sp}  ${JSON.stringify(k)}: ${fmt(v[k], ind + 1)}`).join(',\n')}\n${sp}}`;
    }
    return JSON.stringify(v);
}
const out = fmt(data) + '\n';
if (JSON.stringify(JSON.parse(out)) !== JSON.stringify(data)) throw new Error('format changed the manifest');
fs.writeFileSync(file, out);
