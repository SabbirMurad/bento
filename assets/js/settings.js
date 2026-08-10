// ---------------------------
// Sidebar open/close
// ---------------------------
const settingsOverlay = document.getElementById('settings-sidebar-overlay');
const settingsBtn = document.querySelector('#settings-btn');

settingsBtn.onclick = () => {
    settingsOverlay.classList.remove('hidden');
    settingsOverlay.classList.add('show');
};

settingsOverlay.onclick = e => {
    if (e.target === settingsOverlay) {
        settingsOverlay.classList.remove('show');
        setTimeout(() => settingsOverlay.classList.add('hidden'), 250);
    }
};

// ---------------------------
// Escape key closes any open sidebar
// ---------------------------
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;

    if (settingsOverlay.classList.contains('show')) {
        settingsOverlay.classList.remove('show');
        setTimeout(() => settingsOverlay.classList.add('hidden'), 250);
    }

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

    const initialColor = savedTextColor || '#ffffff';
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

const settingsItem = document.querySelectorAll('#settings-sidebar .item-wrapper');

settingsItem.forEach((settingsItem) => {
    const positionControlWrapper = settingsItem.querySelector('.item.position');
    if (!positionControlWrapper) return;

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
            group.querySelectorAll('.icon').forEach(i => i.classList.remove('active'));
            icon.classList.add('active');
        }
    }

    function loadPosition() {
        let saved = localStorage.getItem(contentId + '-position');

        if (!saved) {
            // Set default active icons based on current element state
            const hDefault = actualContentWrapper.classList.contains('horizontal-center') ? 'horizontal-center' : 'left';
            const vDefault = actualContentWrapper.classList.contains('vertical-center') ? 'vertical-center' : 'bottom';
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

    positionIcons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            let iconEl = e.currentTarget;
            const group = iconEl.closest('.align-btn-group');
            if (group) {
                group.querySelectorAll('.icon').forEach(i => i.classList.remove('active'));
                iconEl.classList.add('active');
            }

            let value = iconEl.getAttribute('data-value');

            if (value === 'left') {
                actualContentWrapper.style.left = '0';
                actualContentWrapper.style.right = 'unset';
                actualContentWrapper.classList.remove('horizontal-center');

                leftTextInput.removeAttribute('disabled');
                rightTextInput.setAttribute('disabled', true);
                rightTextInput.value = '';
            }
            else if (value === 'right') {
                actualContentWrapper.style.right = '0';
                actualContentWrapper.style.left = 'unset';
                actualContentWrapper.classList.remove('horizontal-center');

                rightTextInput.removeAttribute('disabled');
                leftTextInput.setAttribute('disabled', true);
                leftTextInput.value = '';
            }
            else if (value === 'horizontal-center') {
                actualContentWrapper.style.left = 'unset';
                actualContentWrapper.style.right = 'unset';
                actualContentWrapper.classList.add('horizontal-center');

                leftTextInput.setAttribute('disabled', true);
                rightTextInput.setAttribute('disabled', true);
                leftTextInput.value = '';
                rightTextInput.value = '';
            }
            else if (value === 'top') {
                actualContentWrapper.style.top = '0';
                actualContentWrapper.style.bottom = 'unset';
                actualContentWrapper.classList.remove('vertical-center');

                topTextInput.removeAttribute('disabled');
                bottomTextInput.setAttribute('disabled', true);
                bottomTextInput.value = '';
            }
            else if (value === 'bottom') {
                actualContentWrapper.style.bottom = '0';
                actualContentWrapper.style.top = 'unset';
                actualContentWrapper.classList.remove('vertical-center');

                bottomTextInput.removeAttribute('disabled');
                topTextInput.setAttribute('disabled', true);
                topTextInput.value = '';
            }
            else if (value === 'vertical-center') {
                actualContentWrapper.style.top = 'unset';
                actualContentWrapper.style.bottom = 'unset';
                actualContentWrapper.classList.add('vertical-center');

                topTextInput.setAttribute('disabled', true);
                bottomTextInput.setAttribute('disabled', true);
                topTextInput.value = '';
                bottomTextInput.value = '';
            }

            savePosition();
        });
    });
});

