// Builds the zip you upload to the Chrome Web Store.
//
//   node tools/make-package.js
//
// Ships only what the extension actually loads. The build scripts, the git
// history and the dormant music / YouTube player stay out: none of it runs,
// and unreferenced code in the bundle is exactly what a reviewer asks about.
//
// No dependencies — the zip is written here, same as the PNG encoder in
// make-brand-assets.js.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');

// Everything that ships. Directories are included whole.
const INCLUDE = [
    'manifest.json',
    'index.html',
    'assets/css',
    'assets/font',
    'assets/icon',
    'assets/image',
    'assets/favicon',
    'assets/brand/icon.svg',
    // Only the scripts index.html actually loads.
    'assets/js/sync.js',
    'assets/js/utils.js',
    'assets/js/settings.js',
    'assets/js/clock.js',
    'assets/js/bookmark.js',
    'assets/js/shortcuts.js',
    'assets/js/background-video.js',
    'assets/js/background.js',
    'assets/js/google.js',
    'assets/js/arrange.js',
];

function walk(rel) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return [];
    if (fs.statSync(abs).isFile()) return [rel];
    return fs.readdirSync(abs).flatMap(entry => walk(path.posix.join(rel, entry)));
}

const files = INCLUDE.flatMap(walk).map(p => p.split(path.sep).join('/'));

// ---------------------------------------------------------------- checks
const problems = [];

if (!files.includes('manifest.json')) problems.push('manifest.json is missing');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

// Every local asset the packaged files point at has to be in the package, or
// it 404s only once it is installed from the store.
const packaged = new Set(files);
const textFiles = files.filter(f => /\.(html|css|js|json)$/.test(f));

textFiles.forEach(file => {
    // Comments are not references. index.html keeps the player's script tags
    // commented out as the switch for turning it back on, and those files are
    // deliberately not shipped. Block comments only: stripping // would eat
    // the https:// in every url.
    const body = fs.readFileSync(path.join(ROOT, file), 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');

    const refs = body.match(/["'(]\/?((?:assets|manifest)[A-Za-z0-9_/.-]*\.[A-Za-z0-9]+)/g) || [];

    refs.forEach(raw => {
        const ref = raw.slice(1).replace(/^\//, '');
        if (!packaged.has(ref)) problems.push(`${file} references ${ref}, which is not in the package`);
    });
});

if (problems.length) {
    console.error('Not packaging:\n' + [...new Set(problems)].map(p => '  - ' + p).join('\n'));
    process.exit(1);
}

// ---------------------------------------------------------------- zip
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

// A fixed timestamp keeps the zip byte-identical between runs of the same
// source, so you can tell a rebuild from a real change.
const DOS_TIME = 0;
const DOS_DATE = 33; // 1980-01-01

const locals = [];
const central = [];
let offset = 0;

files.forEach(name => {
    const body = fs.readFileSync(path.join(ROOT, name));
    const deflated = zlib.deflateRawSync(body, { level: 9 });
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(body);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    locals.push(local, nameBuf, deflated);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(DOS_TIME, 12);
    entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(deflated.length, 20);
    entry.writeUInt32LE(body.length, 24);
    entry.writeUInt16LE(nameBuf.length, 28);
    entry.writeUInt32LE(0, 38); // external attributes
    entry.writeUInt32LE(offset, 42);

    central.push(entry, nameBuf);
    offset += local.length + nameBuf.length + deflated.length;
});

const centralBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);

fs.mkdirSync(OUT_DIR, { recursive: true });

const zipName = `${manifest.name.toLowerCase()}-${manifest.version}.zip`;
const zipPath = path.join(OUT_DIR, zipName);
fs.writeFileSync(zipPath, Buffer.concat([...locals, centralBuf, end]));

const kb = (fs.statSync(zipPath).size / 1024).toFixed(1);
console.log(`${manifest.name} ${manifest.version} -> dist/${zipName}  (${files.length} files, ${kb} KB)`);
console.log('\nThe store rejects a version it has already seen. Bump');
console.log('manifest.json "version" before uploading a change.');
