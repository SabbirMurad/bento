// The console: a full-screen terminal for typed commands.
//
// Everything below the registry is plumbing that does not care what the
// commands are. To add one, put an entry in CONSOLE_COMMANDS — nothing else
// needs touching.

// ---------------------------
// What the commands are built from
// ---------------------------

// Where a command that "opens" something sends you: a new tab, so the
// console survives the command and you can fire off several without coming
// back. Every command goes through here.
//
// This runs inside the Enter keydown, so the popup blocker treats it as a
// user gesture. A command that awaits something before opening would lose
// that gesture and be blocked — call this first, then await.
function openFromConsole(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
    reportLaunch(url);
}

// A command that opens a tab otherwise leaves the console looking as though
// nothing happened — the new tab may not even have focus yet. Printing the
// URL also shows what the command actually built, which is the difference
// between "that did nothing" and "I typed the wrong thing".
function reportLaunch(url) {
    printConsoleLine(`Launched in new tab: ${url}`, 'launch');
}

// chrome:// pages cannot be reached from a page script with a link or by
// setting location — chrome.tabs.create is the only route. It needs no
// permission of its own; the "tabs" permission gates reading tab properties
// like url and title, which this does not do.
function openChromePage(url) {
    if (!globalThis.chrome || !chrome.tabs || !chrome.tabs.create) {
        throw new Error('Chrome pages are only reachable once this is installed as an extension.');
    }
    chrome.tabs.create({ url });
    reportLaunch(url);
}

// Most of the list is one command with a different URL each time: take the
// rest of the line, encode it, open a search page. Writing that out six times
// invites six subtly different escaping bugs.
function searchCommand(summary, buildUrl) {
    return {
        summary,
        group: 'Search the web',
        run(args) {
            const query = args.join(' ').trim();
            if (!query) throw new Error('Give me something to search for.');
            openFromConsole(buildUrl(encodeURIComponent(query)));
        },
    };
}

// Arithmetic without eval: the page's CSP is script-src 'self' with no
// unsafe-eval, and that is worth keeping for the sake of one command. This is
// a plain recursive descent parser over + - * / % ^ ( ) and unary minus.
function evaluateExpression(input) {
    // Whitespace is scanned rather than stripped first: dropping it up front
    // would join "2 3" into the single number 23, so "calc 25 40" would
    // quietly answer 2540 instead of complaining.
    const parts = input.match(/\d+(?:\.\d+)?|[-+*/%^()]|\s+/g) || [];

    // Anything the scanner skipped is a character we do not understand, and
    // ignoring it would turn "2 & 3" into 23 by another route.
    if (parts.join('') !== input) throw new Error(`I cannot work out "${input.trim()}".`);

    const tokens = [];
    let previousWasNumber = false;
    for (const part of parts) {
        if (/^\s/.test(part)) continue;
        const isNumber = /^\d/.test(part);
        if (isNumber && previousWasNumber) throw new Error('Two numbers with no operator between them.');
        previousWasNumber = isNumber;
        tokens.push(part);
    }

    let at = 0;
    const eat = token => (tokens[at] === token ? (at++, true) : false);

    function expression() {              // + -
        let value = term();
        for (;;) {
            if (eat('+')) value += term();
            else if (eat('-')) value -= term();
            else return value;
        }
    }

    function term() {                    // * / %
        let value = power();
        for (;;) {
            if (eat('*')) value *= power();
            else if (eat('/')) value /= power();
            else if (eat('%')) value %= power();
            else return value;
        }
    }

    function power() {                   // ^, right associative: 2^3^2 is 512
        const base = unary();
        return eat('^') ? base ** power() : base;
    }

    function unary() {
        if (eat('-')) return -unary();
        if (eat('+')) return unary();
        return primary();
    }

    function primary() {
        if (eat('(')) {
            const value = expression();
            if (!eat(')')) throw new Error('A bracket is left open.');
            return value;
        }
        const token = tokens[at];
        if (token === undefined || !/^\d/.test(token)) {
            throw new Error(token === undefined ? 'The expression stops early.' : `Expected a number, found "${token}".`);
        }
        at++;
        return Number(token);
    }

    const result = expression();
    if (at < tokens.length) throw new Error(`Did not expect "${tokens[at]}".`);
    if (!Number.isFinite(result)) throw new Error('That does not come out to a number.');
    return result;
}

