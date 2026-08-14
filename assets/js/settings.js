// ---------------------------
// Sidebar open/close
// ---------------------------
const settingsOverlay = document.getElementById('settings-sidebar-overlay');
const settingsBtn = document.querySelector('#settings-btn');

// The settings button, the tabs, the align buttons and the clock style picker
// are divs, list items and images with click handlers: unreachable by keyboard
// and silent to a screen reader. They are styled as table cells and flex
// children, so giving them button semantics here is safer than swapping the
// elements and rebuilding the CSS around them.
function makeActivatable(el, role, label) {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', role);
    if (label) el.setAttribute('aria-label', label);
}

// One delegated handler rather than a listener per control, so the position
// panels and anything else built at runtime are keyboard-operable without
// having to be wired up individually after they are generated.
document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;

    const control = e.target.closest('[role="button"][tabindex], [role="tab"][tabindex]');
    if (!control) return;

    e.preventDefault();
    control.click();
});

makeActivatable(settingsBtn, 'button', 'Settings');
settingsBtn.setAttribute('aria-expanded', 'false');

function openSettings() {
    settingsOverlay.classList.remove('hidden');
    settingsOverlay.classList.add('show');
    settingsBtn.setAttribute('aria-expanded', 'true');
}

settingsBtn.onclick = openSettings;

// Ctrl+S (Cmd+S on a Mac) opens settings from anywhere on the page. Chrome
// lets a page take this one, so preventDefault stops the Save Page dialog
// appearing behind the panel — and there is nothing on a new tab page worth
// saving anyway.
document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    if (e.key.toLowerCase() !== 's') return;

    e.preventDefault();

    // Both panels are fixed overlays at the same depth, so leaving the console
    // open would stack two sheets of translucent glass on top of each other.
    // Guarded because console.js loads after this file.
    if (typeof closeConsole === 'function') closeConsole();

    openSettings();
});

// Every path that closes the panel goes through here, so aria-expanded stays
// truthful and focus returns to the button that opened it instead of being
// dropped on the body.
function closeSettings({ restoreFocus = false } = {}) {
    if (!settingsOverlay.classList.contains('show')) return;
    settingsOverlay.classList.remove('show');
    settingsBtn.setAttribute('aria-expanded', 'false');
    setTimeout(() => settingsOverlay.classList.add('hidden'), 250);
    if (restoreFocus) settingsBtn.focus();
}

settingsOverlay.onclick = e => {
    if (e.target === settingsOverlay) closeSettings();
};

// ---------------------------
// Escape key closes any open sidebar
// ---------------------------
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;

    closeSettings({ restoreFocus: true });

    const shortcutOverlay = document.getElementById('shortcut-sidebar-overlay');
    if (shortcutOverlay.classList.contains('show')) {
        shortcutOverlay.classList.remove('show');
        setTimeout(() => shortcutOverlay.classList.add('hidden'), 250);
    }
});

