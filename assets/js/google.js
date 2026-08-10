// Every Google service the panel can show.
//
// `icon` is only set where the favicon service cannot do the job: Docs,
// Sheets, Slides and Forms all live on docs.google.com and therefore share a
// single favicon, and a few products have a nicer official logo than their
// favicon. Everything else derives its icon from the domain.
const GOOGLE_CATALOGUE = [
    { id: 'search', name: 'Search', url: 'https://www.google.com/' },
    { id: 'gmail', name: 'Gmail', url: 'https://mail.google.com/mail/u/0/#inbox', icon: '/assets/image/google/gmail.png' },
    { id: 'drive', name: 'Drive', url: 'https://drive.google.com/u/0/', icon: 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_drive_x32.png' },
    { id: 'docs', name: 'Docs', url: 'https://docs.google.com/document/u/0/', icon: 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_document_x32.png' },
    { id: 'sheets', name: 'Sheets', url: 'https://docs.google.com/spreadsheets/u/0/', icon: 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_spreadsheet_x32.png' },
    { id: 'slides', name: 'Slides', url: 'https://docs.google.com/presentation/u/0/', icon: 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_presentation_x32.png' },
    { id: 'forms', name: 'Forms', url: 'https://docs.google.com/forms/u/0/', icon: 'https://www.gstatic.com/images/branding/product/1x/forms_2020q4_48dp.png' },
    { id: 'calendar', name: 'Calendar', url: 'https://calendar.google.com/' },
    { id: 'keep', name: 'Keep', url: 'https://keep.google.com/' },
    { id: 'tasks', name: 'Tasks', url: 'https://tasks.google.com/embed/list/~default' },
    { id: 'contacts', name: 'Contacts', url: 'https://contacts.google.com/' },
    { id: 'meet', name: 'Meet', url: 'https://meet.google.com/' },
    { id: 'chat', name: 'Chat', url: 'https://mail.google.com/chat/u/0/', icon: 'https://www.gstatic.com/images/branding/product/1x/chat_2020q4_48dp.png' },
    { id: 'groups', name: 'Groups', url: 'https://groups.google.com/' },
    { id: 'photos', name: 'Photos', url: 'https://photos.google.com/' },
    { id: 'maps', name: 'Maps', url: 'https://maps.google.com/' },
    { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/' },
    { id: 'youtube-music', name: 'YT Music', url: 'https://music.youtube.com/' },
    { id: 'news', name: 'News', url: 'https://news.google.com/' },
    { id: 'translate', name: 'Translate', url: 'https://translate.google.com/' },
    { id: 'books', name: 'Books', url: 'https://books.google.com/' },
    { id: 'scholar', name: 'Scholar', url: 'https://scholar.google.com/' },
    { id: 'earth', name: 'Earth', url: 'https://earth.google.com/' },
    { id: 'play-store', name: 'Play Store', url: 'https://play.google.com/store' },
    { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app' },
    { id: 'ai-studio', name: 'AI Studio', url: 'https://aistudio.google.com/' },
    { id: 'notebooklm', name: 'NotebookLM', url: 'https://notebooklm.google.com/' },
    { id: 'colab', name: 'Colab', url: 'https://colab.research.google.com/' },
    { id: 'cloud', name: 'Cloud', url: 'https://console.cloud.google.com/', icon: 'https://www.gstatic.com/images/branding/product/1x/cloud_48dp.png' },
    { id: 'firebase', name: 'Firebase', url: 'https://console.firebase.google.com/u/0/', icon: 'https://www.gstatic.com/devrel-devsite/prod/v210625d4186b230b6e4f2892d2ebde056c890c9488f9b443a741ca79ae70171d/firebase/images/favicon.png' },
    { id: 'play-console', name: 'Play Console', url: 'https://play.google.com/console/u/0/', icon: 'https://www.gstatic.com/play-apps-publisher/play_console_favicon.png' },
    { id: 'apps-script', name: 'Apps Script', url: 'https://script.google.com/', icon: 'https://www.gstatic.com/images/branding/product/1x/apps_script_48dp.png' },
    { id: 'analytics', name: 'Analytics', url: 'https://analytics.google.com/' },
    { id: 'search-console', name: 'Search Console', url: 'https://search.google.com/search-console' },
    { id: 'ads', name: 'Ads', url: 'https://ads.google.com/' },
    { id: 'adsense', name: 'AdSense', url: 'https://www.google.com/adsense/' },
    { id: 'admob', name: 'AdMob', url: 'https://apps.admob.com/' },
    { id: 'classroom', name: 'Classroom', url: 'https://classroom.google.com/' },
    { id: 'sites', name: 'Sites', url: 'https://sites.google.com/' },
    { id: 'blogger', name: 'Blogger', url: 'https://www.blogger.com/' },
    { id: 'trends', name: 'Trends', url: 'https://trends.google.com/' },
    { id: 'alerts', name: 'Alerts', url: 'https://www.google.com/alerts' },
    { id: 'finance', name: 'Finance', url: 'https://www.google.com/finance' },
    { id: 'travel', name: 'Travel', url: 'https://www.google.com/travel' },
    { id: 'shopping', name: 'Shopping', url: 'https://shopping.google.com/' },
    { id: 'voice', name: 'Voice', url: 'https://voice.google.com/', icon: 'https://www.gstatic.com/images/branding/product/1x/voice_2020q4_48dp.png' },
    { id: 'one', name: 'One', url: 'https://one.google.com/' },
    { id: 'account', name: 'Account', url: 'https://myaccount.google.com/', icon: 'https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png' },
    { id: 'passwords', name: 'Passwords', url: 'https://passwords.google.com/' },
    { id: 'takeout', name: 'Takeout', url: 'https://takeout.google.com/' },
];

// What the panel shows before the user has picked anything. This is exactly
// the set that used to be hard-coded, so the panel does not change under
// anyone who upgrades — the rest of the catalogue is opt-in from Settings.
const GOOGLE_DEFAULT_ENABLED = ['sheets', 'docs', 'forms', 'drive', 'play-console', 'firebase', 'gmail'];

const GOOGLE_ITEMS_KEY = 'google-items';

const googleById = new Map(GOOGLE_CATALOGUE.map(item => [item.id, item]));

const googleItemsWrapper = document.querySelector('#google-wrapper .item-container');
const googleItemList = document.querySelector('#google-settings-wrapper .google-item-list');

// [{ id, on }] in display order.
let googleItemState = [];

function readGoogleItemState() {
    let saved = [];
    try {
        saved = JSON.parse(localStorage.getItem(GOOGLE_ITEMS_KEY)) || [];
    } catch {
        saved = [];
    }

    const savedOn = new Map();
    const order = [];

    saved.forEach(entry => {
        if (!entry || !googleById.has(entry.id) || savedOn.has(entry.id)) return;
        savedOn.set(entry.id, !!entry.on);
        order.push(entry.id);
    });

    // Services added to the catalogue since the user last saved go on the end,
    // switched off, so an update never changes the panel under them.
    GOOGLE_CATALOGUE.forEach(item => {
        if (!savedOn.has(item.id)) order.push(item.id);
    });

    return order.map(id => ({
        id,
        on: savedOn.has(id) ? savedOn.get(id) : GOOGLE_DEFAULT_ENABLED.includes(id),
    }));
}

function saveGoogleItemState() {
    localStorage.setItem(GOOGLE_ITEMS_KEY, JSON.stringify(googleItemState));
}

// Remote product icons rot, and the favicon service does not know every
// domain, so each image walks down to something that definitely renders.
function applyGoogleIcon(img, item) {
    img.src = item.icon || getFavicon(item.url);
    img.addEventListener('error', () => {
        if (img.dataset.iconStage === undefined && item.icon) {
            img.dataset.iconStage = 'favicon';
            img.src = getFavicon(item.url);
        } else if (img.dataset.iconStage !== 'local') {
            img.dataset.iconStage = 'local';
            img.src = 'assets/icon/web.svg';
        }
    });
}

function renderGooglePanel() {
    googleItemsWrapper.replaceChildren();

    googleItemState.filter(entry => entry.on).forEach(entry => {
        const item = googleById.get(entry.id);
        const link = document.createElement('a');
        link.className = 'item';
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.href = item.url;

        const img = document.createElement('img');
        img.alt = item.name;
        applyGoogleIcon(img, item);

        const label = document.createElement('span');
        label.textContent = item.name;

        link.append(img, label);
        googleItemsWrapper.appendChild(link);
    });
}

function renderGoogleItemList() {
    googleItemList.replaceChildren();

    googleItemState.forEach(entry => {
        const item = googleById.get(entry.id);

        const row = document.createElement('div');
        row.className = 'google-item-row';
        row.draggable = true;
        row.dataset.id = item.id;

        const handle = document.createElement('img');
        handle.className = 'handle';
        handle.src = 'assets/icon/drug.svg';
        handle.alt = 'Reorder';
        handle.draggable = false;

        const icon = document.createElement('img');
        icon.className = 'icon';
        icon.alt = '';
        icon.draggable = false;
        applyGoogleIcon(icon, item);

        const label = document.createElement('span');
        label.textContent = item.name;

        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = entry.on;
        check.addEventListener('change', () => {
            entry.on = check.checked;
            saveGoogleItemState();
            renderGooglePanel();
        });

        row.append(handle, icon, label, check);
        googleItemList.appendChild(row);
    });
}

// ---------------------------
// Drag to reorder
// ---------------------------
let draggedGoogleRow = null;

googleItemList.addEventListener('dragstart', e => {
    const row = e.target.closest('.google-item-row');
    if (!row) return;
    draggedGoogleRow = row;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
});

googleItemList.addEventListener('dragover', e => {
    if (!draggedGoogleRow) return;
    e.preventDefault();

    const rows = [...googleItemList.querySelectorAll('.google-item-row:not(.dragging)')];
    const next = rows.find(row => {
        const box = row.getBoundingClientRect();
        return e.clientY < box.top + box.height / 2;
    });

    if (next) {
        googleItemList.insertBefore(draggedGoogleRow, next);
    } else {
        googleItemList.appendChild(draggedGoogleRow);
    }
});

googleItemList.addEventListener('dragend', () => {
    if (!draggedGoogleRow) return;
    draggedGoogleRow.classList.remove('dragging');
    draggedGoogleRow = null;

    // Reorder the state to match the list, keeping each row's checked value.
    const onById = new Map(googleItemState.map(entry => [entry.id, entry.on]));
    googleItemState = [...googleItemList.querySelectorAll('.google-item-row')]
        .map(row => ({ id: row.dataset.id, on: onById.get(row.dataset.id) }));

    saveGoogleItemState();
    renderGooglePanel();
});

googleItemState = readGoogleItemState();
renderGoogleItemList();
renderGooglePanel();
