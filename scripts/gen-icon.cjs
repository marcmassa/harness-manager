#!/usr/bin/env node
// Generates media/icon.png (128×128) from the design defined in media/icon-color.svg
// Runs as a one-off script: node scripts/gen-icon.js
// Requires: npm install --save-dev canvas (already installed)

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZE = 128;
const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// ── Helpers ──────────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

// ── Background ───────────────────────────────────────────────────────────────

const bgGrad = ctx.createRadialGradient(64, 52, 10, 64, 64, 80);
bgGrad.addColorStop(0, '#252540');
bgGrad.addColorStop(1, '#12121e');

roundRect(ctx, 0, 0, SIZE, SIZE, 22);
ctx.fillStyle = bgGrad;
ctx.fill();

// Subtle border
roundRect(ctx, 0.75, 0.75, SIZE - 1.5, SIZE - 1.5, 21.5);
ctx.strokeStyle = '#3a3a5c';
ctx.lineWidth = 1.5;
ctx.stroke();

// ── Connection lines ─────────────────────────────────────────────────────────

function drawLine(x1, y1, x2, y2, color, width) {
    // Glow pass
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
}

// Gradient line (blue top → purple bottom)
const lineGrad = ctx.createLinearGradient(64, 46, 33, 82);
lineGrad.addColorStop(0, 'rgba(74,125,255,0.9)');
lineGrad.addColorStop(1, 'rgba(108,76,188,0.7)');

ctx.save();
ctx.shadowColor = '#4a7dff';
ctx.shadowBlur = 6;
ctx.strokeStyle = lineGrad;
ctx.lineWidth = 3.5;
ctx.lineCap = 'round';

ctx.beginPath(); ctx.moveTo(64, 46); ctx.lineTo(33, 82); ctx.stroke();
ctx.beginPath(); ctx.moveTo(64, 46); ctx.lineTo(95, 82); ctx.stroke();
ctx.restore();

// Crossbar
ctx.save();
ctx.strokeStyle = 'rgba(108,76,188,0.6)';
ctx.lineWidth = 2.5;
ctx.lineCap = 'round';
ctx.beginPath(); ctx.moveTo(33, 94); ctx.lineTo(95, 94); ctx.stroke();
ctx.restore();

// ── Agent node (top) ─────────────────────────────────────────────────────────

// Outer halo ring
ctx.save();
ctx.beginPath();
ctx.arc(64, 31, 21, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(74,125,255,0.28)';
ctx.lineWidth = 1.5;
ctx.stroke();
ctx.restore();

// Main circle — blue gradient
const agentGrad = ctx.createRadialGradient(61, 27, 2, 64, 31, 17);
agentGrad.addColorStop(0, '#7ea8ff');
agentGrad.addColorStop(1, '#3a6ae8');

ctx.save();
ctx.shadowColor = '#4a7dff';
ctx.shadowBlur = 12;
ctx.beginPath();
ctx.arc(64, 31, 17, 0, Math.PI * 2);
ctx.fillStyle = agentGrad;
ctx.fill();
ctx.restore();

// Inner highlight
ctx.beginPath();
ctx.arc(60, 27, 5, 0, Math.PI * 2);
ctx.fillStyle = 'rgba(255,255,255,0.14)';
ctx.fill();

// "H" letterform
ctx.save();
ctx.font = 'bold 19px "Arial", sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillStyle = 'rgba(255,255,255,0.92)';
ctx.fillText('H', 64, 32);
ctx.restore();

// ── Subagent nodes (bottom) ───────────────────────────────────────────────────

function drawSubagent(cx, cy) {
    // Glow
    ctx.save();
    ctx.shadowColor = '#6c4cbc';
    ctx.shadowBlur = 10;

    const sg = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 14);
    sg.addColorStop(0, '#9370e0');
    sg.addColorStop(1, '#5a3baa');

    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.restore();

    // Inner highlight
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 3, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
}

drawSubagent(33, 96);
drawSubagent(95, 96);

// ── Output ────────────────────────────────────────────────────────────────────

const outPath = path.join(__dirname, '..', 'media', 'icon.png');
const buf = canvas.toBuffer('image/png');
fs.writeFileSync(outPath, buf);
console.log(`icon.png written → ${outPath} (${buf.length} bytes)`);
