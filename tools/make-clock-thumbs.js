// Generates the clock picker thumbnails. Run once; output is committed.
//
// Every face is drawn on the same 260x172 canvas with transparent background,
// so the picker can scale them all to one tile size and they stay visually
// comparable. These render inside <img>, which cannot load webfonts, so the
// faces fall back to a system stack rather than the Archivo/Orbitron the real
// clocks use.
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '../assets/image/clock_option');
const FONT = "Archivo, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "Orbitron, Consolas, 'Courier New', monospace";
const ACCENT = '#1abc9c';

const W = 260;
const H = 172;
const CX = W / 2;
const CY = H / 2;

function svg(body, defs = '') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
${defs}${body}
</svg>
`;
}

// --- v1 card --------------------------------------------------------------
const card = svg(`<g font-family="${FONT}">
  <rect x="14" y="34" width="232" height="104" rx="18" fill="#ffffff" fill-opacity="0.1"/>
  <rect x="14" y="34" width="232" height="104" rx="18" fill="none" stroke="#ffffff" stroke-opacity="0.18"/>
  <text x="${CX}" y="92" font-size="34" font-weight="600" letter-spacing="2" text-anchor="middle" fill="#fff">09:41 AM</text>
  <text x="${CX}" y="116" font-size="11" font-weight="400" text-anchor="middle" fill="#fff">Monday, 10 Aug 2026</text>
</g>`);

// --- v2 analog ------------------------------------------------------------
function polar(angle, radius) {
    const rad = (angle * Math.PI) / 180;
    return [CX + radius * Math.sin(rad), CY - radius * Math.cos(rad)];
}

function hand(angle, radius, width, color) {
    const [x, y] = polar(angle, radius);
    return `  <line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
}

const ticks = [1, 2, 4, 5, 7, 8, 10, 11].map(hour => {
    const [x1, y1] = polar(hour * 30, 58);
    const [x2, y2] = polar(hour * 30, 67);
    return `  <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#fff" stroke-opacity="0.75" stroke-width="2.5" stroke-linecap="round"/>`;
}).join('\n');

const numerals = [[12, 0], [3, 90], [6, 180], [9, 270]].map(([label, angle]) => {
    const [x, y] = polar(angle, 52);
    return `  <text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" font-size="14" font-weight="500" text-anchor="middle" fill="#fff">${label}</text>`;
}).join('\n');

// 09:41:33
const analog = svg(`<g font-family="${FONT}">
  <circle cx="${CX}" cy="${CY}" r="78" fill="#ffffff" fill-opacity="0.13"/>
  <circle cx="${CX}" cy="${CY}" r="78" fill="none" stroke="#ffffff" stroke-opacity="0.2"/>
${ticks}
${numerals}
${hand((9 + 41 / 60) * 30, 38, 5, '#fff')}
${hand(41 * 6, 54, 3.5, '#fff')}
${hand(33 * 6, 60, 2, ACCENT)}
  <circle cx="${CX}" cy="${CY}" r="5" fill="#fff" stroke="${ACCENT}" stroke-width="2"/>
</g>`);

// --- v3 glow --------------------------------------------------------------
const glow = svg(`<g font-family="${MONO}" fill="#fff" text-anchor="middle" filter="url(#glow)">
  <text x="${CX}" y="66" font-size="14" letter-spacing="2">10 - 08 - 2026 | MON</text>
  <text x="${CX}" y="116" font-size="40" letter-spacing="1">09:41:53</text>
</g>`, `<defs>
  <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
    <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#9fe8ff" flood-opacity="0.85"/>
  </filter>
</defs>
`);

// --- v4 stacked -----------------------------------------------------------
const stacked = svg(`<g font-family="${FONT}" fill="#fff">
  <text x="58" y="66" font-size="62" font-weight="200" letter-spacing="-3">09</text>
  <text x="58" y="117" font-size="62" font-weight="200" letter-spacing="-3" opacity="0.55">41</text>
  <rect x="58" y="132" width="128" height="1" opacity="0.18"/>
  <rect x="58" y="132" width="79" height="1"/>
  <text x="58" y="153" font-size="9" font-weight="500" letter-spacing="3">AM</text>
  <rect x="96" y="149" width="13" height="1" opacity="0.45"/>
  <text x="117" y="153" font-size="9" font-weight="500" letter-spacing="3" opacity="0.7">MON 10 AUG</text>
</g>`);

// --- v5 flip --------------------------------------------------------------
function flipDigit(x, y, w, h, value, size) {
    const r = Math.round(w * 0.13);
    return `  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#000000" fill-opacity="0.34"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="#ffffff" stroke-opacity="0.16"/>
    <line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="#000" stroke-opacity="0.5"/>
    <text x="${x + w / 2}" y="${y + h / 2 + size * 0.36}" font-size="${size}" font-weight="500" text-anchor="middle" fill="#fff">${value}</text>
  </g>`;
}