// ---------------------------
// Text Colors
// ---------------------------
function normalizeHex(val) {
    val = val.trim().replace(/^#/, '');
    if (val.length === 3) val = val[0] + val[0] + val[1] + val[1] + val[2] + val[2];
    return /^[0-9a-fA-F]{6}$/.test(val) ? '#' + val.toLowerCase() : null;
}

let textColorPickers = document.querySelectorAll('#settings-sidebar-overlay .item-wrapper input[type="color"]');

for (let colorPicker of textColorPickers) {
    let itemName = colorPicker.parentElement.parentElement.getAttribute('item-name');
    let hexInput = colorPicker.parentElement.querySelector('.hex-input');

    let savedTextColor = localStorage.getItem(itemName + '-text-color');
    if (savedTextColor) {
        document.querySelector('body').style.setProperty('--' + itemName + '-text-color', savedTextColor);
    }

    // White unless the shipped layout wants otherwise, which the markup says
    // on the picker itself rather than through a table of ids over here.
    const initialColor = savedTextColor || colorPicker.dataset.default || '#ffffff';
    if (!savedTextColor && colorPicker.dataset.default) {
        document.querySelector('body').style.setProperty('--' + itemName + '-text-color', initialColor);
    }
    colorPicker.value = initialColor;
    if (hexInput) hexInput.value = initialColor;

    let textInputTimer;

    function applyColor(hex) {
        document.querySelector('body').style.setProperty('--' + itemName + '-text-color', hex);
        clearTimeout(textInputTimer);
        textInputTimer = setTimeout(() => {
            localStorage.setItem(itemName + '-text-color', hex);
        }, 1000);
    }

    colorPicker.addEventListener('input', () => {
        if (hexInput) hexInput.value = colorPicker.value;
        applyColor(colorPicker.value);
    });

    if (hexInput) {
        hexInput.addEventListener('input', () => {
            const hex = normalizeHex(hexInput.value);
            if (hex) {
                hexInput.classList.remove('invalid');
                colorPicker.value = hex;
                applyColor(hex);
            } else {
                hexInput.classList.add('invalid');
            }
        });

        hexInput.addEventListener('blur', () => {
            const hex = normalizeHex(hexInput.value);
            if (hex) {
                hexInput.value = hex;
                hexInput.classList.remove('invalid');
            } else {
                hexInput.value = colorPicker.value;
                hexInput.classList.remove('invalid');
            }
        });
    }
}

// Every position panel is the same six buttons and four inputs; only the
// widget it drives differs, and that is on the element as content-id. So the
// markup is written once here instead of copied into each settings tab. This
// has to run before the controls below go looking for those pieces.
const POSITION_AXES = [
    {
        values: ['left', 'horizontal-center', 'right'],
        icons: ['align-left', 'align-center-horizontal', 'align-right'],
        labels: ['L', 'R'],
    },
    {
        values: ['top', 'vertical-center', 'bottom'],
        icons: ['align-top', 'align-center-vertical', 'align-bottom'],
        labels: ['T', 'B'],
    },
];

document.querySelectorAll('#settings-sidebar .item.position').forEach(panel => {
    panel.innerHTML = '<p>Position</p>' + POSITION_AXES.map(axis => `
        <div class="position-axis-row">
            <div class="align-btn-group">
                ${axis.values.map((value, i) =>
                    `<div class="icon" data-value="${value}" role="button" tabindex="0" aria-pressed="false" aria-label="Align ${value.replace('-', ' ')}"><img src="/assets/icon/${axis.icons[i]}.svg" alt=""></div>`
                ).join('')}
            </div>
            <div class="pos-inputs">
                <div class="pos-input-field">
                    <label>${axis.labels[0]}</label>
                    <input type="number" side-type="${axis.values[0]}" disabled>
                </div>
                <div class="pos-input-field">
                    <label>${axis.labels[1]}</label>
                    <input type="number" side-type="${axis.values[2]}" disabled>
                </div>
                <span class="px-unit">px</span>
            </div>
        </div>`).join('');
});

// contentId -> { element, place() }. arrange.js drags a widget around the page
// and calls place() so these controls and localStorage end up agreeing with
// wherever it was dropped.
const widgetPositionControls = new Map();

// Walks the position panels themselves rather than one per settings tab. A
// tab that drives two widgets — the Buttons tab does — needs two of these, and
// looking for one inside each tab could only ever find the first.
document.querySelectorAll('#settings-sidebar .item.position').forEach(positionControlWrapper => {
    const positionIcons = positionControlWrapper.querySelectorAll('.icon');
    const leftTextInput = positionControlWrapper.querySelector('input[side-type="left"]');
    const rightTextInput = positionControlWrapper.querySelector('input[side-type="right"]');
    const topTextInput = positionControlWrapper.querySelector('input[side-type="top"]');
    const bottomTextInput = positionControlWrapper.querySelector('input[side-type="bottom"]');

    let inputDelayTimer;

    let contentId = positionControlWrapper.getAttribute('content-id');
    const actualContentWrapper = document.getElementById(contentId);


    function savePosition() {
        let pos = {
            horizontal: actualContentWrapper.classList.contains('horizontal-center') ? 'horizontal-center' : null,
            vertical: actualContentWrapper.classList.contains('vertical-center') ? 'vertical-center' : null,
            left: actualContentWrapper.style.left,
            right: actualContentWrapper.style.right,
            top: actualContentWrapper.style.top,
            bottom: actualContentWrapper.style.bottom,
        };

        if (!pos.horizontal) {
            pos.horizontal = pos.left !== 'unset' && pos.left !== '' ? 'left' : 'right';
        }
        if (!pos.vertical) {
            pos.vertical = pos.top !== 'unset' && pos.top !== '' ? 'top' : 'bottom';
        }

        pos.leftVal = leftTextInput.value;
        pos.rightVal = rightTextInput.value;
        pos.topVal = topTextInput.value;
        pos.bottomVal = bottomTextInput.value;

        localStorage.setItem(contentId + '-position', JSON.stringify(pos));
    }

    function setActiveIcon(value) {
        const icon = positionControlWrapper.querySelector(`.icon[data-value="${value}"]`);
        if (!icon) return;
        const group = icon.closest('.align-btn-group');
        if (group) {
            group.querySelectorAll('.icon').forEach(i => {
                i.classList.remove('active');
                i.setAttribute('aria-pressed', 'false');
            });
            icon.classList.add('active');
            icon.setAttribute('aria-pressed', 'true');
        }
    }

    function loadPosition() {
        let saved = localStorage.getItem(contentId + '-position');

        if (!saved) {
            // Which edge the widget's own CSS anchors it to, declared in the
            // markup. It cannot be read off the element: an absolutely
            // positioned box resolves left and top to pixels even when the
            // stylesheet only ever set right and bottom.
            const hDefault = actualContentWrapper.classList.contains('horizontal-center')
                ? 'horizontal-center'
                : positionControlWrapper.getAttribute('default-horizontal') || 'left';
            const vDefault = actualContentWrapper.classList.contains('vertical-center')
                ? 'vertical-center'
                : positionControlWrapper.getAttribute('default-vertical') || 'bottom';

            setActiveIcon(hDefault);
            setActiveIcon(vDefault);
            return;
        }

        let pos = JSON.parse(saved);

        if (pos.horizontal === 'horizontal-center') {
            actualContentWrapper.style.left = 'unset';
            actualContentWrapper.style.right = 'unset';
            actualContentWrapper.classList.add('horizontal-center');
            leftTextInput.setAttribute('disabled', true);
            rightTextInput.setAttribute('disabled', true);
        } else if (pos.horizontal === 'left') {
            actualContentWrapper.classList.remove('horizontal-center');
            actualContentWrapper.style.right = 'unset';
            actualContentWrapper.style.left = pos.left || '0';
            leftTextInput.value = pos.leftVal || '';
            leftTextInput.removeAttribute('disabled');
            rightTextInput.setAttribute('disabled', true);
        } else if (pos.horizontal === 'right') {
            actualContentWrapper.classList.remove('horizontal-center');
            actualContentWrapper.style.left = 'unset';
            actualContentWrapper.style.right = pos.right || '0';
            rightTextInput.value = pos.rightVal || '';
            rightTextInput.removeAttribute('disabled');
            leftTextInput.setAttribute('disabled', true);
        }

        if (pos.vertical === 'vertical-center') {
            actualContentWrapper.style.top = 'unset';
            actualContentWrapper.style.bottom = 'unset';
            actualContentWrapper.classList.add('vertical-center');
            topTextInput.setAttribute('disabled', true);
            bottomTextInput.setAttribute('disabled', true);
        } else if (pos.vertical === 'top') {
            actualContentWrapper.classList.remove('vertical-center');
            actualContentWrapper.style.bottom = 'unset';
            actualContentWrapper.style.top = pos.top || '0';
            topTextInput.value = pos.topVal || '';
            topTextInput.removeAttribute('disabled');
            bottomTextInput.setAttribute('disabled', true);
        } else if (pos.vertical === 'bottom') {
            actualContentWrapper.classList.remove('vertical-center');
            actualContentWrapper.style.top = 'unset';
            actualContentWrapper.style.bottom = pos.bottom || '0';
            bottomTextInput.value = pos.bottomVal || '';
            bottomTextInput.removeAttribute('disabled');
            topTextInput.setAttribute('disabled', true);
        }

        setActiveIcon(pos.horizontal);
        setActiveIcon(pos.vertical);
    }

    loadPosition();

    [leftTextInput, rightTextInput, topTextInput, bottomTextInput].forEach(textInput => {
        textInput.addEventListener('input', (e) => {
            let side = textInput.getAttribute('side-type');
            let val = textInput.value;

            clearTimeout(inputDelayTimer);

            inputDelayTimer = setTimeout(() => {
                actualContentWrapper.style.setProperty(side, val + 'px');
                savePosition();
            }, 500);
        });
    })

    // One place that moves a widget on an axis and leaves the align buttons,
    // the number inputs and the element itself all saying the same thing.
    // Both the buttons and the on-page drag go through here.
    function setAxis(value, px) {
        const horizontal = value === 'left' || value === 'right' || value === 'horizontal-center';
        const centre = horizontal ? 'horizontal-center' : 'vertical-center';
        const [nearInput, farInput] = horizontal
            ? (value === 'left' ? [leftTextInput, rightTextInput] : [rightTextInput, leftTextInput])
            : (value === 'top' ? [topTextInput, bottomTextInput] : [bottomTextInput, topTextInput]);

        setActiveIcon(value);

        if (value === centre) {
            const [a, b] = horizontal ? ['left', 'right'] : ['top', 'bottom'];
            actualContentWrapper.style[a] = 'unset';
            actualContentWrapper.style[b] = 'unset';
            actualContentWrapper.classList.add(centre);

            (horizontal ? [leftTextInput, rightTextInput] : [topTextInput, bottomTextInput])
                .forEach(input => {
                    input.value = '';
                    input.setAttribute('disabled', true);
                });
            return;
        }

        const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[value];
        const offset = Math.round(px);

        actualContentWrapper.classList.remove(centre);
        actualContentWrapper.style[value] = offset + 'px';
        actualContentWrapper.style[opposite] = 'unset';

        nearInput.value = offset;
        nearInput.removeAttribute('disabled');
        farInput.value = '';
        farInput.setAttribute('disabled', true);
    }

    positionIcons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            setAxis(e.currentTarget.getAttribute('data-value'), 0);
            savePosition();
        });
    });

    widgetPositionControls.set(contentId, {
        element: actualContentWrapper,
        place(horizontal, horizontalPx, vertical, verticalPx) {
            setAxis(horizontal, horizontalPx);
            setAxis(vertical, verticalPx);
            savePosition();
        },
    });
});

