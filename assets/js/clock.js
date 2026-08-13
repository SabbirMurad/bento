// getDay() returns 0 for Sunday, so these start on Sunday.
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const analogHourHand = document.querySelector("#analog-clock-wrapper #hour");
const analogMinuteHand = document.querySelector("#analog-clock-wrapper #minute");
const analogSecondHand = document.querySelector("#analog-clock-wrapper #second");

const glowClockDate = document.querySelector("#digital-clock-v2-wrapper #glow-clock .date");
const glowClockTime = document.querySelector("#digital-clock-v2-wrapper #glow-clock .time");

const stackClock = document.getElementById('stack-clock-wrapper');
const stackHours = stackClock.querySelector('.stack-hours');
const stackMinutes = stackClock.querySelector('.stack-minutes');
const stackMeridiem = stackClock.querySelector('.stack-meridiem');
const stackDate = stackClock.querySelector('.stack-date');
const stackProgress = stackClock.querySelector('.stack-progress span');

const flipClock = document.getElementById('flip-clock-wrapper');
const flipMeridiem = flipClock.querySelector('.flip-meridiem');

const wordClock = document.querySelector('#word-clock-wrapper .word-clock');

const ringClock = document.getElementById('ring-clock-wrapper');
const ringTime = ringClock.querySelector('.ring-time');
const ringDate = ringClock.querySelector('.ring-date');
const ringSeconds = ringClock.querySelector('.ring-seconds');
const ringMinutes = ringClock.querySelector('.ring-minutes');
const ringHours = ringClock.querySelector('.ring-hours');

function pad(value) {
    return String(value).padStart(2, '0');
}

function timeParts(now) {
    const hours = now.getHours();
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;

    return {
        hours24: pad(hours),
        hour12: pad(hour12),
        minutes: pad(now.getMinutes()),
        seconds: pad(now.getSeconds()),
        meridiem: hours < 12 ? 'AM' : 'PM',
    };
}