// CoinGecko rather than the CoinCap endpoint the notes pointed at: CoinCap's
// v2 host no longer resolves and its v3 replacement answers 401 without an
// API key, and a key shipped inside an extension is a published key. This
// needs no key, and it sends Access-Control-Allow-Origin: *, so it works
// under plain CORS without a host permission in the manifest — which matters
// for a listing that has already been rejected once over permissions.
const COINGECKO = 'https://api.coingecko.com/api/v3';

async function coinGecko(path) {
    let response;
    try {
        response = await fetch(`${COINGECKO}${path}`);
    } catch {
        // fetch only rejects for network-level failures, never for a 4xx.
        throw new Error('Could not reach CoinGecko. Are you online?');
    }
    if (response.status === 429) throw new Error('CoinGecko is rate limiting. Give it a minute.');
    if (!response.ok) throw new Error(`CoinGecko answered ${response.status}.`);
    return response.json();
}

// "btc" matches a long tail of wrapped, bridged and imitation tokens, so an
// exact ticker with the largest market cap beats whatever the search happens
// to return first.
function pickCoinMatch(coins, query) {
    const wanted = query.trim().toLowerCase();
    const byRank = list => list
        .filter(coin => typeof coin.market_cap_rank === 'number')
        .sort((a, b) => a.market_cap_rank - b.market_cap_rank);

    const byId = coins.filter(coin => (coin.id || '').toLowerCase() === wanted);
    const bySymbol = coins.filter(coin => (coin.symbol || '').toLowerCase() === wanted);

    return byId[0] || byRank(bySymbol)[0] || bySymbol[0] || byRank(coins)[0] || coins[0];
}

function formatUsd(value) {
    if (typeof value !== 'number') return '—';

    // A meme coin's price and its daily change both sit far below a cent, so
    // a fixed number of decimals renders every one of them as $0.00. Scale
    // the precision to the magnitude instead, keeping three digits past the
    // leading zeros, and let maximumFractionDigits trim the trailing ones.
    const magnitude = Math.abs(value);
    const decimals = magnitude === 0 || magnitude >= 1
        ? 2
        : Math.min(18, Math.ceil(-Math.log10(magnitude)) + 3);

    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: decimals,
    });
}

function formatCompactUsd(value) {
    if (typeof value !== 'number') return '—';
    return '$' + value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 });
}

