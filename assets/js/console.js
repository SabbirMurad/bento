// The console sidebar: type a command, get output.
//
// Everything below the registry is plumbing that does not care what the
// commands are. To add one, put an entry in CONSOLE_COMMANDS — nothing else
// needs touching.

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
};

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
