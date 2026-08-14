let bookmarkDragActive = false;
let draggedBookmark = null; // { el, sourceFolderId, sourceContainer }

// Matches the opacity/transform transition on .bookmark-children.
const BOOKMARK_CHILDREN_CLOSE_DELAY = 200;

// How close a menu is allowed to get to the edge of the screen.
const MENU_VIEWPORT_MARGIN = 12;

// Below this a capped menu is more frustrating than one that overhangs, so it
// is left to overhang instead.
const MENU_MIN_HEIGHT = 120;

function resetChildrenPosition(childrenContainer) {
    childrenContainer.style.top = '';
    childrenContainer.style.bottom = '';
    childrenContainer.style.left = '';
    childrenContainer.style.right = '';
    childrenContainer.style.maxHeight = '';
}

// The cap in bookmark.css is written for a menu hanging off the top bar. This
// is the real figure, measured from where the menu actually ended up — which
// depends on whether it had to be flipped to open upwards.
//
// Only menus that scroll may be capped. The stylesheet holds overflow back
// from any menu containing a sub-folder, so that its flyout is not clipped;
// capping one of those would hide the overflow with no way to reach it, which
// is worse than letting it overhang.
function clampMenuHeight(childrenContainer, opensUpward) {
    if (childrenContainer.querySelector('.bookmark-folder')) return;

    childrenContainer.style.maxHeight = '';
    const rect = childrenContainer.getBoundingClientRect();

    const available = opensUpward
        ? rect.bottom - MENU_VIEWPORT_MARGIN
        : window.innerHeight - rect.top - MENU_VIEWPORT_MARGIN;

    if (rect.height <= available) return;
    childrenContainer.style.maxHeight = `${Math.max(available, MENU_MIN_HEIGHT)}px`;
}

// classList.remove('show') starts the fade; the position offsets that flip a
// submenu away from the screen edge stay put until the fade finishes, or a
// flipped submenu would visibly snap back to its default corner mid-fade.
function closeChildren(childrenContainer) {
    clearTimeout(childrenContainer._closeTimer);
    childrenContainer.classList.remove('show');
    childrenContainer._closeTimer = setTimeout(
        () => resetChildrenPosition(childrenContainer),
        BOOKMARK_CHILDREN_CLOSE_DELAY
    );
}

function positionAndShowChildren(childrenContainer, isTopLevel) {
    clearTimeout(childrenContainer._closeTimer);
    childrenContainer.style.visibility = 'hidden';
    resetChildrenPosition(childrenContainer);
    childrenContainer.classList.add('show');

    const rect = childrenContainer.getBoundingClientRect();
    let opensUpward = false;

    if (rect.bottom > window.innerHeight - 4) {
        opensUpward = true;
        childrenContainer.style.top = 'unset';
        childrenContainer.style.bottom = isTopLevel ? '100%' : '0';
    }

    if (rect.right > window.innerWidth - 4) {
        childrenContainer.style.left = 'unset';
        childrenContainer.style.right = isTopLevel ? '0' : 'calc(100% + 8px)';
    }

    clampMenuHeight(childrenContainer, opensUpward);
    childrenContainer.style.visibility = '';
}

function attachSmartHover(folder, childrenContainer, isTopLevel) {
    let springTimer = null;

    folder.addEventListener('mouseenter', () => {
        positionAndShowChildren(childrenContainer, isTopLevel);
    });

    folder.addEventListener('mouseleave', () => {
        if (bookmarkDragActive) return;
        closeChildren(childrenContainer);
    });

    // Spring-load: open folder automatically when hovering over it during a drag
    folder.addEventListener('dragenter', () => {
        if (!draggedBookmark) return;
        folder.classList.add('bm-drop-target');
        if (springTimer) return;
        springTimer = setTimeout(() => {
            positionAndShowChildren(childrenContainer, isTopLevel);
            springTimer = null;
        }, 600);
    });

    folder.addEventListener('dragleave', (e) => {
        if (!folder.contains(e.relatedTarget)) {
            folder.classList.remove('bm-drop-target');
            clearTimeout(springTimer);
            springTimer = null;
        }
    });

    // Allow dropping directly on the folder title (not just inside the children panel)
    folder.addEventListener('dragover', (e) => {
        if (!draggedBookmark) return;
        if (draggedBookmark.el.contains(childrenContainer)) return; // prevent circular drop
        e.preventDefault();
        e.stopPropagation();
    });

    folder.addEventListener('drop', (e) => {
        if (!draggedBookmark) return;
        if (draggedBookmark.el.contains(childrenContainer)) return;
        e.preventDefault();
        e.stopPropagation();
        // Only append if not already inside this folder's children (dragover may have done it)
        if (draggedBookmark.el.parentElement !== childrenContainer) {
            childrenContainer.appendChild(draggedBookmark.el);
        }
    });
}