function formatPercent(value) {
    if (typeof value !== 'number') return '—';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

// The settings checkboxes are already the record of what can be hidden: each
// carries data-widget-toggle="<id to hide>" and sits inside the settings
// panel named after it. Reading the vocabulary off them means a widget added
// later is nameable here without anyone remembering to come back.
function widgetToggles() {
    const byName = new Map();
    document.querySelectorAll('[data-widget-toggle]').forEach(input => {
        const panel = input.closest('[item-name]');
        const name = panel ? panel.getAttribute('item-name') : input.dataset.widgetToggle;
        byName.set(name.toLowerCase(), input);
    });
    return byName;
}

function findWidget(query) {
    const toggles = widgetToggles();
    const wanted = query.trim().toLowerCase();
    if (!wanted) return null;

    // The panel is named "shortcut" but "shortcuts" is what anyone types.
    for (const candidate of [wanted, wanted.replace(/s$/, ''), `${wanted}s`]) {
        if (toggles.has(candidate)) return { name: candidate, input: toggles.get(candidate) };
    }
    return null;
}

function setWidgetVisible(query, visible) {
    const found = findWidget(query);
    if (!found) {
        const names = [...widgetToggles().keys()].sort().join(', ');
        throw new Error(query.trim()
            ? `No widget called "${query.trim()}". Try one of: ${names}.`
            : `Name a widget: ${names}.`);
    }

    const state = visible ? 'on' : 'off';
    if (found.input.checked === visible) return `${found.name} is already ${state}.`;

    found.input.checked = visible;
    // Dispatching change rather than writing the storage key here means the
    // settings panel, the page and the saved value cannot drift apart — this
    // goes through exactly the path clicking the checkbox does.
    found.input.dispatchEvent(new Event('change'));
    return `${found.name} is now ${state}.`;
}

// The clock style picker in settings already names all eleven faces in its
// alt text and pairs each with its class, so read them off it rather than
// keeping a second list that could fall behind clock.js.
function clockStyleOptions() {
    return [...document.querySelectorAll('.clock-style-wrapper img[clock-name]')].map(img => ({
        id: img.getAttribute('clock-name'),
        label: img.getAttribute('alt') || img.getAttribute('clock-name'),
        el: img,
    }));
}

function findClockStyle(query) {
    const wanted = query.trim().toLowerCase();
    if (!wanted) return null;

    // "Day arc", "clock-v10", "v10" and "10" should all land on the same face.
    const asVersion = /^v?(\d{1,2})$/.exec(wanted);
    const id = asVersion ? `clock-v${asVersion[1]}` : wanted;

    const options = clockStyleOptions();
    return options.find(option => option.id.toLowerCase() === id)
        || options.find(option => option.label.toLowerCase() === wanted)
        || null;
}

// chrome.storage holds the shortcuts, and it is missing whenever this runs as
// a plain page rather than an installed extension.
function requireShortcutStorage() {
    if (!globalThis.chrome || !chrome.storage || !chrome.storage.sync) {
        throw new Error('Shortcuts are only reachable once this is installed as an extension.');
    }
}

async function readShortcuts() {
    requireShortcutStorage();
    const { shortcuts } = await chrome.storage.sync.get('shortcuts');
    return shortcuts || [];
}

// Accepts the position from "shortcut list", the stored url, or enough of the
// domain to be unambiguous — nobody wants to retype a url to delete it.
function pickShortcut(shortcuts, query) {
    const wanted = query.trim().toLowerCase();

    const position = /^\d+$/.test(wanted) ? Number(wanted) : null;
    if (position !== null) {
        if (position < 1 || position > shortcuts.length) {
            throw new Error(`There is no shortcut ${position}. Run shortcut list.`);
        }
        return shortcuts[position - 1];
    }

    const exact = shortcuts.find(url => url.toLowerCase() === wanted);
    if (exact) return exact;

    const partial = shortcuts.filter(url => url.toLowerCase().includes(wanted));
    if (partial.length === 1) return partial[0];
    if (partial.length > 1) throw new Error(`"${query.trim()}" matches ${partial.length}: ${partial.join(', ')}.`);
    throw new Error(`No shortcut matches "${query.trim()}". Run shortcut list.`);
}

// Backgrounds live in IndexedDB with both presets and uploads in one store,
// so a name is friendlier than the uuid an upload gets.
function pickBackground(videos, query) {
    const wanted = query.trim().toLowerCase();

    const byId = videos.find(video => (video.id || '').toLowerCase() === wanted);
    if (byId) return byId;

    const exact = videos.find(video => (video.name || '').toLowerCase() === wanted);
    if (exact) return exact;

    const partial = videos.filter(video => (video.name || '').toLowerCase().includes(wanted));
    if (partial.length === 1) return partial[0];
    if (partial.length > 1) {
        throw new Error(`"${query.trim()}" matches ${partial.length}: ${partial.map(v => v.name).join(', ')}.`);
    }
    throw new Error(`No background called "${query.trim()}". Run bg list to see them.`);
}

// gh repos and gh -r act on *your* repositories, so they need to know who you
// are. There is no way to ask GitHub that without signing in, so it is stored
// once and syncs with the rest of the settings.
const GITHUB_USER_KEY = 'console-github-user';

function requireGithubUser() {
    const user = localStorage.getItem(GITHUB_USER_KEY);
    if (!user) throw new Error('Set your GitHub username first: gh user <name>');
    return user;
}

function validGithubName(name) {
    return /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(name);
}

// ---------------------------
// The commands
// ---------------------------

// Each entry is { summary, run(args, ctx) }.
//
//   args  the words after the command name, already split
//   ctx   { print, clear } — print(text, kind) where kind is
//         'output' | 'error' | 'note'
//
// run() may return a string, an array of lines, or a promise of either; it is
// awaited, and anything it returns is printed as output. Returning nothing is
// fine for a command that prints as it goes or has no output at all.
// The order help prints its headings in, roughly most-used first. A command
// whose group is missing from this list still gets printed, under its own
// heading at the end — a typo in a group name should misfile a command, not
// hide it.
const CONSOLE_GROUP_ORDER = [
    'Search the web',
    'Open a page',
    'This page',
    'Work things out',
    'The console',
];

const CONSOLE_COMMANDS = {
    help: {
        summary: 'List the commands you can run',
        group: 'The console',
        run: (args, ctx) => {
            const names = Object.keys(CONSOLE_COMMANDS).sort();
            // One width across every group, so the descriptions stay in a
            // single column instead of stepping in and out per heading.
            const width = Math.max(...names.map(name => name.length)) + 2;

            const byGroup = new Map();
            names.forEach(name => {
                const group = CONSOLE_COMMANDS[name].group || 'Everything else';
                if (!byGroup.has(group)) byGroup.set(group, []);
                byGroup.get(group).push(name);
            });

            const ordered = [
                ...CONSOLE_GROUP_ORDER.filter(group => byGroup.has(group)),
                ...[...byGroup.keys()].filter(group => !CONSOLE_GROUP_ORDER.includes(group)).sort(),
            ];

            ordered.forEach((group, index) => {
                if (index) ctx.print('');
                ctx.print(group, 'heading');
                byGroup.get(group).forEach(name =>
                    ctx.print(`  ${name.padEnd(width)}${CONSOLE_COMMANDS[name].summary}`));
            });
        },
    },
    clear: {
        summary: 'Empty the console',
        group: 'The console',
        run: (args, ctx) => ctx.clear(),
    },

    google: searchCommand('Search Google', q => `https://www.google.com/search?q=${q}`),
    yt: searchCommand('Search YouTube', q => `https://www.youtube.com/results?search_query=${q}`),
    wiki: searchCommand('Search Wikipedia', q => `https://en.wikipedia.org/w/index.php?search=${q}`),
    reddit: searchCommand('Search Reddit', q => `https://www.reddit.com/search/?q=${q}`),
    insta: searchCommand('Search Instagram', q => `https://www.instagram.com/explore/search/keyword/?q=${q}`),
    maps: searchCommand('Find a place on Google Maps', q => `https://www.google.com/maps/search/?api=1&query=${q}`),

    lh: {
        summary: 'Open localhost — port 8080 unless you name another',
        group: 'Open a page',
        run(args) {
            const port = args[0] === undefined ? '8080' : args[0];
            if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
                throw new Error(`"${port}" is not a port number.`);
            }
            openFromConsole(`http://localhost:${port}`);
        },
    },

    gh: {
        summary: 'GitHub — repos | -r <repo> | -s <person> | user <name>',
        group: 'Open a page',
        complete: ['repos', '-r', '-s', 'user'],
        run(args) {
            const [sub, ...rest] = args;
            const name = rest.join(' ').trim();

            if (sub === 'user') {
                if (!name) return `GitHub username is ${localStorage.getItem(GITHUB_USER_KEY) || 'not set'}.`;
                if (!validGithubName(name)) throw new Error(`"${name}" is not a GitHub username.`);
                localStorage.setItem(GITHUB_USER_KEY, name);
                return `GitHub username set to ${name}.`;
            }

            if (sub === '-s') {
                if (!name) throw new Error('gh -s needs a username.');
                if (!validGithubName(name)) throw new Error(`"${name}" is not a GitHub username.`);
                return openFromConsole(`https://github.com/${name}`);
            }

            if (sub === 'repos') {
                return openFromConsole(`https://github.com/${requireGithubUser()}?tab=repositories`);
            }

            if (sub === '-r') {
                if (!name) throw new Error('gh -r needs a repository name.');
                return openFromConsole(
                    `https://github.com/${requireGithubUser()}/${encodeURIComponent(name)}`);
            }

            throw new Error(`gh: "${sub || ''}" is not one of repos, -r, -s, user.`);
        },
    },

    gmail: {
        summary: 'Gmail inbox, or "gmail to <address>" to start a message',
        group: 'Open a page',
        complete: ['to'],
        run(args) {
            if (!args.length) return openFromConsole('https://mail.google.com/mail/u/0/#inbox');

            const [sub, address] = args;
            if (sub !== 'to') throw new Error('Use: gmail, or gmail to <address>');
            if (!address) throw new Error('gmail to needs an address.');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
                throw new Error(`"${address}" does not look like an email address.`);
            }
            openFromConsole(
                `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${encodeURIComponent(address)}`);
        },
    },

    history: {
        summary: "Open Chrome's history page",
        group: 'Open a page',
        run: () => openChromePage('chrome://history'),
    },

    bookmarks: {
        summary: "Open Chrome's bookmark manager",
        group: 'Open a page',
        run: () => openChromePage('chrome://bookmarks'),
    },

    calc: {
        summary: 'Work out a sum, e.g. calc 25*40',
        group: 'Work things out',
        run(args) {
            const expression = args.join(' ');
            if (!expression.trim()) throw new Error('Give me something to work out.');
            return String(evaluateExpression(expression));
        },
    },

    timestamp: {
        summary: 'Print this exact moment, several ways',
        group: 'Work things out',
        run() {
            const now = new Date();
            return [
                `unix      ${Math.floor(now.getTime() / 1000)}`,
                `unix ms   ${now.getTime()}`,
                `iso       ${now.toISOString()}`,
                `local     ${now.toString()}`,
            ];
        },
    },

    show: {
        summary: 'Turn a widget on, e.g. show clock',
        group: 'This page',
        complete: () => [...widgetToggles().keys()].sort(),
        run: args => setWidgetVisible(args.join(' '), true),
    },

    hide: {
        summary: 'Turn a widget off, e.g. hide clock',
        group: 'This page',
        complete: () => [...widgetToggles().keys()].sort(),
        run: args => setWidgetVisible(args.join(' '), false),
    },

    clock: {
        summary: 'Clock faces — clock list, or clock <name>',
        group: 'This page',
        complete: () => clockStyleOptions().map(option => option.label),
        run(args) {
            const query = args.join(' ').trim();
            const current = localStorage.getItem('clock-style') || 'clock-v1';

            if (!query || query.toLowerCase() === 'list') {
                const options = clockStyleOptions();
                const width = Math.max(...options.map(option => option.label.length)) + 2;
                return options.map(option =>
                    `${option.id === current ? '*' : ' '} ${option.label.padEnd(width)}${option.id}`);
            }

            const style = findClockStyle(query);
            if (!style) throw new Error(`No clock face called "${query}". Run clock list.`);
            if (style.id === current) return `Clock is already ${style.label}.`;

            // The picker's own click handler saves the choice and swaps the
            // face; going through it keeps settings and the page in step.
            style.el.click();
            return `Clock set to ${style.label}.`;
        },
    },

    shortcut: {
        summary: 'Shortcuts — list | add <url> | rm <url or number>',
        group: 'This page',
        complete: ['list', 'add', 'rm'],
        async run(args) {
            const [sub, ...rest] = args;
            const query = rest.join(' ').trim();

            if (!sub || sub === 'list') {
                const shortcuts = await readShortcuts();
                if (!shortcuts.length) return 'No shortcuts yet — shortcut add <url> makes one.';
                const width = String(shortcuts.length).length;
                return shortcuts.map((url, index) => `${String(index + 1).padStart(width)}  ${url}`);
            }

            if (sub === 'add') {
                if (!query) throw new Error('shortcut add needs a url.');
                requireShortcutStorage();
                const { url, added } = await addShortcut(query);
                return added ? `Added ${url}.` : `${url} is already there.`;
            }

            if (sub === 'rm') {
                if (!query) throw new Error('shortcut rm needs a url or a number from shortcut list.');
                const url = pickShortcut(await readShortcuts(), query);
                await removeShortcut(url);
                return `Removed ${url}.`;
            }

            throw new Error(`shortcut: "${sub}" is not one of list, add, rm.`);
        },
    },

    bg: {
        summary: 'Backgrounds — list | set <name or id> | upload',
        group: 'This page',
        complete: ['list', 'set', 'upload'],
        async run(args) {
            const [sub, ...rest] = args;
            const query = rest.join(' ');

            if (sub === 'upload') {
                // Straight away, not after an await: a file picker spends the
                // same user activation window.open does, and awaiting first
                // would leave nothing to spend.
                videoInput.click();
                return 'Pick a video to use as the background.';
            }

            // The note says "bg lists"; both read naturally, so take either.
            if (sub === 'list' || sub === 'lists') {
                const [videos, selectedId] = await Promise.all([loadAllVideos(), getSelectedVideoId()]);
                if (!videos.length) return 'No backgrounds stored yet — bg upload adds one.';

                const width = Math.max(...videos.map(video => (video.name || '').length)) + 2;
                return videos.map(video =>
                    `${video.id === selectedId ? '*' : ' '} ${(video.name || '').padEnd(width)}${video.type.padEnd(9)}${video.id}`);
            }

            if (sub === 'set') {
                if (!query.trim()) throw new Error('bg set needs a name or id.');
                const video = pickBackground(await loadAllVideos(), query);
                await selectVideo(video);
                return `Background set to ${video.name}.`;
            }

            throw new Error(`bg: "${sub || ''}" is not one of list, set, upload.`);
        },
    },

    crypto: {
        summary: 'Look up a coin, e.g. crypto btc',
        group: 'Work things out',
        async run(args, ctx) {
            const query = args.join(' ').trim();
            if (!query) throw new Error('Name a coin, e.g. crypto btc');

            // Two round trips over a slow connection is long enough that the
            // panel would otherwise look like it had ignored the command.
            ctx.print(`Looking up ${query}…`, 'note');

            const found = await coinGecko(`/search?query=${encodeURIComponent(query)}`);
            const match = pickCoinMatch(found.coins || [], query);
            if (!match) throw new Error(`Nothing on CoinGecko matches "${query}".`);

            const markets = await coinGecko(
                `/coins/markets?vs_currency=usd&ids=${encodeURIComponent(match.id)}`);
            const coin = markets[0];
            if (!coin) throw new Error(`CoinGecko has no market data for ${match.name}.`);

            const rows = [
                ['price', formatUsd(coin.current_price)],
                ['24h', `${formatPercent(coin.price_change_percentage_24h)}  (${formatUsd(coin.price_change_24h)})`],
                ['24h range', `${formatUsd(coin.low_24h)} – ${formatUsd(coin.high_24h)}`],
                ['market cap', `${formatCompactUsd(coin.market_cap)}${coin.market_cap_rank ? `  (rank ${coin.market_cap_rank})` : ''}`],
                ['volume 24h', formatCompactUsd(coin.total_volume)],
                ['all-time high', `${formatUsd(coin.ath)}  (${formatPercent(coin.ath_change_percentage)})`],
            ];
            const width = Math.max(...rows.map(([label]) => label.length)) + 2;

            return [
                `${coin.name} (${(coin.symbol || '').toUpperCase()})`,
                ...rows.map(([label, value]) => `${label.padEnd(width)}${value}`),
            ];
        },
    },

    hi: {
        summary: 'Say hello, and hear what this thing does',
        group: 'The console',
        run: () => [
            'Hello.',
            '',
            'This is a console for your new tab page. Type a command, press',
            'Enter, and it either prints something here or takes you somewhere.',
            'Ctrl+S opens this panel from anywhere on the page, ArrowUp walks',
            'back through what you have already typed, clear empties the',
            'screen, and Escape closes the panel.',
            '',
            'help lists everything it knows.',
        ],
    },
};