// Clock style changer
const clockStyleWrapper = document.querySelector('#clock-settings-wrapper .clock-style-wrapper');
const clockStyles = clockStyleWrapper.querySelectorAll('img');

const DEFAULT_CLOCK_STYLE = 'clock-v4';

clockStyleWrapper.setAttribute('role', 'group');
clockStyleWrapper.setAttribute('aria-label', 'Clock style');
clockStyles.forEach(style => makeActivatable(style, 'button', style.getAttribute('alt') || 'Clock style'));

function applyClockStyle(clockName) {
    document.querySelectorAll('#clock-position-wrapper .clock-item').forEach(clock => {
        clock.style.display = clock.classList.contains(clockName) ? 'flex' : 'none';
    });

    clockStyles.forEach(style => {
        const selected = style.getAttribute('clock-name') === clockName;
        style.classList.toggle('selected', selected);
        style.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });

    // clock.js only draws the face on screen, so tell it which that is. It
    // loads after this file, and this runs once at parse time before it
    // exists — that first call is covered by clock.js reading the same key.
    if (typeof setActiveClockFace === 'function') setActiveClockFace(clockName);
}

clockStyles.forEach(style => {
    style.addEventListener('click', () => {
        const clockName = style.getAttribute('clock-name');
        localStorage.setItem('clock-style', clockName);
        applyClockStyle(clockName);
    });
})

applyClockStyle(localStorage.getItem('clock-style') || DEFAULT_CLOCK_STYLE);

// Clock scale
//
// The faces are drawn at fixed pixel sizes, and which of them is legible from
// across a room — or small enough to sit under a quote — is not something one
// set of numbers can answer. This is the one control that covers all eleven.
const CLOCK_SCALE_MIN = 0.2;
const CLOCK_SCALE_MAX = 3;
const DEFAULT_CLOCK_SCALE = 1;

const clockPositionWrapper = document.getElementById('clock-position-wrapper');
const clockScaleSlider = document.getElementById('clock-scale-slider');
const clockScaleValue = clockScaleSlider.parentElement.querySelector('.range-slider__value');

// arrange.js reads this to step the scale up and down from the current value.
let clockScale = DEFAULT_CLOCK_SCALE;

