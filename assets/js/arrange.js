// Arrange mode: drag widgets around the page instead of typing offsets into
// Settings. Dropping a widget hands the result to its position control, so the
// align buttons and the number inputs stay the source of truth.

// How close to a centre line counts as centred. Snapping to the class rather
// than to a pixel value matters: a centred widget has to stay centred when the
// window resizes, which a hard left offset would not.
const ARRANGE_SNAP = 14;

const arrangeBar = document.getElementById('arrange-bar');
const arrangeStartBtn = document.getElementById('arrange-start');
const arrangeDoneBtn = document.getElementById('arrange-done');
const arrangeGuideX = document.getElementById('arrange-guide-x');
const arrangeGuideY = document.getElementById('arrange-guide-y');

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
    if (!on) showGuides(false, false);
}

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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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