// Aliases share the entry, so they cannot drift apart.
CONSOLE_COMMANDS.hello = CONSOLE_COMMANDS.hi;

const consoleBtn = document.getElementById('console-btn');
const consoleOverlay = document.getElementById('console-overlay');
const consoleOutput = document.getElementById('console-output');
const consoleInput = document.getElementById('console-input');

const CONSOLE_PROMPT = '❯';

// ---------------------------
// Output
// ---------------------------
function printConsoleLine(text, kind = 'output') {
    const line = document.createElement('div');
    line.className = `console-line ${kind}`;

    if (kind === 'command') {
        const prompt = document.createElement('span');
        prompt.className = 'prompt';
        prompt.textContent = `${CONSOLE_PROMPT} `;
        line.append(prompt, document.createTextNode(text));
    } else {
        line.textContent = text;
    }

    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function clearConsole() {
    consoleOutput.replaceChildren();
}

const consoleContext = { print: printConsoleLine, clear: clearConsole };

// ---------------------------
// Running a line
// ---------------------------
async function runConsoleLine(raw) {
    const line = raw.trim();
    if (!line) return;

    printConsoleLine(line, 'command');
    rememberConsoleLine(line);

    const [name, ...args] = line.split(/\s+/);
    const command = CONSOLE_COMMANDS[name.toLowerCase()];

    if (!command) {
        printConsoleLine(`${name}: unknown command. Type help for the list.`, 'error');
        return;
    }

    try {
        const result = await command.run(args, consoleContext);
        if (result === undefined || result === null) return;
        [].concat(result).forEach(entry => printConsoleLine(String(entry)));
    } catch (err) {
        // A command that throws should report itself, not take the console
        // down with it and leave the input dead.
        printConsoleLine(err && err.message ? err.message : String(err), 'error');
    }
}

// ---------------------------
// History
// ---------------------------
const consoleHistory = [];
// Sits one past the newest entry, meaning "the line being typed".
let consoleHistoryIndex = 0;

function rememberConsoleLine(line) {
    if (consoleHistory[consoleHistory.length - 1] !== line) consoleHistory.push(line);
    consoleHistoryIndex = consoleHistory.length;
}

function recallConsoleLine(step) {
    const next = consoleHistoryIndex + step;
    if (next < 0 || next > consoleHistory.length) return;

    consoleHistoryIndex = next;
    consoleInput.value = next === consoleHistory.length ? '' : consoleHistory[next];
    // Arrow keys in a text field would otherwise drop the caret at the start.
    requestAnimationFrame(() => consoleInput.setSelectionRange(
        consoleInput.value.length, consoleInput.value.length));
}

// ---------------------------
// Tab completion
// ---------------------------
// A command declares `complete` as an array of words or a function returning
// one, and it applies to the word after the command name. Deeper positions
// are left alone: the things worth completing there — background names, coin
// ids — come from IndexedDB or the network, and a completion that has to wait
// is worse than none.
function completionFor(value) {
    const trailingSpace = /\s$/.test(value);
    const words = value.trim() ? value.trim().split(/\s+/) : [];

    // Still typing the command name.
    if (words.length === 0 || (words.length === 1 && !trailingSpace)) {
        const prefix = words[0] || '';
        return {
            prefix,
            options: Object.keys(CONSOLE_COMMANDS)
                .filter(name => name.startsWith(prefix.toLowerCase()))
                .sort(),
        };
    }

    const command = CONSOLE_COMMANDS[words[0].toLowerCase()];
    if (!command || !command.complete) return { prefix: '', options: [] };
    // Only the argument straight after the command name.
    if (words.length > 2 || (words.length === 2 && trailingSpace)) return { prefix: '', options: [] };

    const all = typeof command.complete === 'function' ? command.complete() : command.complete;
    const prefix = trailingSpace ? '' : words[1];
    return {
        prefix,
        options: all.filter(option => option.toLowerCase().startsWith(prefix.toLowerCase())).sort(),
    };
}

function longestCommonPrefix(options) {
    let prefix = options[0] || '';
    options.forEach(option => {
        while (prefix && !option.toLowerCase().startsWith(prefix.toLowerCase())) {
            prefix = prefix.slice(0, -1);
        }
    });
    return prefix;
}

function completeConsoleInput() {
    const value = consoleInput.value;
    const { prefix, options } = completionFor(value);
    if (!options.length) return;

    // One match finishes the word and moves on; several fill in as far as
    // they agree, the way a shell does.
    const completion = options.length === 1 ? `${options[0]} ` : longestCommonPrefix(options);

    if (completion.length > prefix.length) {
        consoleInput.value = value.slice(0, value.length - prefix.length) + completion;
    } else if (options.length > 1) {
        // Nothing left to fill in, so show what is still on the table.
        printConsoleLine(options.join('  '), 'note');
    }
}

consoleInput.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
        // Otherwise Tab leaves the input for the next focusable thing.
        e.preventDefault();
        completeConsoleInput();
    } else if (e.key === 'Enter') {
        const line = consoleInput.value;
        consoleInput.value = '';
        runConsoleLine(line);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        recallConsoleLine(-1);
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        recallConsoleLine(1);
    }
});