function clampClockScale(value) {
    const scale = Number(value);

    // Covers a key that was never written and one holding something
    // unparseable: Number turns null and '' into 0, which is not a scale
    // either.
    if (!Number.isFinite(scale) || scale <= 0) return DEFAULT_CLOCK_SCALE;

    // Two decimals because arrange mode steps by a proportion of the current
    // value rather than by a fixed amount, and 1.157625 has nowhere to show.
    return Math.round(Math.min(Math.max(scale, CLOCK_SCALE_MIN), CLOCK_SCALE_MAX) * 100) / 100;
}

// Sets the scale and brings the slider and its readout along, wherever the
// change came from. Saving is left to the caller so that the value restored on
// load is not written straight back — sync.js pushes every localStorage write
// out to chrome.storage.
function applyClockScale(value) {
    clockScale = clampClockScale(value);

    clockPositionWrapper.style.setProperty('--clock-scale', clockScale);
    clockScaleSlider.value = clockScale;
    clockScaleValue.textContent = clockScale;

    return clockScale;
}

clockScaleSlider.addEventListener('input', () => {
    localStorage.setItem('clock-scale', applyClockScale(clockScaleSlider.value));
});

applyClockScale(localStorage.getItem('clock-scale'));

const settingTabIcons = document.querySelectorAll('#settings-sidebar .tabs li');

document.querySelector('#settings-sidebar .tabs').setAttribute('role', 'tablist');

settingTabIcons.forEach(tab => {
    makeActivatable(tab, 'tab');
    tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
});

settingTabIcons.forEach(icon => {
    icon.addEventListener('click', (e) => {
        let preSelectedTab = document.querySelector('#settings-sidebar .tabs li.active');

        if (e.currentTarget === preSelectedTab) {
            return;
        }

        preSelectedTab.classList.remove('active');
        preSelectedTab.setAttribute('aria-selected', 'false');
        e.currentTarget.classList.add('active');
        e.currentTarget.setAttribute('aria-selected', 'true');

        let tabName = e.currentTarget.getAttribute('setting-btn');
        let allItems = document.querySelectorAll('#settings-sidebar .item-wrapper');


        allItems.forEach(item => {
            if (item.getAttribute('item-name') === tabName) {
                item.style.display = 'flex';
            }
            else {
                item.style.display = 'none';
            }
        });
    });
})

// ---------------------------
// Pane sub-tabs — Background's Presets/Uploaded videos/Added links/Other
// settings, Clock's Style/Other settings, and any pane that later outgrows a
// single screen. Same active/hover pattern as the sidebar tabs above, scoped
// per pane: each .item-wrapper carries its own independent .sub-tabs group,
// found via closest() rather than a hardcoded pane id, so two panes with sub-
// tabs never fight over which one is active.
// ---------------------------
const subTabButtons = document.querySelectorAll('#settings-sidebar .sub-tabs > li');

subTabButtons.forEach(tab => {
    makeActivatable(tab, 'tab');
    tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
});

subTabButtons.forEach(tab => {
    tab.addEventListener('click', () => {
        const group = tab.closest('.item-wrapper');
        const preSelectedTab = group.querySelector('.sub-tabs > li.active');

        if (tab === preSelectedTab) return;

        preSelectedTab.classList.remove('active');
        preSelectedTab.setAttribute('aria-selected', 'false');
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        const paneName = tab.getAttribute('sub-tab-btn');
        group.querySelectorAll('.sub-pane').forEach(pane => {
            pane.classList.toggle('active', pane.getAttribute('sub-pane') === paneName);
        });
    });
});

// ---------------------------
// Glass color picker
// ---------------------------
;(function () {
    const glassColorPicker = document.getElementById('glass-color-picker');
    const glassHexInput = document.getElementById('glass-hex-input');

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function applyGlassColor(hex) {
        document.body.style.setProperty('--glass-bg-color', hexToRgba(hex, 0.18));
    }

    const savedGlassColor = localStorage.getItem('glass-color') || '#99988b';
    glassColorPicker.value = savedGlassColor;
    glassHexInput.value = savedGlassColor;
    applyGlassColor(savedGlassColor);

    let glassColorTimer;

    glassColorPicker.addEventListener('input', () => {
        const hex = glassColorPicker.value;
        glassHexInput.value = hex;
        applyGlassColor(hex);
        clearTimeout(glassColorTimer);
        glassColorTimer = setTimeout(() => localStorage.setItem('glass-color', hex), 1000);
    });

    glassHexInput.addEventListener('input', () => {
        const hex = normalizeHex(glassHexInput.value);
        if (hex) {
            glassHexInput.classList.remove('invalid');
            glassColorPicker.value = hex;
            applyGlassColor(hex);
            clearTimeout(glassColorTimer);
            glassColorTimer = setTimeout(() => localStorage.setItem('glass-color', hex), 1000);
        } else {
            glassHexInput.classList.add('invalid');
        }
    });

    glassHexInput.addEventListener('blur', () => {
        const hex = normalizeHex(glassHexInput.value);
        if (hex) {
            glassHexInput.value = hex;
            glassHexInput.classList.remove('invalid');
        } else {
            glassHexInput.value = glassColorPicker.value;
            glassHexInput.classList.remove('invalid');
        }
    });
})();

// ---------------------------
// Widget visibility
//
// A widget becomes hideable by putting data-widget-toggle="<id of the
// element to hide>" on its checkbox. Adding one is a line of markup, not
// another block of code down here.
// ---------------------------
const WIDGET_VISIBILITY_PREFIX = 'widget-visible:';

// The search bar had its own key before this was generalised.
const LEGACY_VISIBILITY_KEYS = { 'search-wrapper': 'search-visible' };

function widgetVisibilityKey(targetId) {
    return WIDGET_VISIBILITY_PREFIX + targetId;
}

