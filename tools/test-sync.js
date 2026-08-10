// Exercises assets/js/sync.js against stubbed chrome.storage + localStorage.
// The browser cannot test this: chrome.storage is undefined over localhost.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const SRC = fs.readFileSync(path.resolve(__dirname, '../assets/js/sync.js'), 'utf8');

function makeLocalStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        get length() { return map.size; },
        key: i => [...map.keys()][i],
        getItem: k => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: k => map.delete(k),
        _dump: () => Object.fromEntries(map),
    };
}

function run({ local = {}, synced = undefined, noChrome = false }) {
    const localStorage = makeLocalStorage(local);
    const written = [];
    let reloaded = false;
    const warnings = [];

    const chrome = noChrome ? undefined : {
        storage: {
            sync: {
                get: async () => (synced === undefined ? {} : { 'bento-settings': synced }),
                set: async obj => { written.push(obj['bento-settings']); },
            },
        },
    };

    const ctx = {
        localStorage,
        chrome,
        console: { warn: (...a) => warnings.push(a.join(' ')) },
        location: { reload: () => { reloaded = true; } },
        setTimeout, clearTimeout, Promise, JSON, Date, Number, Object, String,
    };
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx);

    return { ctx, localStorage, written, warnings, reloaded: () => reloaded };
}

const settle = () => new Promise(r => setTimeout(r, 60));
let failures = 0;
function check(name, cond, extra = '') {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  <- ' + extra}`);
    if (!cond) failures++;
}

(async () => {
    // 1. No chrome.storage (localhost): must not crash, page still writes locally.
    {
        const t = run({ noChrome: true, local: { 'clock-style': 'clock-v4' } });
        t.localStorage.setItem('glass-color', '#123456');
        await settle();
        check('no chrome.storage: writes still land locally',
            t.localStorage.getItem('glass-color') === '#123456');
        check('no chrome.storage: nothing pushed', t.written.length === 0);
    }

    // 2. Sync holds a newer snapshot: seed local and reload.
    {
        const t = run({
            local: { 'clock-style': 'clock-v1', 'settings-synced-at': '1000' },
            synced: { at: 5000, values: { 'clock-style': 'clock-v6', 'glass-color': '#abcdef' } },
        });
        await settle();
        check('newer remote: local seeded from sync',
            t.localStorage.getItem('clock-style') === 'clock-v6', t.localStorage.getItem('clock-style'));
        check('newer remote: new key arrived',
            t.localStorage.getItem('glass-color') === '#abcdef');
        check('newer remote: stamp advanced',
            t.localStorage.getItem('settings-synced-at') === '5000');
        check('newer remote: reloaded once', t.reloaded());
    }

    // 3. Sync holds an older snapshot: local wins, no reload.
    {
        const t = run({
            local: { 'clock-style': 'clock-v9', 'settings-synced-at': '9000' },
            synced: { at: 4000, values: { 'clock-style': 'clock-v1' } },
        });
        await settle();
        check('older remote: local kept',
            t.localStorage.getItem('clock-style') === 'clock-v9');
        check('older remote: no reload', !t.reloaded());
    }

    // 4. A write pushes a snapshot, debounced.
    {
        const t = run({ local: {}, synced: undefined });
        t.localStorage.setItem('clock-style', 'clock-v5');
        t.localStorage.setItem('glass-color', '#000000');
        await settle();
        check('write: nothing pushed before the debounce', t.written.length === 0);
        await new Promise(r => setTimeout(r, 1700));
        check('write: exactly one push for two rapid writes', t.written.length === 1, `got ${t.written.length}`);
        check('write: push carries both values',
            t.written[0] && t.written[0].values['clock-style'] === 'clock-v5'
            && t.written[0].values['glass-color'] === '#000000');
        check('write: stamp is not itself synced',
            t.written[0] && !('settings-synced-at' in t.written[0].values));
    }

    // 5. Oversized settings: warn, do not push.
    {
        const big = {};
        for (let i = 0; i < 400; i++) big['key-' + i] = 'x'.repeat(30);
        const t = run({ local: big });
        t.localStorage.setItem('trigger', '1');
        await new Promise(r => setTimeout(r, 1700));
        check('oversized: refused rather than thrown', t.written.length === 0);
        check('oversized: warned', t.warnings.some(w => w.includes('not syncing')), t.warnings.join('|'));
    }

    console.log(failures ? `\n${failures} FAILED` : '\nall passed');
    process.exit(failures ? 1 : 0);
})();