// ---------------------------
// Open/close
// ---------------------------
// The tooltip is a ::after, which a screen reader may not announce, so the
// shortcut goes in the label too.
makeActivatable(consoleBtn, 'button', 'Console (Ctrl+S)');
consoleBtn.setAttribute('aria-expanded', 'false');

function openConsole() {
    consoleOverlay.classList.remove('hidden');
    consoleOverlay.classList.add('show');
    // Takes the page off the screen for as long as the console is up.
    document.body.classList.add('console-open');
    consoleBtn.setAttribute('aria-expanded', 'true');
    // The screen fades in; focusing before it lands is harmless and means the
    // first keystroke is never lost.
    consoleInput.focus();
}

function closeConsole({ restoreFocus = false } = {}) {
    if (!consoleOverlay.classList.contains('show')) return;
    consoleOverlay.classList.remove('show');
    document.body.classList.remove('console-open');
    consoleBtn.setAttribute('aria-expanded', 'false');
    setTimeout(() => consoleOverlay.classList.add('hidden'), 250);

    if (restoreFocus) {
        // Dropping console-open snaps #foreground back to visible rather than
        // transitioning it (see the note in console.css), but the class change
        // is not in the computed style until something asks for layout. Skip
        // this and focus() finds a still-hidden button, fails silently, and
        // leaves focus on <body> for the next Tab to start over from.
        void consoleBtn.offsetWidth;
        consoleBtn.focus();
    }
}

