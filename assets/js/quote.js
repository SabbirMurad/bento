// The quote widget: a line of your own text on the page.
//
// The colour is not handled here. Putting item-name="quote" on the settings
// pane and an input[type=color] inside it is enough for the shared picker in
// settings.js to drive --quote-text-color, the same way it does for the clock
// and the bookmarks. Only the text, the size and the weight are ours.

const QUOTE_TEXT_KEY = 'quote-text';
const QUOTE_SIZE_KEY = 'quote-font-size';
const QUOTE_WEIGHT_KEY = 'quote-font-weight';
const QUOTE_MAX_WIDTH_KEY = 'quote-max-width';
const QUOTE_LETTER_SPACING_KEY = 'quote-letter-spacing';
const QUOTE_FONT_KEY = 'quote-font-family';

const quoteWrapper = document.getElementById('quote-wrapper');
const quoteTextEl = document.getElementById('quote-text');
const quoteInput = document.getElementById('quote-input');
const quoteSizeSlider = document.getElementById('quote-size-slider');
const quoteWeightSlider = document.getElementById('quote-weight-slider');
const quoteMaxWidthSlider = document.getElementById('quote-max-width-slider');
const quoteLetterSpacingSlider = document.getElementById('quote-letter-spacing-slider');
const quoteFontSelect = document.getElementById('quote-font-select');

// ---------------------------
// Text
// ---------------------------
// What the box starts with before anyone has typed. Only a starting value:
// clearing it stores an empty string, which reads back as empty rather than
// falling through to this again.
const QUOTE_DEFAULT_TEXT = "Dont't try to calm the storm. The storm will pass, calm yourself.";

function readQuoteText() {
    const saved = localStorage.getItem(QUOTE_TEXT_KEY);
    return saved === null ? QUOTE_DEFAULT_TEXT : saved;
}

// Drawing only. The two callers below decide when it is worth saving, which
// is what keeps a keystroke from writing to storage — and, through sync.js,
// to chrome.storage — on every character.
function drawQuote(text) {
    quoteTextEl.textContent = text;
    quoteWrapper.classList.toggle('quote-empty', text.trim() === '');
}

// The console's quote command comes through here, so a typed change and a
// change made in the panel take the same path and cannot disagree.
function setQuoteText(text) {
    const value = text == null ? '' : String(text);
    drawQuote(value);
    if (quoteInput) quoteInput.value = value;
    localStorage.setItem(QUOTE_TEXT_KEY, value);
    return value;
}

drawQuote(readQuoteText());
if (quoteInput) quoteInput.value = readQuoteText();

if (quoteInput) {
    let saveTimer;
    quoteInput.addEventListener('input', () => {
        drawQuote(quoteInput.value);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => localStorage.setItem(QUOTE_TEXT_KEY, quoteInput.value), 400);
    });
}

// ---------------------------
// Size, weight and wrap width
// ---------------------------
// All three are the same shape: a range input, the number beside it, a CSS
// custom property and a storage key.
function quoteRangeControl(slider, key, property, unit) {
    if (!slider) return;

    const label = slider.parentElement.querySelector('.range-slider__value');

    function apply(value) {
        document.body.style.setProperty(property, value + unit);
        if (label) label.textContent = value;
    }

    const saved = localStorage.getItem(key);
    if (saved !== null) slider.value = saved;
    apply(slider.value);

    slider.addEventListener('input', () => apply(slider.value));
    // change rather than input for the write: dragging a slider fires input
    // for every pixel, and only where it comes to rest is worth storing.
    slider.addEventListener('change', () => localStorage.setItem(key, slider.value));
}

quoteRangeControl(quoteSizeSlider, QUOTE_SIZE_KEY, '--quote-font-size', 'px');
quoteRangeControl(quoteWeightSlider, QUOTE_WEIGHT_KEY, '--quote-font-weight', '');
quoteRangeControl(quoteMaxWidthSlider, QUOTE_MAX_WIDTH_KEY, '--quote-max-width', 'px');
quoteRangeControl(quoteLetterSpacingSlider, QUOTE_LETTER_SPACING_KEY, '--quote-letter-spacing', 'px');

// ---------------------------
// Font family
// ---------------------------
// A select rather than a slider, so it saves on change — there is no dragging
// to debounce, and every change is one the user meant.
if (quoteFontSelect) {
    const saved = localStorage.getItem(QUOTE_FONT_KEY);
    if (saved !== null) quoteFontSelect.value = saved;
    // Assigning a value the list no longer offers leaves the select showing
    // nothing at all, so an option that has since been dropped falls back to
    // the first one rather than to a blank row.
    if (!quoteFontSelect.value) quoteFontSelect.selectedIndex = 0;

    document.body.style.setProperty('--quote-font-family', quoteFontSelect.value);

    quoteFontSelect.addEventListener('change', () => {
        document.body.style.setProperty('--quote-font-family', quoteFontSelect.value);
        localStorage.setItem(QUOTE_FONT_KEY, quoteFontSelect.value);
    });
}