const BIG_Y = 61;
const SMALL_Y = BIG_Y + 50 - 30;

const flip = svg(`<g font-family="${FONT}">
${flipDigit(12, BIG_Y, 34, 50, '0', 31)}
${flipDigit(50, BIG_Y, 34, 50, '9', 31)}
${flipDigit(102, BIG_Y, 34, 50, '4', 31)}
${flipDigit(140, BIG_Y, 34, 50, '1', 31)}
${flipDigit(188, SMALL_Y, 19, 30, '5', 18)}
${flipDigit(210, SMALL_Y, 19, 30, '3', 18)}
  <text x="236" y="${SMALL_Y + 26}" font-size="8" font-weight="600" letter-spacing="1.6" fill="#fff" fill-opacity="0.7">AM</text>
</g>`);

// --- v6 words -------------------------------------------------------------
const ROWS = [
    'ITLISASAMPM',
    'ACQUARTERDC',
    'TWENTYFIVEX',
    'HALFSTENFTO',
    'PASTERUNINE',
    'ONESIXTHREE',
    'FOURFIVETWO',
    'EIGHTELEVEN',
    'SEVENTWELVE',
    'TENSEOCLOCK',
];

// "IT IS TWENTY FIVE PAST NINE", plus AM — what the face shows at 09:41.
const LIT = new Set();
[[0, 0, 2], [0, 3, 2], [0, 7, 2], [2, 0, 6], [2, 6, 4], [4, 0, 4], [4, 7, 4]]
    .forEach(([row, col, len]) => {
        for (let i = 0; i < len; i++) LIT.add(row * 11 + col + i);
    });

const cells = [];
ROWS.forEach((row, r) => {
    row.split('').forEach((letter, c) => {
        const on = LIT.has(r * 11 + c);
        cells.push(`  <text x="${45 + c * 17}" y="${22 + r * 15}" font-size="10" font-weight="600" text-anchor="middle" fill="#fff" fill-opacity="${on ? 1 : 0.13}">${letter}</text>`);
    });
});

const words = svg(`<g font-family="${FONT}">\n${cells.join('\n')}\n</g>`);

// --- v7 rings -------------------------------------------------------------
function arc(r, fraction, opacity, width) {
    const c = 2 * Math.PI * r;
    return `  <circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="#fff" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linecap="round" stroke-dasharray="${(c * fraction).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${CX} ${CY})"/>`;
}

const rings = svg(`<g>
  <circle cx="${CX}" cy="${CY}" r="78" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="2"/>
  <circle cx="${CX}" cy="${CY}" r="64" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="3"/>
  <circle cx="${CX}" cy="${CY}" r="50" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="5"/>
${arc(78, 0.55, 0.45, 2)}
${arc(64, 0.68, 0.7, 3)}
${arc(50, 0.81, 1, 5)}
  <g font-family="${FONT}" text-anchor="middle" fill="#fff">
    <text x="${CX}" y="${CY + 2}" font-size="26" font-weight="300">09:41</text>
    <text x="${CX}" y="${CY + 22}" font-size="8" font-weight="500" letter-spacing="2.2" fill-opacity="0.7">MON 10 AUG</text>
  </g>
</g>`);

// --- v8 LCD ---------------------------------------------------------------
const LCD_DIGITS = {
    0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg',
    5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};

// Geometry mirrors the CSS: mitred bars, unlit segments left as ghosts.
function lcdDigit(x, y, w, h, value) {
    const bar = (bx, by, bw, bh) => {
        const m = bh * 0.42;
        return `${bx + m},${by} ${bx + bw - m},${by} ${bx + bw},${by + bh / 2} ${bx + bw - m},${by + bh} ${bx + m},${by + bh} ${bx},${by + bh / 2}`;
    };
    const post = (px, py, pw, ph) => {
        const m = pw * 0.42;
        return `${px},${py + m} ${px + pw / 2},${py} ${px + pw},${py + m} ${px + pw},${py + ph - m} ${px + pw / 2},${py + ph} ${px},${py + ph - m}`;
    };

    const t = w * 0.15;          // segment thickness
    const inset = w * 0.04;
    const barX = x + w * 0.19;
    const barW = w * 0.62;
    const postH = h * 0.32;

    const shapes = {
        a: bar(barX, y + h * 0.02, barW, h * 0.09),
        g: bar(barX, y + h * 0.455, barW, h * 0.09),
        d: bar(barX, y + h * 0.89, barW, h * 0.09),
        f: post(x + inset, y + h * 0.13, t, postH),
        b: post(x + w - inset - t, y + h * 0.13, t, postH),
        e: post(x + inset, y + h * 0.55, t, postH),
        c: post(x + w - inset - t, y + h * 0.55, t, postH),
    };

    const on = LCD_DIGITS[value];
    return Object.entries(shapes)
        .map(([name, points]) => `  <polygon points="${points}" fill="#fff" fill-opacity="${on.includes(name) ? 1 : 0.08}"/>`)
        .join('\n');
}

