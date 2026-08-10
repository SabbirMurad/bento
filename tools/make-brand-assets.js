// Generates the brand mark and the extension icons. Run once; output is
// committed. Node only — no dependencies, so the PNGs are rasterised here
// rather than round-tripped through a browser canvas.
//
//   node tools/make-brand-assets.js
//
// The mark is a four-tile grid with one tile lifted out of place: the page is
// yours to rearrange. The extension icons put it on a dark rounded square,
// because a white-on-transparent mark vanishes against chrome://extensions
// and the Web Store, both of which are light.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const BRAND = path.join(ROOT, 'assets', 'brand');
const ICONS = path.join(ROOT, 'assets', 'favicon');

const INK = '#ffffff';
const ACCENT = '#1abc9c';
const SLATE = '#2b3038';

// ---------------------------------------------------------------- geometry
// One description of the mark, shared by the SVG writer and the rasteriser.
// Full bleed: no plate, no outer padding. The loose tile's top-right corner
// and the grid's bottom-left corner touch the edges of the box, so the mark
// is exactly as large as the canvas allows.
//
//   2t + gap + offset = s   holds on both axes, which keeps it square.
function markTiles(s) {
    const gap = s * 0.09;
    // How far the loose tile sits out of the grid. The broken alignment is the
    // whole idea, so it has to survive being scaled down to 16px.
    const off = s * 0.13;
    const t = (s - gap - off) / 2;
    const r = t * 0.2;
    const tile = (x, y, fill, alpha) => ({ x, y, w: t, h: t, fill, alpha });

    return {
        r,
        tiles: [
            tile(0, off, INK, 1),
            tile(0, off + t + gap, INK, 1),
            tile(t + gap, off + t + gap, INK, 1),
            tile(t + gap + off, 0, ACCENT, 1),
        ],
    };
}

// ---------------------------------------------------------------- svg
function markSvg(s, { ink = INK } = {}) {
    const m = markTiles(s);

    const rect = (t, fill) =>
        `  <rect x="${t.x.toFixed(2)}" y="${t.y.toFixed(2)}" width="${t.w.toFixed(2)}" height="${t.h.toFixed(2)}" rx="${m.r.toFixed(2)}" fill="${fill}"/>`;

    const parts = m.tiles.map(t => rect(t, t.fill === ACCENT ? ACCENT : ink));

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
${parts.join('\n')}
</svg>
`;
}

// ---------------------------------------------------------------- raster
const SS = 4; // supersampling factor, for antialiased corners

function insideRoundRect(x, y, t, r) {
    const dx = Math.max(t.x + r - x, 0, x - (t.x + t.w - r));
    const dy = Math.max(t.y + r - y, 0, y - (t.y + t.h - r));
    if (dx === 0 && dy === 0) return true;
    return dx * dx + dy * dy <= r * r;
}

function hexToRgb(hex) {
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

function rasterise(s, ink) {
    const m = markTiles(s);
    const layers = m.tiles.map(t => ({
        shape: t,
        r: m.r,
        rgb: hexToRgb(t.fill === ACCENT ? ACCENT : ink),
        alpha: 1,
    }));

    const px = Buffer.alloc(s * s * 4);

    for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
            let [rr, gg, bb, aa] = [0, 0, 0, 0];

            for (const layer of layers) {
                // Coverage of this pixel by this shape, by supersampling.
                let hits = 0;
                for (let sy = 0; sy < SS; sy++) {
                    for (let sx = 0; sx < SS; sx++) {
                        const px_ = x + (sx + 0.5) / SS;
                        const py_ = y + (sy + 0.5) / SS;
                        if (insideRoundRect(px_, py_, layer.shape, layer.r)) hits++;
                    }
                }
                if (!hits) continue;

                const a = (hits / (SS * SS)) * layer.alpha;
                const [lr, lg, lb] = layer.rgb;
                // source-over
                const outA = a + aa * (1 - a);
                rr = (lr * a + rr * aa * (1 - a)) / outA;
                gg = (lg * a + gg * aa * (1 - a)) / outA;
                bb = (lb * a + bb * aa * (1 - a)) / outA;
                aa = outA;
            }

            const i = (y * s + x) * 4;
            px[i] = Math.round(rr);
            px[i + 1] = Math.round(gg);
            px[i + 2] = Math.round(bb);
            px[i + 3] = Math.round(aa * 255);
        }
    }

    return px;
}

// ---------------------------------------------------------------- png
const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    return table;
})();

function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;   // bit depth
    ihdr[9] = 6;   // colour type: RGBA
    // 10..12 stay 0: deflate, adaptive filtering, no interlace

    // One filter byte (0 = none) per scanline.
    const raw = Buffer.alloc(size * (size * 4 + 1));
    for (let y = 0; y < size; y++) {
        raw[y * (size * 4 + 1)] = 0;
        rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
    }

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// ---------------------------------------------------------------- write
fs.mkdirSync(BRAND, { recursive: true });

// White for dark surfaces, slate for light ones.
fs.writeFileSync(path.join(BRAND, 'logo.svg'), markSvg(128));
fs.writeFileSync(path.join(BRAND, 'logo-dark.svg'), markSvg(128, { ink: SLATE }));
console.log('wrote 2 svg files to assets/brand');

// The extension icons use the slate ink: with no plate behind them they sit
// straight on chrome://extensions and the Web Store listing, and both of
// those are light.
for (const size of [16, 32, 48, 128]) {
    const png = encodePng(size, rasterise(size, SLATE));
    fs.writeFileSync(path.join(ICONS, `icon${size}.png`), png);
    console.log(`wrote assets/favicon/icon${size}.png (${png.length} bytes)`);
}
