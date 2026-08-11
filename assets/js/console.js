// The console sidebar: type a command, get output.
//
// Everything below the registry is plumbing that does not care what the
// commands are. To add one, put an entry in CONSOLE_COMMANDS — nothing else
// needs touching.

// ---------------------------
// What the commands are built from
// ---------------------------

// Where a command that "opens" something sends you. Same tab, matching the
// search bar: a new tab page is a place you pass through, and opening in a
// new tab would leave an orphaned new tab behind on every command. Every
// command goes through here, so switching to window.open is a one-line
// change if that turns out to be the wrong call.
function openFromConsole(url) {
    window.location.href = url;
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
}

// Most of the list is one command with a different URL each time: take the
// rest of the line, encode it, open a search page. Writing that out six times
// invites six subtly different escaping bugs.
function searchCommand(summary, buildUrl) {
    return {
        summary,
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
const CONSOLE_COMMANDS = {
    help: {
        summary: 'List the commands you can run',
        run: () => {
            const names = Object.keys(CONSOLE_COMMANDS).sort();
            const width = Math.max(...names.map(name => name.length));
            return names.map(name => `${name.padEnd(width + 2)}${CONSOLE_COMMANDS[name].summary}`);
        },
    },
    clear: {
        summary: 'Empty the console',
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
        run: () => openChromePage('chrome://history'),
    },

    bookmarks: {
        summary: "Open Chrome's bookmark manager",
        run: () => openChromePage('chrome://bookmarks'),
    },

    calc: {
        summary: 'Work out a sum, e.g. calc 25*40',
        run(args) {
            const expression = args.join(' ');
            if (!expression.trim()) throw new Error('Give me something to work out.');
            return String(evaluateExpression(expression));
        },
    },

    timestamp: {
        summary: 'Print this exact moment, several ways',
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

    hi: {
        summary: 'Say hello, and hear what this thing does',
        run: () => [
            'Hello.',
            '',
            'This is a console for your new tab page. Type a command, press',
            'Enter, and it either prints something here or takes you somewhere.',
            'ArrowUp walks back through what you have already typed, clear',
            'empties the screen, and Escape closes the panel.',
            '',
            'help lists everything it knows.',
        ],
    },
};

// Aliases share the entry, so they cannot drift apart.
CONSOLE_COMMANDS.hello = CONSOLE_COMMANDS.hi;

const consoleBtn = document.getElementById('console-btn');
const consoleOverlay = document.getElementById('console-sidebar-overlay');
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

consoleInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
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
makeActivatable(consoleBtn, 'button', 'Console');
consoleBtn.setAttribute('aria-expanded', 'false');

function openConsole() {
    consoleOverlay.classList.remove('hidden');
    consoleOverlay.classList.add('show');
    consoleBtn.setAttribute('aria-expanded', 'true');
    // The panel slides in; focusing before it lands is harmless and means the
    // first keystroke is never lost.
    consoleInput.focus();
}

function closeConsole({ restoreFocus = false } = {}) {
    if (!consoleOverlay.classList.contains('show')) return;
    consoleOverlay.classList.remove('show');
    consoleBtn.setAttribute('aria-expanded', 'false');
    setTimeout(() => consoleOverlay.classList.add('hidden'), 250);
    if (restoreFocus) consoleBtn.focus();
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

// Clicking anywhere in the panel puts the caret back in the input, the way a
// terminal window behaves — but not when text is being selected for copying.
consoleOverlay.addEventListener('mouseup', e => {
    if (!e.target.closest('#console-sidebar')) return;
    if (e.target === consoleInput) return;
    if (!window.getSelection().isCollapsed) return;
    consoleInput.focus();
});

printConsoleLine('Type help for the list of commands.', 'note');