const lcdW = 38;
const lcdH = 62;
const lcdY = 46;
const lcdSmallY = lcdY + lcdH - 32;

const lcd = svg(`<g>
${lcdDigit(16, lcdY, lcdW, lcdH, 0)}
${lcdDigit(60, lcdY, lcdW, lcdH, 9)}
  <rect x="106" y="${lcdY + 20}" width="7" height="7" fill="#fff"/>
  <rect x="106" y="${lcdY + 40}" width="7" height="7" fill="#fff"/>
${lcdDigit(122, lcdY, lcdW, lcdH, 4)}
${lcdDigit(166, lcdY, lcdW, lcdH, 1)}
${lcdDigit(212, lcdSmallY, 19, 32, 5)}
${lcdDigit(236, lcdSmallY, 19, 32, 3)}
</g>`);

// --- v9 reels -------------------------------------------------------------
function reel(cx, values, label) {
    const rows = values.map(([text, opacity], i) => `    <text x="${cx}" y="${58 + i * 38}" font-size="30" font-weight="300" text-anchor="middle" fill="#fff" fill-opacity="${opacity}">${text}</text>`).join('\n');
    return `  <g font-family="${FONT}">
${rows}
    <text x="${cx}" y="${58 + 3 * 38 - 4}" font-size="8" font-weight="500" letter-spacing="2.2" text-anchor="middle" fill="#fff" fill-opacity="0.45">${label}</text>
  </g>`;
}

const reels = svg(`<g>
${reel(66, [['08', 0.18], ['09', 1], ['10', 0.18]], 'HR')}
${reel(130, [['40', 0.18], ['41', 1], ['42', 0.18]], 'MIN')}
${reel(194, [['52', 0.18], ['53', 1], ['54', 0.18]], 'SEC')}
</g>`);

// --- v10 day arc ----------------------------------------------------------
// 09:41 is a little over a quarter of the way from sunrise to sunset.
const arcProgress = (9 + 41 / 60 - 6) / 12;
const arcX = 170 - 130 * Math.cos(Math.PI * arcProgress);
const arcY = 150 - 95 * Math.sin(Math.PI * arcProgress);
const arcScale = 0.76; // 340x210 artwork onto the shared 260x172 canvas

const dayArc = svg(`<g transform="scale(${arcScale})">
  <path d="M 40 150 A 130 95 0 0 1 300 150" fill="none" stroke="#fff" stroke-opacity="0.18" stroke-width="2.6" stroke-dasharray="4 8" stroke-linecap="round"/>
  <line x1="18" y1="150" x2="322" y2="150" stroke="#fff" stroke-opacity="0.45"/>
  <line x1="40" y1="178" x2="300" y2="178" stroke="#fff" stroke-opacity="0.12" stroke-width="2.6" stroke-dasharray="4 8" stroke-linecap="round"/>
  <g font-family="${FONT}" fill="#fff" text-anchor="middle">
    <text x="170" y="118" font-size="38" font-weight="300">09:41</text>
    <text x="170" y="138" font-size="10" font-weight="500" letter-spacing="3" fill-opacity="0.7">MON 10 AUG</text>
    <text x="40" y="199" font-size="9" font-weight="500" letter-spacing="2.4" text-anchor="start" fill-opacity="0.45">06:00</text>
    <text x="300" y="199" font-size="9" font-weight="500" letter-spacing="2.4" text-anchor="end" fill-opacity="0.45">18:00</text>
  </g>
  <circle cx="${arcX.toFixed(1)}" cy="${arcY.toFixed(1)}" r="7" fill="#fff"/>
</g>`);

// --- v11 outline ----------------------------------------------------------
const outline = svg(`<g font-family="${FONT}">
  <text x="18" y="106" font-size="76" font-weight="600" letter-spacing="-1.5" fill="none" stroke="#fff" stroke-width="1.4">09:41</text>
  <text x="200" y="106" font-size="24" font-weight="600" fill="#fff">53</text>
  <text x="200" y="122" font-size="8" font-weight="600" letter-spacing="2.4" fill="#fff" fill-opacity="0.7">AM</text>
  <text x="18" y="134" font-size="9" font-weight="500" letter-spacing="3" fill="#fff" fill-opacity="0.7">MONDAY 10 AUGUST</text>
</g>`);

const files = {
    'card_v1.svg': card,
    'analog_v1.svg': analog,
    'glow_v1.svg': glow,
    'stacked_v1.svg': stacked,
    'flip_v1.svg': flip,
    'words_v1.svg': words,
    'rings_v1.svg': rings,
    'lcd_v1.svg': lcd,
    'reels_v1.svg': reels,
    'dayarc_v1.svg': dayArc,
    'outline_v1.svg': outline,
};

Object.entries(files).forEach(([name, content]) => {
    fs.writeFileSync(path.join(OUT, name), content);
    console.log('wrote', name, content.length, 'bytes');
});