function readWidgetVisibility(targetId, defaultVisible = true) {
    const key = widgetVisibilityKey(targetId);
    const legacyKey = LEGACY_VISIBILITY_KEYS[targetId];

    if (legacyKey && localStorage.getItem(key) === null) {
        const saved = localStorage.getItem(legacyKey);
        if (saved !== null) {
            localStorage.setItem(key, saved);
        }
        localStorage.removeItem(legacyKey);
    }

    const saved = localStorage.getItem(key);
    // Nothing stored means nobody has touched this toggle, so the shipped
    // default stands — on for everything except the quote, which starts off.
    if (saved === null) return defaultVisible;
    return saved !== 'false';
}

document.querySelectorAll('[data-widget-toggle]').forEach(input => {
    const targetId = input.dataset.widgetToggle;
    const target = document.getElementById(targetId);
    if (!target) return;

    function apply(visible) {
        target.classList.toggle('widget-hidden', !visible);
        input.checked = visible;
    }

    // data-default-hidden on the checkbox is how a widget says it ships off.
    apply(readWidgetVisibility(targetId, !('defaultHidden' in input.dataset)));

    input.addEventListener('change', () => {
        localStorage.setItem(widgetVisibilityKey(targetId), input.checked);
        apply(input.checked);
    });
});

const searchWrapper = document.getElementById('search-wrapper');
const searchInput = searchWrapper.querySelector('input');

// ---------------------------
// Shortcuts layout toggle (horizontal / vertical)
// ---------------------------
const shortcutsLayoutWrapper = document.getElementById('shortcuts-wrapper');
const shortcutLayoutToggle = document.getElementById('shortcut-layout-toggle');

// Vertical is the shipped default, so the test is for the setting having been
// turned off rather than for it having been turned on. The wrapper already
// carries .vertical from the markup; this only has to take it away again.
const verticalShortcuts = (localStorage.getItem('shortcuts-layout') || 'vertical') === 'vertical';
shortcutsLayoutWrapper.classList.toggle('vertical', verticalShortcuts);
shortcutLayoutToggle.checked = verticalShortcuts;

shortcutLayoutToggle.addEventListener('change', () => {
    const vertical = shortcutLayoutToggle.checked;
    shortcutsLayoutWrapper.classList.toggle('vertical', vertical);
    localStorage.setItem('shortcuts-layout', vertical ? 'vertical' : 'horizontal');
});

// The glass card behind each icon. On is what ships, so — as with the layout
// above — the saved value is only ever read to find out that it was switched
// off. The class goes on the wrapper, which survives the rewrites loadShortcuts
// does to its children; see the note in shortcuts.css.
const shortcutCardToggle = document.getElementById('shortcut-card-toggle');

const shortcutCards = localStorage.getItem('shortcuts-icon-card') !== 'off';
shortcutsLayoutWrapper.classList.toggle('no-card', !shortcutCards);
shortcutCardToggle.checked = shortcutCards;

shortcutCardToggle.addEventListener('change', () => {
    const on = shortcutCardToggle.checked;
    shortcutsLayoutWrapper.classList.toggle('no-card', !on);
    localStorage.setItem('shortcuts-icon-card', on ? 'on' : 'off');
});

// Colour is what ships, so unlike the two above this one is read the other way
// round — the saved value has to say 'on' for anything to change.
const shortcutMonoToggle = document.getElementById('shortcut-mono-toggle');

const shortcutMono = localStorage.getItem('shortcuts-icon-mono') === 'on';
shortcutsLayoutWrapper.classList.toggle('mono', shortcutMono);
shortcutMonoToggle.checked = shortcutMono;

shortcutMonoToggle.addEventListener('change', () => {
    const on = shortcutMonoToggle.checked;
    shortcutsLayoutWrapper.classList.toggle('mono', on);
    localStorage.setItem('shortcuts-icon-mono', on ? 'on' : 'off');
});

// ---------------------------
// Shortcuts spacing control
// ---------------------------
const shortcutGapSlider = document.getElementById('shortcut-gap-slider');

function applyShortcutGap(gap) {
    shortcutsLayoutWrapper.style.gap = gap + 'px';
    shortcutGapSlider.parentElement.querySelector('.range-slider__value').textContent = gap;
}

const savedShortcutGap = localStorage.getItem('shortcuts-gap');
if (savedShortcutGap) {
    shortcutGapSlider.value = savedShortcutGap;
    applyShortcutGap(savedShortcutGap);
}

shortcutGapSlider.addEventListener('input', () => {
    applyShortcutGap(shortcutGapSlider.value);
    localStorage.setItem('shortcuts-gap', shortcutGapSlider.value);
});

// ---------------------------
// Search dropdown: history + query suggestions
// ---------------------------
// Two sources feed one list. History is local and answers instantly, so it is
// redrawn on every keystroke. Suggestions cost a network round trip, so they
// wait for a pause in the typing — see queueSuggestions.
//
// This endpoint is Google's regardless of which engine Enter actually searches,
// because there is no API that reports the browser's default provider. The
// suggestions are Google's opinion; the search itself still goes wherever the
// user has pointed Chrome.
const SUGGEST_ENDPOINT = 'https://suggestqueries.google.com/complete/search?client=firefox&q=';
const SUGGEST_DEBOUNCE_MS = 150;
// Ten rows is already a tall panel, so once both sources are in play the
// budget is split evenly rather than letting either crowd the other out. An
// empty box has nothing to suggest against, though, and there history is the
// only thing there is to show — so it gets the whole ten to itself.
const HISTORY_LIMIT = 5;
const HISTORY_LIMIT_EMPTY = 10;
const SUGGEST_LIMIT = 5;