consoleBtn.addEventListener('click', () => {
    if (consoleOverlay.classList.contains('show')) closeConsole();
    else openConsole();
});

consoleOverlay.addEventListener('click', e => {
    if (e.target === consoleOverlay) closeConsole();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeConsole({ restoreFocus: true });
});

// Ctrl+S (Cmd+S on a Mac) opens the console from anywhere on the page,
// including from inside the search bar. Chrome lets a page take this one, so
// preventDefault stops the Save Page dialog appearing behind the panel — and
// there is nothing on a new tab page worth saving anyway.
document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    if (e.key.toLowerCase() !== 's') return;

    e.preventDefault();

    // Both sidebars are fixed overlays at the same depth, so leaving settings
    // open would stack two sheets of translucent glass on top of each other.
    if (typeof closeSettings === 'function') closeSettings();

    // Already open: put the caret back in the input rather than doing nothing.
    openConsole();
});

// Clicking anywhere in the panel puts the caret back in the input, the way a
// terminal window behaves — but not when text is being selected for copying.
consoleOverlay.addEventListener('mouseup', e => {
    if (!e.target.closest('#console-screen')) return;
    if (e.target === consoleInput) return;
    if (!window.getSelection().isCollapsed) return;
    consoleInput.focus();
});

printConsoleLine('Type help for the list of commands.', 'note');
