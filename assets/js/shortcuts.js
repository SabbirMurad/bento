// ---------------------------
// Helper: Get domain
// ---------------------------
function getDomain(url) {
    try {
        const { hostname } = new URL(url);
        return hostname;
    } catch {
        return null;
    }
}


// ---------------------------
// Load shortcuts (async)
// ---------------------------
async function loadShortcuts() {
    const shortcutsWrapper = document.querySelector('#shortcuts-wrapper');
    const sidebarShortcutsWrapper = document.querySelector('#shortcut-sidebar-overlay .shortcuts-wrapper');

    // GET SHORTCUTS FROM CHROME STORAGE
    let { shortcuts } = await chrome.storage.sync.get("shortcuts");
    if (!shortcuts) shortcuts = [];

    shortcutsWrapper.innerHTML = `
        <div class="item glass-card add-more">
            <img src="assets/icon/edit.svg" alt="Add">
        </div>
    `;

    const editBtn = shortcutsWrapper.querySelector('.add-more');
    editBtn.addEventListener('click', () => {
        overlay.classList.remove('hidden');
        overlay.classList.add('show');
    });

    sidebarShortcutsWrapper.innerHTML = '';

    // Render shortcuts
    for (let i = shortcuts.length - 1; i >= 0; i--) {
        const url = shortcuts[i];

        let faviconLink = "assets/icon/web.svg";
        let domain = getDomain(url);
        if (domain) {
            let fav = getFavicon(domain);
            if (fav) faviconLink = fav;
        }

        // MAIN SHORTCUT LIST
        const shortcut = document.createElement('a');
        shortcut.href = url;
        shortcut.classList.add('item', 'glass-card');
        shortcut.innerHTML = `
            <div class="container">
                <img src="${faviconLink}" alt="Shortcut">
            <div/>
        `;
        shortcutsWrapper.prepend(shortcut);


        // SIDEBAR LIST
        const sidebarShortcuts = document.createElement('div');
        sidebarShortcuts.classList.add('item-wrapper');
        sidebarShortcuts.setAttribute("draggable", "true");
        sidebarShortcuts.innerHTML = `
            <img src="assets/icon/drug.svg" alt="Drag" draggable="false">
            <div class="item">
                <img src="${faviconLink}" alt="Shortcut">
                <span>${url}</span>
                <img class="close" src="assets/icon/close.svg" alt="Close">
            </div>
        `;

        // DELETE BUTTON
        const closeBtn = sidebarShortcuts.querySelector('.close');
        closeBtn.addEventListener('click', () => removeShortcut(url));

        sidebarShortcutsWrapper.prepend(sidebarShortcuts);
    }
}

// Initial load
loadShortcuts();


// ---------------------------
// Remove shortcut
// ---------------------------
// Shared by the sidebar's input and the console's "shortcut add", so the two
// cannot drift. Normalising before the duplicate check matters: comparing the
// raw text but storing the normalised form let "github.com" be added again
// and again, since the stored "https://github.com" never matched it.
async function addShortcut(url) {
    const full = addHttpToUrl(url.trim());

    let { shortcuts } = await chrome.storage.sync.get("shortcuts");
    if (!shortcuts) shortcuts = [];

    if (shortcuts.includes(full)) return { url: full, added: false };

    shortcuts.push(full);
    await chrome.storage.sync.set({ shortcuts });
    loadShortcuts();

    return { url: full, added: true };
}


async function removeShortcut(url) {
    let { shortcuts } = await chrome.storage.sync.get("shortcuts");
    if (!shortcuts) shortcuts = [];

    shortcuts = shortcuts.filter(x => x !== url);

    await chrome.storage.sync.set({ shortcuts });

    loadShortcuts();
}


// ---------------------------
// Sidebar open/close
// ---------------------------
const overlay = document.getElementById('shortcut-sidebar-overlay');
const addButton = document.querySelector('#shortcuts-wrapper .add-more');

addButton.onclick = () => {
    overlay.classList.remove('hidden');
    overlay.classList.add('show');
};

overlay.onclick = e => {
    if (e.target === overlay) {
        overlay.classList.remove('show');
        setTimeout(() => overlay.classList.add('hidden'), 250);
    }
};


// ---------------------------
// Drag + drop sortable list
// ---------------------------
const sortableList = document.querySelector('#shortcut-sidebar-overlay .shortcuts-wrapper');
let draggedItem = null;

sortableList.addEventListener("dragstart", (e) => {
    if (e.target.classList.contains("item-wrapper")) {
        draggedItem = e.target;
        e.target.classList.add("dragging");
    }
});

sortableList.addEventListener("dragend", (e) => {
    if (draggedItem) {
        draggedItem.classList.remove("dragging");
        draggedItem = null;
    }
});

sortableList.addEventListener("dragover", (e) => {
    e.preventDefault();
    const items = [...sortableList.querySelectorAll('.item-wrapper:not(.dragging)')];
    const mouseY = e.clientY;

    let nextItem = items.find(item => {
        const rect = item.getBoundingClientRect();
        return mouseY < rect.top + rect.height / 2;
    });

    if (nextItem) {
        sortableList.insertBefore(draggedItem, nextItem);
    } else {
        sortableList.appendChild(draggedItem);
    }
});

// SAVE NEW ORDER TO CHROME SYNC
sortableList.addEventListener("dragend", async () => {
    let newOrder = [];

    sortableList.querySelectorAll(".item-wrapper span").forEach(el => {
        newOrder.push(el.textContent);
    });

    await chrome.storage.sync.set({ shortcuts: newOrder });

    loadShortcuts();
});


// ---------------------------
// Add new shortcut
// ---------------------------
const urlInput = document.querySelector('#shortcut-sidebar-overlay #shortcut-url-input');

urlInput.addEventListener('keypress', async (e) => {
    const url = e.target.value.trim();
    if (e.key === "Enter" && url) {
        await addShortcut(url);
        urlInput.value = '';
    }
})

// addShortcutBtn.addEventListener('click', async () => {
//     const url = urlInput.value.trim();

//     if (!url) return;

//     let { shortcuts } = await chrome.storage.sync.get("shortcuts");
//     if (!shortcuts) shortcuts = [];

//     if (!shortcuts.includes(url)) shortcuts.push(url);

//     await chrome.storage.sync.set({ shortcuts });

//     loadShortcuts();
//     urlInput.value = '';
// });