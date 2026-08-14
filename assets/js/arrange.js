// Arrange mode: drag widgets around the page instead of typing offsets into
// Settings. Dropping a widget hands the result to its position control, so the
// align buttons and the number inputs stay the source of truth.

// How close to a centre line counts as centred. Snapping to the class rather
// than to a pixel value matters: a centred widget has to stay centred when the
// window resizes, which a hard left offset would not.
const ARRANGE_SNAP = 14;

// Each notch of the wheel is a proportion of the current scale rather than a
// fixed amount, so getting from 0.2 to 1 takes about as many notches as
// getting from 1 to 5. A fixed step fine enough to be usable at 0.2 would be
// an eternity of scrolling at the top of the range.
const ARRANGE_SCALE_STEP = 1.05;

// How long a value reads out for after it stops changing.
const ARRANGE_READOUT_LINGER = 1400;

const arrangeBar = document.getElementById('arrange-bar');
const arrangeStartBtn = document.getElementById('arrange-start');
const arrangeDoneBtn = document.getElementById('arrange-done');
const arrangeGuideX = document.getElementById('arrange-guide-x');
const arrangeGuideY = document.getElementById('arrange-guide-y');
const arrangeReadout = document.getElementById('arrange-readout');
const searchResizeHandle = document.getElementById('search-resize-handle');

const arrangeTargets = [...widgetPositionControls.keys()]
    .map(id => document.getElementById(id))
    .filter(Boolean);

arrangeTargets.forEach(el => el.classList.add('arrange-target'));

function showGuides(x, y) {
    arrangeGuideX.classList.toggle('on', x);
    arrangeGuideY.classList.toggle('on', y);
}

function setArranging(on) {
    document.body.classList.toggle('arranging', on);
    if (!on) {
        showGuides(false, false);
        hideReadout();
    }
}

// ---------------------------
// Readout
// ---------------------------
// One badge in the bar for whichever number is currently being changed.
let arrangeReadoutTimer;

function hideReadout() {
    clearTimeout(arrangeReadoutTimer);
    arrangeReadout.classList.remove('on');
}

function showReadout(text) {
    arrangeReadout.textContent = text;
    arrangeReadout.classList.add('on');

    clearTimeout(arrangeReadoutTimer);
    arrangeReadoutTimer = setTimeout(() => {
        arrangeReadout.classList.remove('on');
    }, ARRANGE_READOUT_LINGER);
}

// ---------------------------
// Size
// ---------------------------
// The clock scales and the search bar takes a width, and neither is something
// every widget has — so both are wired up by name rather than dressed up as a
// general feature. Each one goes through the same apply function the settings
// slider does, so whichever you reach for, the other is showing the same
// number by the time you look at it.

// Not passive: the point of the handler is to take the wheel off the page.
// Ctrl held is the browser's own zoom — and a trackpad pinch — which is left
// alone rather than quietly turned into something else.
document.getElementById('clock-position-wrapper').addEventListener('wheel', e => {
    if (!document.body.classList.contains('arranging') || e.ctrlKey) return;
    e.preventDefault();

    const step = e.deltaY < 0 ? ARRANGE_SCALE_STEP : 1 / ARRANGE_SCALE_STEP;
    const scale = applyClockScale(clockScale * step);

    localStorage.setItem('clock-scale', scale);
    showReadout(`${scale}×`);
}, { passive: false });

let searchResize = null;

searchResizeHandle.addEventListener('pointerdown', e => {
    if (!document.body.classList.contains('arranging')) return;

    // The bar underneath is a drag target. Without this, taking hold of the
    // grip would pick the whole widget up and move it as well.
    e.stopPropagation();
    e.preventDefault();

    searchResize = {
        startX: e.clientX,
        startWidth: searchRestWidth,
        // A centred bar grows from its middle, so the edge under the pointer
        // only travels half as far as the width changes — it has to change by
        // twice the drag to keep up. Anchored to an edge, the two move
        // together. A right-anchored bar grows leftwards and the grip stays
        // put, which is the one case where it cannot follow the pointer.
        factor: searchWrapper.classList.contains('horizontal-center') ? 2 : 1,
    };

    searchResizeHandle.setPointerCapture(e.pointerId);
    searchWrapper.classList.add('arrange-resizing');
});

searchResizeHandle.addEventListener('pointermove', e => {
    if (!searchResize) return;

    const travelled = (e.clientX - searchResize.startX) * searchResize.factor;
    showReadout(`${applySearchWidth(searchResize.startWidth + travelled)}px`);
});