// Clock style changer
const clockStyleWrapper = document.querySelector('#clock-settings-wrapper .clock-style-wrapper');
const clockStyles = clockStyleWrapper.querySelectorAll('img');

const DEFAULT_CLOCK_STYLE = 'clock-v1';

function applyClockStyle(clockName) {
    document.querySelectorAll('#clock-position-wrapper .clock-item').forEach(clock => {
        clock.style.display = clock.classList.contains(clockName) ? 'flex' : 'none';
    });

    clockStyles.forEach(style => {
        style.classList.toggle('selected', style.getAttribute('clock-name') === clockName);
    });
}

clockStyles.forEach(style => {
    style.addEventListener('click', () => {
        const clockName = style.getAttribute('clock-name');
        localStorage.setItem('clock-style', clockName);
        applyClockStyle(clockName);
    });
})

applyClockStyle(localStorage.getItem('clock-style') || DEFAULT_CLOCK_STYLE);

const settingTabIcons = document.querySelectorAll('#settings-sidebar .tabs li');

settingTabIcons.forEach(icon => {
    icon.addEventListener('click', (e) => {
        let preSelectedTab = document.querySelector('#settings-sidebar .tabs li.active');

        if (e.currentTarget === preSelectedTab) {
            return;
        }

        preSelectedTab.classList.remove('active');
        e.currentTarget.classList.add('active');

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

    const savedGlassColor = localStorage.getItem('glass-color') || '#0c0c0c';
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
// Search bar toggle
// ---------------------------
const searchWrapper = document.getElementById('search-wrapper');
const searchToggle = document.getElementById('search-toggle');
const searchInput = searchWrapper.querySelector('input');

// On by default: only an explicit opt-out hides the search bar.
const searchVisible = localStorage.getItem('search-visible') !== 'false';
searchWrapper.classList.toggle('visible', searchVisible);
searchToggle.checked = searchVisible;

searchToggle.addEventListener('change', () => {
    const visible = searchToggle.checked;
    searchWrapper.classList.toggle('visible', visible);
    localStorage.setItem('search-visible', visible);
});

// ---------------------------
// Shortcuts layout toggle (horizontal / vertical)
// ---------------------------
const shortcutsLayoutWrapper = document.getElementById('shortcuts-wrapper');
const shortcutLayoutToggle = document.getElementById('shortcut-layout-toggle');

if (localStorage.getItem('shortcuts-layout') === 'vertical') {
    shortcutsLayoutWrapper.classList.add('vertical');
    shortcutLayoutToggle.checked = true;
}

shortcutLayoutToggle.addEventListener('change', () => {
    const vertical = shortcutLayoutToggle.checked;
    shortcutsLayoutWrapper.classList.toggle('vertical', vertical);
    localStorage.setItem('shortcuts-layout', vertical ? 'vertical' : 'horizontal');
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
// Search history dropdown
// ---------------------------
const historyDropdown = document.getElementById('search-history-dropdown');
let highlightIndex = -1;
let historyItems = [];

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

async function showHistory(query) {
    if (!chrome?.history) return;

    const results = await chrome.history.search({
        text: query || '',
        maxResults: 10,
        startTime: 0
    });

    historyItems = results;
    highlightIndex = -1;
    historyDropdown.innerHTML = '';

    if (results.length === 0) {
        closeHistoryDropdown();
        return;
    }

    results.forEach(item => {
        const el = document.createElement('div');
        el.className = 'history-item';
        el.innerHTML = `
            <img src="${getFavicon(item.url)}" alt="">
            <span class="history-title">${item.title || item.url}</span>
            <span class="history-url">${item.url}</span>
        `;
        el.addEventListener('mousedown', e => {
            e.preventDefault(); // prevent blur from closing dropdown before click fires
            window.location.href = item.url;
        });
        historyDropdown.appendChild(el);
    });

    openHistoryDropdown();
}

function setHighlight(index) {
    const items = historyDropdown.querySelectorAll('.history-item');
    items.forEach((el, i) => el.classList.toggle('highlighted', i === index));
    highlightIndex = index;
}

// ---------------------------
// Search bar focus animation (center + blur backdrop)
// ---------------------------
const searchFocusOverlay = document.getElementById('search-focus-overlay');
let searchUnfocusTimer;

const SEARCH_POSITION_PROPS = ['position', 'left', 'top', 'right', 'bottom', 'transform'];
const SEARCH_ANIM_MS = 350;
let savedSearchInlineStyles = null;
let searchBarFocused = false;

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
function freezeSearchBarAt(rect) {
    searchWrapper.style.setProperty('position', 'fixed', 'important');
    searchWrapper.style.setProperty('left', `${rect.left}px`, 'important');
    searchWrapper.style.setProperty('top', `${rect.top}px`, 'important');
    searchWrapper.style.setProperty('right', 'auto', 'important');
    searchWrapper.style.setProperty('bottom', 'auto', 'important');
    searchWrapper.style.setProperty('transform', 'none', 'important');
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
    freezeSearchBarAt(rect);

    // Force layout so the browser registers the frozen starting point
    // before animating to the target, otherwise the transition is skipped.
    void searchWrapper.offsetHeight;

    searchWrapper.style.removeProperty('z-index');
    searchWrapper.classList.add('focused');
    searchFocusOverlay.classList.add('active');

    const targetLeft = window.innerWidth / 2 - rect.width / 2;
    const targetTop = window.innerHeight / 2 - 200 - rect.height / 2;

    searchWrapper.style.setProperty('left', `${targetLeft}px`, 'important');
    searchWrapper.style.setProperty('top', `${targetTop}px`, 'important');
    // No scale here: a transform:scale() on this element combined with the
    // history dropdown's clipped/ellipsis text underneath causes the text to
    // fail to paint in Chromium (confirmed — icon rendered, text vanished).
}

function unfocusSearchBar() {
    if (!savedSearchInlineStyles || !searchBarFocused) return;
    searchBarFocused = false;
    clearTimeout(searchUnfocusTimer);

    const from = searchWrapper.getBoundingClientRect();

    // Simply restoring the saved styles here would snap instead of animate:
    // the resting position usually comes from the CSS classes as `auto` or a
    // percentage against a different containing block, and neither `auto` nor
    // a `position` change is interpolatable. So measure where the bar is
    // supposed to land, then animate to those viewport px while still fixed.
    // The restore/re-freeze pair happens within one task, so the intermediate
    // state is never painted.
    restoreAllSearchInlineProps();
    const to = searchWrapper.getBoundingClientRect();

    freezeSearchBarAt(from);
    void searchWrapper.offsetHeight;

    // Drop .focused now so its box-shadow fades along with the movement, but
    // keep the stacking order until the bar is home so it does not slide
    // behind the overlay that is fading out.
    searchWrapper.style.setProperty('z-index', '950');
    searchWrapper.classList.remove('focused');
    searchFocusOverlay.classList.remove('active');

    searchWrapper.style.setProperty('left', `${to.left}px`, 'important');
    searchWrapper.style.setProperty('top', `${to.top}px`, 'important');

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
    showHistory(searchInput.value);
    focusSearchBar();
});
searchInput.addEventListener('input', () => showHistory(searchInput.value));

searchInput.addEventListener('blur', () => {
    setTimeout(() => closeHistoryDropdown(), 150);
    unfocusSearchBar();
});

searchInput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight(Math.min(highlightIndex + 1, historyItems.length - 1));
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight(Math.max(highlightIndex - 1, -1));
    } else if (e.key === 'Escape') {
        closeHistoryDropdown();
        searchInput.blur();
    } else if (e.key === 'Enter') {
        if (highlightIndex >= 0 && historyItems[highlightIndex]) {
            window.location.href = historyItems[highlightIndex].url;
        } else if (searchInput.value.trim()) {
            window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(searchInput.value.trim());
        }
    }
});