const historyDropdown = document.getElementById('search-history-dropdown');
const searchGhost = document.getElementById('search-ghost');
const searchGhostTyped = searchGhost.querySelector('.ghost-typed');
const searchGhostRest = searchGhost.querySelector('.ghost-rest');

let highlightIndex = -1;
// What the list is currently showing, in display order: { kind: 'history',
// item } for a visit, { kind: 'suggest', text } for a query.
let dropdownItems = [];
let historyResults = [];
let suggestResults = [];

function openHistoryDropdown() {
    // Freeze at the current (pre-change) height first, then force a reflow
    // before growing to the new target — otherwise the browser can collapse
    // both style changes into a single frame and skip the transition.
    historyDropdown.style.height = historyDropdown.offsetHeight + 'px';
    void historyDropdown.offsetHeight;

    historyDropdown.classList.add('open');
    // Animate to the list's actual content height instead of a fixed value,
    // so the reveal/collapse matches however many items are actually showing.
    historyDropdown.style.height = historyDropdown.scrollHeight + 'px';
}

function closeHistoryDropdown() {
    // Same freeze-then-reflow trick in reverse, so collapsing always has a
    // concrete starting height to transition from.
    historyDropdown.style.height = historyDropdown.offsetHeight + 'px';
    void historyDropdown.offsetHeight;

    historyDropdown.classList.remove('open');
    historyDropdown.style.height = '0px';
}

// Routes through the user's chosen default search provider instead of
// hardcoding one, per the Chrome Web Store single-purpose policy.
function runSearch(text) {
    chrome.search.query({ text, disposition: 'CURRENT_TAB' });
}

// ---- Suggestions ----
let suggestTimer;
let suggestAbort;

async function fetchSuggestions(query) {
    // The request in flight is abandoned rather than awaited: its answer is for
    // a prefix the user has already typed past.
    suggestAbort?.abort();
    suggestAbort = new AbortController();

    try {
        const res = await fetch(SUGGEST_ENDPOINT + encodeURIComponent(query), {
            signal: suggestAbort.signal
        });
        if (!res.ok) return [];
        // The endpoint answers ["what you typed", ["first", "second", ...]].
        const [, suggestions] = await res.json();
        return Array.isArray(suggestions) ? suggestions.slice(0, SUGGEST_LIMIT) : [];
    } catch {
        // Aborted by the next keystroke, or offline. Either way the list keeps
        // what it already has rather than flashing an error at someone who is
        // still in the middle of typing.
        return [];
    }
}

// The timer restarts on every character, so a run of typing spends nothing and
// only the pause at the end of it costs a request.
function queueSuggestions(query, allowInline) {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(async () => {
        const results = query.trim() ? await fetchSuggestions(query) : [];
        // Only worth drawing if it still describes what is in the box — an
        // abort can lose the race against a fast typist.
        if (query !== searchInput.value) return;

        suggestResults = results;
        renderDropdown();
        if (allowInline) drawInlineCompletion(results[0]);
    }, SUGGEST_DEBOUNCE_MS);
}

// ---- Inline completion ----
// The full text of the suggestion currently previewed in the box, or '' when
// there is nothing to accept. Tab reads this.
let inlineCompletion = '';

function clearInlineCompletion() {
    inlineCompletion = '';
    searchGhostTyped.textContent = '';
    searchGhostRest.textContent = '';
}

// The ghost is positioned against the wrapper rather than the input, so it has
// to be told where the input sits — which moves when the bar animates on focus.
function syncGhostBox() {
    searchGhost.style.left = searchInput.offsetLeft + 'px';
    searchGhost.style.top = searchInput.offsetTop + 'px';
    searchGhost.style.width = searchInput.offsetWidth + 'px';
    searchGhost.style.height = searchInput.offsetHeight + 'px';
}

function drawInlineCompletion(suggestion) {
    clearInlineCompletion();

    const typed = searchInput.value;
    if (!typed || !suggestion) return;
    // Matched case-insensitively so "YOUT" still completes, but the prefix is
    // drawn from `typed` verbatim so its width matches the real input to the
    // pixel whatever casing the suggestion came back in.
    if (!suggestion.toLowerCase().startsWith(typed.toLowerCase())) return;
    if (suggestion.length <= typed.length) return;
    // Only with the caret at the very end and nothing selected; anywhere else
    // the tail would appear in the middle of the word being edited.
    if (searchInput.selectionStart !== typed.length) return;
    if (searchInput.selectionEnd !== typed.length) return;
    // Once the value is long enough to scroll the input, the two copies stop
    // lining up: the input has scrolled its text and the ghost has not.
    if (searchInput.scrollWidth > searchInput.clientWidth) return;

    inlineCompletion = suggestion;
    searchGhostTyped.textContent = typed;
    searchGhostRest.textContent = suggestion.slice(typed.length);
    syncGhostBox();
}

// ---- The list ----
function renderDropdown() {
    dropdownItems = [
        ...historyResults.map(item => ({ kind: 'history', item })),
        ...suggestResults.map(text => ({ kind: 'suggest', text }))
    ];
    highlightIndex = -1;
    historyDropdown.innerHTML = '';

    if (dropdownItems.length === 0) {
        closeHistoryDropdown();
        return;
    }

    dropdownItems.forEach(entry => {
        const el = document.createElement('div');
        el.className = 'history-item';

        if (entry.kind === 'history') {
            const { url, title } = entry.item;
            // Only the skeleton is markup. A page title is text some other site
            // chose, so it goes in through textContent rather than being pasted
            // into an innerHTML string.
            el.innerHTML =
                '<img alt=""><span class="history-title"></span><span class="history-url"></span>';
            applyLinkIcon(el.querySelector('img'), url);
            el.querySelector('.history-title').textContent = title || url;
            el.querySelector('.history-url').textContent = url;
            el.addEventListener('mousedown', e => {
                e.preventDefault(); // prevent blur from closing dropdown before click fires
                window.location.href = url;
            });
        } else {
            el.classList.add('suggest-item');
            el.innerHTML =
                '<img src="assets/icon/search.svg" alt=""><span class="history-title"></span>';
            el.querySelector('.history-title').textContent = entry.text;
            el.addEventListener('mousedown', e => {
                e.preventDefault();
                runSearch(entry.text);
            });
        }

        historyDropdown.appendChild(el);
    });

    openHistoryDropdown();
}