// Global dragend: handles both same-folder reorder and cross-folder move
document.addEventListener('dragend', () => {
    if (!draggedBookmark) return;
    const { el, sourceFolderId, sourceContainer } = draggedBookmark;
    const destContainer = el.parentElement;
    const destFolderId = destContainer?.dataset.folderId;

    el.classList.remove('bm-dragging');
    document.querySelectorAll('.bookmark-folder.bm-drop-target').forEach(f => f.classList.remove('bm-drop-target'));

    if (destFolderId) {
        const destIds = [...destContainer.children].map(c => c.dataset.bmId).filter(Boolean);

        if (sourceFolderId !== destFolderId) {
            // Physically move the Chrome bookmark to the new folder
            chrome.bookmarks.move(el.dataset.bmId, { parentId: destFolderId });
            // Update source folder stored order (item removed)
            const srcIds = [...sourceContainer.children].map(c => c.dataset.bmId).filter(Boolean);
            chrome.storage.sync.set({ [`bm_order_${sourceFolderId}`]: srcIds });
        }

        chrome.storage.sync.set({ [`bm_order_${destFolderId}`]: destIds });
    }

    // Close all open submenus so the state is clean after drag
    document.querySelectorAll('.bookmark-children.show').forEach(closeChildren);

    draggedBookmark = null;
    bookmarkDragActive = false;
});

function attachDragSort(container, folderId) {
    container.addEventListener('dragstart', (e) => {
        const item = e.target.closest('[data-bm-id]');
        if (!item || item.parentElement !== container) return;
        draggedBookmark = { el: item, sourceFolderId: folderId, sourceContainer: container };
        bookmarkDragActive = true;
        item.classList.add('bm-dragging');
        e.stopPropagation();
    });

    // Accept drops from any folder's children (cross-folder reorder)
    container.addEventListener('dragover', (e) => {
        if (!draggedBookmark) return;
        if (draggedBookmark.el.contains(container)) return; // prevent circular drop
        e.preventDefault();
        e.stopPropagation();
        const items = [...container.children].filter(c => c !== draggedBookmark.el);
        const nextItem = items.find(item => {
            const rect = item.getBoundingClientRect();
            return e.clientY < rect.top + rect.height / 2;
        });
        if (nextItem) {
            container.insertBefore(draggedBookmark.el, nextItem);
        } else {
            container.appendChild(draggedBookmark.el);
        }
    });
}

function applyCustomOrder(nodes, savedOrders) {
    for (const node of nodes) {
        if (!node.children || node.children.length === 0) continue;
        const order = savedOrders[node.id];
        if (order) {
            const byId = Object.fromEntries(node.children.map(c => [c.id, c]));
            const reordered = order.filter(id => byId[id]).map(id => byId[id]);
            const unseen = node.children.filter(c => !order.includes(c.id));
            node.children = [...reordered, ...unseen];
        }
        applyCustomOrder(node.children, savedOrders);
    }
}

function processBookmarks(nodes) {
    let results = [];

    for (const node of nodes) {
        const item = {
            id: node.id,
            title: node.title,
            url: node.url || null,
            children: []
        };

        if (node.children && node.children.length > 0) {
            item.children = processBookmarks(node.children);
        }

        results.push(item);
    }

    return results;
}

function loadBookmarks(callback) {
    chrome.bookmarks.getTree((tree) => {
        const processedTree = processBookmarks(tree);
        chrome.storage.sync.get(null, (allStorage) => {
            const savedOrders = {};
            for (const key of Object.keys(allStorage)) {
                if (key.startsWith('bm_order_')) {
                    savedOrders[key.slice(9)] = allStorage[key];
                }
            }
            applyCustomOrder(processedTree, savedOrders);
            callback(processedTree);
        });
    });
}

loadBookmarks((tree) => {
    const main = renderMainBookmark(tree[0].children[0].children);
    const other = renderMainBookmark([tree[0].children[1]]);
    other.classList.add("other-bookmarks");
    document.getElementById("bookmark-container").appendChild(main);
    document.getElementById("bookmark-container").appendChild(other);
});