function shortDate(now) {
    return `${daysShort[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
}

// ---------------------------
// v1 — glass card
// ---------------------------
const glassClockTime = document.getElementById('clock');
const glassClockDate = document.getElementById('date');

function renderGlassClock(now, parts) {
    glassClockTime.textContent = `${parts.hour12}:${parts.minutes} ${parts.meridiem}`;
    glassClockDate.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

// ---------------------------
// v2 — analog
// ---------------------------
function renderAnalogClock(now) {
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const hours = now.getHours();

    analogSecondHand.style.transform = `rotate(${seconds * 6}deg)`;
    analogMinuteHand.style.transform = `rotate(${minutes * 6 + seconds * 0.1}deg)`;
    analogHourHand.style.transform = `rotate(${(hours % 12) * 30 + minutes * 0.5}deg)`;
}

// ---------------------------
// v3 — glow
// ---------------------------
function renderGlowClock(now, parts) {
    glowClockDate.textContent = `${pad(now.getDate())} - ${pad(now.getMonth() + 1)} - ${now.getFullYear()} | ${daysShort[now.getDay()]}`;
    glowClockTime.textContent = `${parts.hour12} : ${parts.minutes} : ${parts.seconds} ${parts.meridiem}`;
}

// ---------------------------
// v4 — stacked
// ---------------------------
function renderStackClock(now, parts) {
    stackHours.textContent = parts.hour12;
    stackMinutes.textContent = parts.minutes;
    stackMeridiem.textContent = parts.meridiem;
    stackDate.textContent = shortDate(now);

    const seconds = now.getSeconds();

    // At the top of the minute the bar has to return to empty. Animating
    // that would drag the fill backwards across the whole width, so the
    // reset is cut instead.
    stackProgress.style.transition = seconds === 0 ? 'none' : '';
    stackProgress.style.width = `${(seconds / 59) * 100}%`;
}

// ---------------------------
// v5 — flip
// ---------------------------
const FLIP_PANELS = [
    ['top', 'flip-panel is-top'],
    ['bottom', 'flip-panel is-bottom'],
    ['front', 'flip-panel is-top leaf leaf-front'],
    ['back', 'flip-panel is-bottom leaf leaf-back'],
];

function buildFlipDigit() {
    const digit = document.createElement('div');
    digit.className = 'flip-digit';

    const parts = {};
    FLIP_PANELS.forEach(([name, className]) => {
        const panel = document.createElement('div');
        panel.className = className;
        const span = document.createElement('span');
        panel.appendChild(span);
        digit.appendChild(panel);
        parts[name] = span;
    });
    digit.parts = parts;

    // The lower static half only catches up once the falling leaf has
    // landed on it, otherwise the new digit shows through mid-flip.
    digit.addEventListener('animationend', e => {
        if (e.animationName !== 'flip-land') return;
        parts.bottom.textContent = digit.dataset.value;
        digit.classList.remove('flipping');
    });

    return digit;
}

const flipDigits = {};

flipClock.querySelectorAll('.flip-group').forEach(group => {
    const pair = [buildFlipDigit(), buildFlipDigit()];
    pair.forEach(digit => group.appendChild(digit));
    flipDigits[group.dataset.unit] = pair;
});

function setFlipDigit(digit, value, animate) {
    if (digit.dataset.value === value) return;

    const previous = digit.dataset.value;
    digit.dataset.value = value;
    digit.parts.top.textContent = value;
    digit.parts.back.textContent = value;

    // Values are kept current even while this face is hidden, so switching
    // to it shows the real time rather than whatever it last flipped to.
    if (!animate || previous === undefined) {
        digit.parts.bottom.textContent = value;
        digit.parts.front.textContent = value;
        digit.classList.remove('flipping');
        return;
    }

    digit.parts.front.textContent = previous;
    digit.classList.remove('flipping');
    void digit.offsetWidth; // restart the animation from the top
    digit.classList.add('flipping');
}

function setFlipPair(unit, value, animate) {
    const pair = flipDigits[unit];
    setFlipDigit(pair[0], value[0], animate);
    setFlipDigit(pair[1], value[1], animate);
}

function renderFlipClock(parts) {
    const animate = flipClock.offsetParent !== null;

    setFlipPair('hours', parts.hour12, animate);
    setFlipPair('minutes', parts.minutes, animate);
    setFlipPair('seconds', parts.seconds, animate);
    flipMeridiem.textContent = parts.meridiem;
}

// ---------------------------
// v6 — words
// ---------------------------
const WORD_CLOCK_COLUMNS = 11;

const WORD_CLOCK_ROWS = [
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

// Each entry is [row, column, length] into the grid above. There are two
// FIVEs and two TENs because the minute and the hour can both be either.
const W = {
    IT: [0, 0, 2],
    IS: [0, 3, 2],
    AM: [0, 7, 2],
    PM: [0, 9, 2],
    QUARTER: [1, 2, 7],
    TWENTY: [2, 0, 6],
    FIVE_MIN: [2, 6, 4],
    HALF: [3, 0, 4],
    TEN_MIN: [3, 5, 3],
    TO: [3, 9, 2],
    PAST: [4, 0, 4],
    OCLOCK: [9, 5, 6],
};

const WORD_HOURS = [
    null,
    [5, 0, 3],  // ONE
    [6, 8, 3],  // TWO
    [5, 6, 5],  // THREE
    [6, 0, 4],  // FOUR
    [6, 4, 4],  // FIVE
    [5, 3, 3],  // SIX
    [8, 0, 5],  // SEVEN
    [7, 0, 5],  // EIGHT
    [4, 7, 4],  // NINE
    [9, 0, 3],  // TEN
    [7, 5, 6],  // ELEVEN
    [8, 5, 6],  // TWELVE
];

// Keyed by the five-minute bucket. `next` means the phrase reads towards
// the coming hour — "twenty to nine" is said at 8:40.
const WORD_MINUTES = {
    0: { words: [W.OCLOCK], next: false },
    5: { words: [W.FIVE_MIN, W.PAST], next: false },
    10: { words: [W.TEN_MIN, W.PAST], next: false },
    15: { words: [W.QUARTER, W.PAST], next: false },
    20: { words: [W.TWENTY, W.PAST], next: false },
    25: { words: [W.TWENTY, W.FIVE_MIN, W.PAST], next: false },
    30: { words: [W.HALF, W.PAST], next: false },
    35: { words: [W.TWENTY, W.FIVE_MIN, W.TO], next: true },
    40: { words: [W.TWENTY, W.TO], next: true },
    45: { words: [W.QUARTER, W.TO], next: true },
    50: { words: [W.TEN_MIN, W.TO], next: true },
    55: { words: [W.FIVE_MIN, W.TO], next: true },
};

const wordCells = [];

WORD_CLOCK_ROWS.forEach(row => {
    row.split('').forEach(letter => {
        const cell = document.createElement('span');
        cell.textContent = letter;
        wordClock.appendChild(cell);
        wordCells.push(cell);
    });
});

let litPhrase = '';

function renderWordClock(now) {
    const hours = now.getHours();
    const bucket = Math.floor(now.getMinutes() / 5) * 5;
    const phrase = WORD_MINUTES[bucket];

    let hour = (hours + (phrase.next ? 1 : 0)) % 12;
    if (hour === 0) hour = 12;

    const meridiem = hours < 12 ? 'AM' : 'PM';
    const key = `${bucket}|${hour}|${meridiem}`;
    if (key === litPhrase) return;
    litPhrase = key;

    const lit = new Set();
    const spans = [W.IT, W.IS, ...phrase.words, WORD_HOURS[hour], meridiem === 'AM' ? W.AM : W.PM];

    spans.forEach(([row, column, length]) => {
        for (let i = 0; i < length; i++) {
            lit.add(row * WORD_CLOCK_COLUMNS + column + i);
        }
    });

    wordCells.forEach((cell, index) => cell.classList.toggle('lit', lit.has(index)));
}

// ---------------------------
// v7 — rings
// ---------------------------
function setArc(arc, fraction, wrapping) {
    // Wrapping from full back to empty would sweep the arc backwards the
    // whole way around, so that one step is cut.
    arc.classList.toggle('no-transition', wrapping);
    arc.style.strokeDashoffset = 100 - fraction * 100;
}

function renderRingClock(now, parts) {
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const hours = now.getHours();

    ringTime.textContent = `${parts.hour12}:${parts.minutes}`;
    ringDate.textContent = shortDate(now);

    const atMinute = minutes === 0 && seconds === 0;

    setArc(ringSeconds, seconds / 60, seconds === 0);
    setArc(ringMinutes, (minutes + seconds / 60) / 60, atMinute);
    setArc(ringHours, ((hours % 12) + minutes / 60) / 12, atMinute && hours % 12 === 0);
}

// ---------------------------
// v8 — LCD
// ---------------------------
const LCD_SEGMENTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

// Which of the seven segments each numeral lights.
const LCD_DIGITS = {
    '0': 'abcdef',
    '1': 'bc',
    '2': 'abdeg',
    '3': 'abcdg',
    '4': 'bcfg',
    '5': 'acdfg',
    '6': 'acdefg',
    '7': 'abc',
    '8': 'abcdefg',
    '9': 'abcdfg',
};

const lcdClock = document.getElementById('lcd-clock-wrapper');
const lcdMeridiem = lcdClock.querySelector('.lcd-meridiem');
const lcdDigits = {};

lcdClock.querySelectorAll('.lcd-group').forEach(group => {
    const pair = [0, 1].map(() => {
        const digit = document.createElement('div');
        digit.className = 'lcd-digit';
        digit.segments = {};

        LCD_SEGMENTS.forEach(name => {
            const segment = document.createElement('span');
            segment.className = `seg seg-${name}`;
            digit.appendChild(segment);
            digit.segments[name] = segment;
        });

        group.appendChild(digit);
        return digit;
    });

    lcdDigits[group.dataset.unit] = pair;
});

function setLcdDigit(digit, value) {
    if (digit.dataset.value === value) return;
    digit.dataset.value = value;

    const on = LCD_DIGITS[value] || '';
    LCD_SEGMENTS.forEach(name => {
        digit.segments[name].classList.toggle('on', on.includes(name));
    });
}

function renderLcdClock(parts) {
    ['hours', 'minutes', 'seconds'].forEach(unit => {
        const value = unit === 'hours' ? parts.hour12 : parts[unit];
        setLcdDigit(lcdDigits[unit][0], value[0]);
        setLcdDigit(lcdDigits[unit][1], value[1]);
    });

    lcdMeridiem.textContent = parts.meridiem;
}

// ---------------------------
// v9 — reels
// ---------------------------
const REEL_ITEM_HEIGHT = 56;

// [first value, last value] for each strip. Hours are 12-hour, so the
// strip runs 1..12 rather than 0..11.
const REEL_RANGES = { hours: [1, 12], minutes: [0, 59], seconds: [0, 59] };

const reelStrips = {};

document.querySelectorAll('#reel-clock-wrapper .reel').forEach(reel => {
    const unit = reel.dataset.unit;
    const [first, last] = REEL_RANGES[unit];
    const strip = reel.querySelector('.reel-strip');

    for (let value = first; value <= last; value++) {
        const item = document.createElement('span');
        item.textContent = pad(value);
        strip.appendChild(item);
    }

    reelStrips[unit] = strip;
});

function setReel(unit, value) {
    const strip = reelStrips[unit];
    const index = value - REEL_RANGES[unit][0];
    if (strip.dataset.index === String(index)) return;

    // Rolling over from the last value to the first would otherwise rewind
    // the whole strip in view.
    const wrapping = strip.dataset.index !== undefined && index < Number(strip.dataset.index);
    strip.dataset.index = index;

    strip.classList.toggle('no-transition', wrapping);
    // One item down, so the current value sits in the middle of the window.
    strip.style.transform = `translateY(${REEL_ITEM_HEIGHT - index * REEL_ITEM_HEIGHT}px)`;
}

function renderReelClock(now) {
    const hours = now.getHours() % 12 === 0 ? 12 : now.getHours() % 12;

    setReel('hours', hours);
    setReel('minutes', now.getMinutes());
    setReel('seconds', now.getSeconds());
}

// ---------------------------
// v10 — day arc
// ---------------------------
const SUNRISE_HOUR = 6;
const SUNSET_HOUR = 18;

const arcClock = document.getElementById('arc-clock-wrapper');
const arcMarker = arcClock.querySelector('.arc-marker');
const arcTime = arcClock.querySelector('.arc-time');
const arcDate = arcClock.querySelector('.arc-date');

function renderArcClock(now, parts) {
    arcTime.textContent = `${parts.hour12}:${parts.minutes}`;
    arcDate.textContent = shortDate(now).toUpperCase();

    const hourOfDay = now.getHours() + now.getMinutes() / 60;
    const daytime = hourOfDay >= SUNRISE_HOUR && hourOfDay < SUNSET_HOUR;

    // At sunrise and sunset the marker jumps from one end of a track to the
    // other end of the other one, which would otherwise animate backwards
    // across the whole width.
    const crossing = arcMarker.dataset.daytime !== undefined
        && arcMarker.dataset.daytime !== String(daytime);
    arcMarker.dataset.daytime = daytime;
    arcMarker.classList.toggle('no-transition', crossing);

    if (daytime) {
        const progress = (hourOfDay - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR);
        // Along the ellipse the dashed day path traces.
        arcMarker.setAttribute('cx', 170 - 130 * Math.cos(Math.PI * progress));
        arcMarker.setAttribute('cy', 150 - 95 * Math.sin(Math.PI * progress));
    } else {
        // Night runs sunset to sunrise across midnight, along the flat
        // track below the horizon.
        const elapsed = (hourOfDay - SUNSET_HOUR + 24) % 24;
        const progress = elapsed / (24 - SUNSET_HOUR + SUNRISE_HOUR);
        arcMarker.setAttribute('cx', 40 + 260 * progress);
        arcMarker.setAttribute('cy', 178);
    }

    arcMarker.classList.toggle('night', !daytime);
}

// ---------------------------
// v11 — outline
// ---------------------------
const outlineClock = document.getElementById('outline-clock-wrapper');
const outlineTime = outlineClock.querySelector('.outline-time');
const outlineSeconds = outlineClock.querySelector('.outline-seconds');
const outlineMeridiem = outlineClock.querySelector('.outline-meridiem');
const outlineDate = outlineClock.querySelector('.outline-date');

function renderOutlineClock(now, parts) {
    outlineTime.textContent = `${parts.hour12}:${parts.minutes}`;
    outlineSeconds.textContent = parts.seconds;
    outlineMeridiem.textContent = parts.meridiem;
    outlineDate.textContent = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
}

// ---------------------------
// Tick
// ---------------------------

// Only the face on screen is drawn. All eleven used to be redrawn every
// second — the LCD rewriting 42 segment classes, the reels recomputing
// transforms, the word clock diffing its grid — for ten faces nobody could
// see, on a page that is open in every new tab.
const CLOCK_FACES = {
    'clock-v1': (now, parts) => renderGlassClock(now, parts),
    'clock-v2': now => renderAnalogClock(now),
    'clock-v3': (now, parts) => renderGlowClock(now, parts),
    'clock-v4': (now, parts) => renderStackClock(now, parts),
    'clock-v5': (now, parts) => renderFlipClock(parts),
    'clock-v6': now => renderWordClock(now),
    'clock-v7': (now, parts) => renderRingClock(now, parts),
    'clock-v8': (now, parts) => renderLcdClock(parts),
    'clock-v9': now => renderReelClock(now),
    'clock-v10': (now, parts) => renderArcClock(now, parts),
    'clock-v11': (now, parts) => renderOutlineClock(now, parts),
};

let activeClockFace = localStorage.getItem('clock-style') || DEFAULT_CLOCK_STYLE;

// Called by applyClockStyle in settings.js. Draws straight away, or the face
// you just picked would show whatever it last held for up to a second.
function setActiveClockFace(name) {
    if (!CLOCK_FACES[name]) return;
    activeClockFace = name;
    updateClock();
}

function updateClock() {
    const render = CLOCK_FACES[activeClockFace];
    if (!render) return;

    const now = new Date();
    render(now, timeParts(now));
}

// setInterval drifts, which the seconds-driven faces show as a stutter or a
// skipped tick. Re-aiming at the next whole second each time keeps them on
// the clock rather than on the timer.
function scheduleTick() {
    setTimeout(() => {
        updateClock();
        scheduleTick();
    }, 1000 - (Date.now() % 1000));
}

updateClock();
scheduleTick();