async function updateDropdown(query) {
    const typing = Boolean(query.trim());

    // Anything still in hand describes a prefix that has since been deleted,
    // and an empty box cannot suggest against nothing. Cleared here rather than
    // waiting for the debounce, so emptying the box does not leave the last
    // query's suggestions sitting under the history for another 150ms.
    if (!typing) suggestResults = [];

    if (chrome?.history) {
        historyResults = await chrome.history.search({
            text: query || '',
            maxResults: typing ? HISTORY_LIMIT : HISTORY_LIMIT_EMPTY,
            startTime: 0
        });
    }
    renderDropdown();
}

function setHighlight(index) {
    const items = historyDropdown.querySelectorAll('.history-item');
    items.forEach((el, i) => el.classList.toggle('highlighted', i === index));
    highlightIndex = index;
}

// ---------------------------
// Search bar width
// ---------------------------
// This is the resting width and nothing else. Focus animates the bar out to
// SEARCH_FOCUS_WIDTH — the width it ships at — so however narrow it has been
// set to sit on the page, it is always the same size once you are typing in
// it. Setting it wider than that is allowed, and focusing then draws it back
// in; the focused size is fixed either way.
const SEARCH_FOCUS_WIDTH = 684;
const SEARCH_WIDTH_MIN = 240;
const SEARCH_WIDTH_MAX = 1200;

const searchWidthSlider = document.getElementById('search-width-slider');
const searchWidthValue = searchWidthSlider.parentElement.querySelector('.range-slider__value');

// Read by unfocusSearchBar to animate the bar back to its resting size.
let searchRestWidth = SEARCH_FOCUS_WIDTH;

function applySearchWidth(value) {
    const width = Number(value);

    // Only a value that is not a number at all falls back to the size the bar
    // ships at — a missing key or a blank one, which Number would otherwise
    // turn into a perfectly clampable 0. A real number is clamped however far
    // out of range it is: dragging the grip in arrange mode past the left of
    // the bar computes a negative width, and that has to land on the minimum
    // rather than snapping the bar back to its default.
    const usable = value !== null && value !== '' && Number.isFinite(width);

    searchRestWidth = usable
        ? Math.round(Math.min(Math.max(width, SEARCH_WIDTH_MIN), SEARCH_WIDTH_MAX))
        : SEARCH_FOCUS_WIDTH;

    searchWidthSlider.value = searchRestWidth;
    searchWidthValue.textContent = searchRestWidth;
    searchWrapper.style.setProperty('--search-rest-width', `${searchRestWidth}px`);

    return searchRestWidth;
}

searchWidthSlider.addEventListener('input', () => {
    localStorage.setItem('search-width', applySearchWidth(searchWidthSlider.value));
});

applySearchWidth(localStorage.getItem('search-width'));

// Only now is the bar allowed to animate its width — see the note on the
// transition in search.css.
requestAnimationFrame(() => {
    searchWrapper.style.setProperty('--search-width-anim', '0.35s');
});

// ---------------------------
// Search bar focus animation (center + blur backdrop)
// ---------------------------
const searchFocusOverlay = document.getElementById('search-focus-overlay');
let searchUnfocusTimer;

const SEARCH_POSITION_PROPS = ['position', 'left', 'top', 'right', 'bottom', 'transform', 'width'];
const SEARCH_ANIM_MS = 350;
let savedSearchInlineStyles = null;
let searchBarFocused = false;
let searchRestPosition = null;

function restoreSearchInlineProp(prop) {
    const saved = savedSearchInlineStyles[prop];
    if (saved.value) {
        searchWrapper.style.setProperty(prop, saved.value, saved.priority);
    } else {
        searchWrapper.style.removeProperty(prop);
    }
}

function restoreAllSearchInlineProps() {
    SEARCH_POSITION_PROPS.forEach(restoreSearchInlineProp);
}

// Pin the bar where it currently sits, as fixed px coordinates, fully taking
// over left/top/transform from the position classes (.horizontal-center /
// .vertical-center use `!important`, so plain inline styles would be
// overridden by them without also using `important` here).
function freezeSearchBarAt(rect, width) {
    searchWrapper.style.setProperty('position', 'fixed', 'important');
    searchWrapper.style.setProperty('left', `${rect.left}px`, 'important');
    searchWrapper.style.setProperty('top', `${rect.top}px`, 'important');
    searchWrapper.style.setProperty('right', 'auto', 'important');
    searchWrapper.style.setProperty('bottom', 'auto', 'important');
    searchWrapper.style.setProperty('transform', 'none', 'important');
    searchWrapper.style.setProperty('width', `${width}px`);
}