function renderMainBookmark(nodes) {
    const container = document.createElement("div");
    container.classList.add("container");

    for (const node of nodes) {
        if (node.url) {
            const item = document.createElement("a");
            item.setAttribute("href", node.url);
            item.className = "bookmark-item";
            item.classList.add("glass-card");
            item.innerHTML = `
                <img alt="${node.title || node.url}">
                <span>${node.title || node.url}</span>
            `;
            applyLinkIcon(item.querySelector('img'), node.url);

            container.appendChild(item);
        }
        else {
            const folder = document.createElement("div");
            folder.className = "bookmark-folder";

            const title = document.createElement("div");
            title.className = "folder-title";
            title.classList.add("glass-card");

            const folderIcon = document.createElement("div");
            folderIcon.innerHTML = `
                <?xml version="1.0" encoding="UTF-8"?><svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 409.02 347.44"><defs><style>.cls-1{fill:var(--bookmark-text-color);}</style></defs><path class="cls-1" d="M0,303.29V44.6C4.66,19.56,23.49,2.41,49.07.65c29.95,1.69,62.16-2.15,91.84.04,35.89,2.65,49.84,37.23,74.25,57.5,4.53,3.77,7.59,5.16,13.56,5.6,42.76,3.18,89.82-3.22,132.61-.07,24.55,1.81,45.15,21.34,47.46,45.95-.83,66.3,1.74,132.98-1.31,199.07-4.66,18.9-20.38,33.22-39.19,37.46-109.07,1.63-218.7,1.67-327.76-.02-19.79-3.68-38.24-22.69-40.53-42.91v.02ZM47.72,32.03c-8.74,1.55-16.15,8.67-16.6,17.73v248.37c.53,9.87,9.16,17.35,18.76,17.96,104.75-.74,209.83,1.35,314.39-1.05,7.23-2.52,13.23-8.96,13.43-16.92V112.83c-.36-9.52-8.75-17.15-17.96-17.97l-136.35-.19c-27.16-3.06-47.07-33.72-65.27-52.1-5.52-5.57-9.5-10.02-17.95-10.79-29.25-2.67-62.76,1.9-92.44.24h-.01Z"/></svg>
            `;
            folderIcon.className = "folder-icon";

            const text = document.createElement("span");
            text.innerText = node.title || "Folder";

            title.appendChild(folderIcon);
            title.appendChild(text);

            const childrenContainer = renderBookmarkChildren(node.children, node.id);

            folder.appendChild(title);
            folder.appendChild(childrenContainer);
            attachSmartHover(folder, childrenContainer, true);

            container.appendChild(folder);
        }
    }

    return container;
}

function renderBookmarkChildren(nodes, folderId) {
    const container = document.createElement("div");
    container.classList.add("bookmark-children");
    container.classList.add("glass-card");
    container.dataset.folderId = folderId;

    for (const node of nodes) {
        if (node.url) {
            const item = document.createElement("a");
            item.setAttribute("href", node.url);
            item.className = "bookmark-item";
            item.draggable = true;
            item.dataset.bmId = node.id;
            item.innerHTML = `
                <img alt="${node.title || node.url}">
                <span>${node.title || node.url}</span>
            `;
            applyLinkIcon(item.querySelector('img'), node.url);

            container.appendChild(item);
        }
        else {
            const folder = document.createElement("div");
            folder.className = "bookmark-folder";
            folder.draggable = true;
            folder.dataset.bmId = node.id;

            const title = document.createElement("div");
            title.className = "folder-title";

            const folderIcon = document.createElement("div");
            folderIcon.innerHTML = `
                <?xml version="1.0" encoding="UTF-8"?><svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 409.02 347.44"><defs><style>.cls-1{fill:var(--bookmark-text-color);}</style></defs><path class="cls-1" d="M0,303.29V44.6C4.66,19.56,23.49,2.41,49.07.65c29.95,1.69,62.16-2.15,91.84.04,35.89,2.65,49.84,37.23,74.25,57.5,4.53,3.77,7.59,5.16,13.56,5.6,42.76,3.18,89.82-3.22,132.61-.07,24.55,1.81,45.15,21.34,47.46,45.95-.83,66.3,1.74,132.98-1.31,199.07-4.66,18.9-20.38,33.22-39.19,37.46-109.07,1.63-218.7,1.67-327.76-.02-19.79-3.68-38.24-22.69-40.53-42.91v.02ZM47.72,32.03c-8.74,1.55-16.15,8.67-16.6,17.73v248.37c.53,9.87,9.16,17.35,18.76,17.96,104.75-.74,209.83,1.35,314.39-1.05,7.23-2.52,13.23-8.96,13.43-16.92V112.83c-.36-9.52-8.75-17.15-17.96-17.97l-136.35-.19c-27.16-3.06-47.07-33.72-65.27-52.1-5.52-5.57-9.5-10.02-17.95-10.79-29.25-2.67-62.76,1.9-92.44.24h-.01Z"/></svg>
            `;
            folderIcon.className = "folder-icon";

            const text = document.createElement("span");
            text.innerText = node.title || "Folder";

            title.appendChild(folderIcon);
            title.appendChild(text);

            const childrenContainer = renderBookmarkChildren(node.children || [], node.id);

            folder.appendChild(title);
            folder.appendChild(childrenContainer);
            attachSmartHover(folder, childrenContainer, false);

            container.appendChild(folder);
        }
    }

    if (folderId) attachDragSort(container, folderId);

    return container;
}