['pointerup', 'pointercancel'].forEach(type => searchResizeHandle.addEventListener(type, () => {
    if (!searchResize) return;
    searchResize = null;

    searchWrapper.classList.remove('arrange-resizing');
    // Saved on the way out rather than on every move: one write, and one
    // push through sync.js, for the whole drag.
    localStorage.setItem('search-width', searchRestWidth);
}));

arrangeStartBtn.addEventListener('click', () => {
    // The sidebar covers the page it is about to ask you to rearrange.
    settingsOverlay.classList.remove('show');
    setTimeout(() => settingsOverlay.classList.add('hidden'), 250);
    setArranging(true);
});

arrangeDoneBtn.addEventListener('click', () => setArranging(false));

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('arranging')) {
        setArranging(false);
    }
});

// A widget that is only being dragged should not also follow its link.
document.addEventListener('click', e => {
    if (document.body.classList.contains('arranging') && e.target.closest('.arrange-target')) {
        e.preventDefault();
        e.stopPropagation();
    }
}, true);

// Keeps a widget inside the window, unless it is bigger than the window — a
// clock scaled up past the edges has no range to be held in, and max drops
// below min. Clamping then pins it to one spot it cannot be dragged out of,
// so that case is let through instead.
const clamp = (value, min, max) => (max < min ? value : Math.min(Math.max(value, min), max));

let arrangeDrag = null;

function centreOffsets(rect) {
    return {
        x: window.innerWidth / 2 - rect.width / 2,
        y: window.innerHeight / 2 - rect.height / 2,
    };
}

arrangeTargets.forEach(el => {
    el.addEventListener('pointerdown', e => {
        if (!document.body.classList.contains('arranging')) return;
        e.preventDefault();

        const rect = el.getBoundingClientRect();

        // Take over from the centring classes, which use !important, so the
        // move is a plain left/top change rather than a fight with the CSS.
        el.classList.remove('horizontal-center', 'vertical-center');
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.top}px`;
        el.style.right = 'unset';
        el.style.bottom = 'unset';

        arrangeDrag = {
            el,
            grabX: e.clientX - rect.left,
            grabY: e.clientY - rect.top,
            width: rect.width,
            height: rect.height,
        };

        el.setPointerCapture(e.pointerId);
        el.classList.add('arrange-dragging');
    });

    el.addEventListener('pointermove', e => {
        if (!arrangeDrag || arrangeDrag.el !== el) return;

        const { width, height } = arrangeDrag;
        const centre = centreOffsets({ width, height });

        let left = clamp(e.clientX - arrangeDrag.grabX, 0, window.innerWidth - width);
        let top = clamp(e.clientY - arrangeDrag.grabY, 0, window.innerHeight - height);

        const snapX = Math.abs(left - centre.x) <= ARRANGE_SNAP;
        const snapY = Math.abs(top - centre.y) <= ARRANGE_SNAP;
        if (snapX) left = centre.x;
        if (snapY) top = centre.y;
        showGuides(snapX, snapY);

        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
    });

    ['pointerup', 'pointercancel'].forEach(type => el.addEventListener(type, () => {
        if (!arrangeDrag || arrangeDrag.el !== el) return;
        arrangeDrag = null;

        el.classList.remove('arrange-dragging');
        showGuides(false, false);

        const rect = el.getBoundingClientRect();
        const centre = centreOffsets(rect);

        // Anchor to whichever edge the widget ended up nearer, so it keeps its
        // relationship to that edge when the window changes size.
        let horizontal = 'left';
        let horizontalPx = rect.left;
        if (Math.abs(rect.left - centre.x) <= ARRANGE_SNAP) {
            horizontal = 'horizontal-center';
            horizontalPx = 0;
        } else if (rect.left > window.innerWidth - rect.right) {
            horizontal = 'right';
            horizontalPx = window.innerWidth - rect.right;
        }

        let vertical = 'top';
        let verticalPx = rect.top;
        if (Math.abs(rect.top - centre.y) <= ARRANGE_SNAP) {
            vertical = 'vertical-center';
            verticalPx = 0;
        } else if (rect.top > window.innerHeight - rect.bottom) {
            vertical = 'bottom';
            verticalPx = window.innerHeight - rect.bottom;
        }

        widgetPositionControls.get(el.id).place(horizontal, horizontalPx, vertical, verticalPx);
    }));
});