function focusSearchBar() {
    clearTimeout(searchUnfocusTimer);

    // Save whatever inline positioning styles are already on the element
    // (e.g. a custom position picked in Settings) *before* we override them,
    // so unfocus can restore that exact position instead of falling back to
    // the CSS defaults. Skipped when a previous unfocus is still animating,
    // since the element is carrying our frozen styles at that point, not the
    // user's.
    if (!savedSearchInlineStyles) {
        savedSearchInlineStyles = {};
        SEARCH_POSITION_PROPS.forEach(prop => {
            savedSearchInlineStyles[prop] = {
                value: searchWrapper.style.getPropertyValue(prop),
                priority: searchWrapper.style.getPropertyPriority(prop),
            };
        });
    }

    searchBarFocused = true;

    const rect = searchWrapper.getBoundingClientRect();

    // Both measured before anything is written, so a focus that lands while an
    // unfocus is still animating starts from where the bar actually is rather
    // than from where it was going.
    //
    // The width has to be the used one and not rect.width: box-sizing is
    // content-box here, so the rect also carries the 12px of padding either
    // side and the glass card's border. Pinning that as the width would widen
    // the bar by 26px the instant it was written. That same 26px is what the
    // target position below has to add back to centre the bar on screen.
    const width = parseFloat(getComputedStyle(searchWrapper).width);
    const chrome = rect.width - width;

    // Remember where the bar rests so unfocus can animate back to it. Reading
    // it again later would mean briefly restoring the real styles to measure
    // them, and that round trip through `position: absolute` cancels the
    // transition — the bar snaps home instead of sliding.
    searchRestPosition = { left: rect.left, top: rect.top };

    freezeSearchBarAt(rect, width);

    // Force layout so the browser registers the frozen starting point
    // before animating to the target, otherwise the transition is skipped.
    void searchWrapper.offsetHeight;

    searchWrapper.style.removeProperty('z-index');
    searchWrapper.classList.add('focused');
    searchFocusOverlay.classList.add('active');

    // Centred on the width the bar is going to end up at rather than the one
    // it is leaving, so the slide and the resize land together on the middle
    // of the screen.
    const targetLeft = window.innerWidth / 2 - (SEARCH_FOCUS_WIDTH + chrome) / 2;
    const targetTop = window.innerHeight / 2 - 200 - rect.height / 2;

    searchWrapper.style.setProperty('left', `${targetLeft}px`, 'important');
    searchWrapper.style.setProperty('top', `${targetTop}px`, 'important');
    searchWrapper.style.setProperty('width', `${SEARCH_FOCUS_WIDTH}px`);
    // No scale here: a transform:scale() on this element combined with the
    // history dropdown's clipped/ellipsis text underneath causes the text to
    // fail to paint in Chromium (confirmed — icon rendered, text vanished).
}

function unfocusSearchBar() {
    if (!savedSearchInlineStyles || !searchBarFocused) return;
    searchBarFocused = false;
    clearTimeout(searchUnfocusTimer);

    // Drop .focused now so its box-shadow fades along with the movement, but
    // keep the stacking order until the bar is home so it does not slide
    // behind the overlay that is fading out.
    searchWrapper.style.setProperty('z-index', '950');
    searchWrapper.classList.remove('focused');
    searchFocusOverlay.classList.remove('active');

    // Still `position: fixed` here, so this is a plain px-to-px move that the
    // transition can interpolate. The real styles only go back once the bar
    // has arrived, where swapping them in is invisible.
    searchWrapper.style.setProperty('left', `${searchRestPosition.left}px`, 'important');
    searchWrapper.style.setProperty('top', `${searchRestPosition.top}px`, 'important');
    // searchRestPosition was measured at the resting width, so the two agree
    // and the bar arrives home the size it left. Restoring the real styles
    // afterwards hands the width back to --search-rest-width at the same
    // value, which is why that swap stays invisible.
    searchWrapper.style.setProperty('width', `${searchRestWidth}px`);

    searchUnfocusTimer = setTimeout(() => {
        restoreAllSearchInlineProps();
        searchWrapper.style.removeProperty('z-index');
        savedSearchInlineStyles = null;
    }, SEARCH_ANIM_MS);
}

searchFocusOverlay.addEventListener('click', () => {
    searchInput.blur();
});

searchInput.addEventListener('focus', () => {
    updateDropdown(searchInput.value);
    focusSearchBar();
});

searchInput.addEventListener('input', e => {
    // Dropped straight away rather than left standing while the request runs:
    // it describes the previous prefix and is already wrong.
    clearInlineCompletion();
    updateDropdown(searchInput.value);
    // No tail while deleting. It would grow back the character just removed and
    // make backspace look like it had not worked.
    queueSuggestions(searchInput.value, !e.inputType?.startsWith('delete'));
});

searchInput.addEventListener('blur', () => {
    clearInlineCompletion();
    setTimeout(() => closeHistoryDropdown(), 150);
    unfocusSearchBar();
});

searchInput.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
        // The key is only claimed when there is something to accept, so Tab
        // still moves focus out of an empty or already-complete box.
        if (!inlineCompletion) return;
        e.preventDefault();
        searchInput.value = inlineCompletion;
        clearInlineCompletion();
        updateDropdown(searchInput.value);
        // Asked again from the completed text, so a longer suggestion can offer
        // itself and Tab can be pressed a second time.
        queueSuggestions(searchInput.value, true);
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight(Math.min(highlightIndex + 1, dropdownItems.length - 1));
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight(Math.max(highlightIndex - 1, -1));
    } else if (e.key === 'Escape') {
        clearInlineCompletion();
        closeHistoryDropdown();
        searchInput.blur();
    } else if (e.key === 'Enter') {
        const entry = dropdownItems[highlightIndex];
        if (entry?.kind === 'history') {
            window.location.href = entry.item.url;
        } else if (entry?.kind === 'suggest') {
            runSearch(entry.text);
        } else if (searchInput.value.trim()) {
            // Deliberately what was typed, not the dimmed tail. Until Tab takes
            // it the tail is a preview, the way a shell autosuggestion is.
            runSearch(searchInput.value.trim());
        }
    }
});