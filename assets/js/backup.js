// Export and import your setup as a file.
//
// State is spread across three stores: settings in localStorage, shortcuts and
// bookmark order in chrome.storage.sync, and the background image or video in
// IndexedDB. A backup reaches the first two, plus the part of the third that is
// cheap to carry: a video added by URL is just a link, so it travels with the
// rest. An uploaded video is the file itself — that would turn a small settings
// file into a large one, so those are left out on purpose.

const BACKUP_FORMAT = 'bento-backup';
const BACKUP_VERSION = 1;

const exportSettingsBtn = document.getElementById('export-settings');
const importSettingsBtn = document.getElementById('import-settings');
const importSettingsFile = document.getElementById('import-settings-file');
const backupStatus = document.getElementById('backup-status');

let backupStatusTimer;

function showBackupStatus(message, isError = false) {
    backupStatus.textContent = message;
    backupStatus.classList.toggle('error', isError);

    clearTimeout(backupStatusTimer);
    backupStatusTimer = setTimeout(() => {
        backupStatus.textContent = '';
        backupStatus.classList.remove('error');
    }, 6000);
}

async function buildBackup() {
    const settings = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // The sync stamp describes this machine's relationship to
        // chrome.storage.sync, which means nothing on the machine restoring it.
        if (key !== SETTINGS_STAMP_KEY) settings[key] = localStorage.getItem(key);
    }

    let synced = {};
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        synced = await chrome.storage.sync.get(null);
        // Rebuilt from `settings` on import; keeping it would just be a stale copy.
        delete synced[SETTINGS_SYNC_KEY];
    }

    // Only videos added by URL — an upload is a file sitting in IndexedDB, not
    // something a JSON backup should be carrying around.
    const allVideos = await loadAllVideos();
    const videos = allVideos
        .filter(video => video.type === 'url')
        .map(({ id, type, name, videoSrc, createdAt }) => ({ id, type, name, videoSrc, createdAt }));

    // Recorded even when it points at a preset or an upload that will not come
    // along for the ride — restoreBackup only acts on it when it resolves to
    // something that exists after import, and otherwise startup falls back the
    // same way it does for any selection that no longer resolves.
    const selectedVideoId = await getSelectedVideoId();

    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        settings,
        synced,
        videos,
        selectedVideoId,
    };
}

async function restoreBackup(backup) {
    if (!backup || backup.format !== BACKUP_FORMAT) {
        throw new Error('That is not a Bento backup file.');
    }
    if (typeof backup.settings !== 'object' || backup.settings === null) {
        throw new Error('That backup file is missing its settings.');
    }
    if (backup.version > BACKUP_VERSION) {
        throw new Error('That backup was made by a newer version of Bento.');
    }

    localStorage.clear();
    Object.entries(backup.settings).forEach(([key, value]) => {
        // A file exported before a feature was removed still carries its
        // settings; importing one should not bring them back. See RETIRED_KEYS
        // in sync.js.
        if (key === SETTINGS_STAMP_KEY || RETIRED_KEYS.has(key)) return;
        localStorage.setItem(key, String(value));
    });

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync && backup.synced) {
        await chrome.storage.sync.set(backup.synced);
    }

    if (Array.isArray(backup.videos) && backup.videos.length) {
        const db = await openDB();
        const tx = db.transaction('videos', 'readwrite');
        const store = tx.objectStore('videos');

        backup.videos.forEach(video => {
            // Only ever put back what we could have put in: a URL video,
            // shaped the way saveUrlVideo shapes one. Anything else in this
            // list did not come from us.
            if (!video || video.type !== 'url') return;
            if (typeof video.id !== 'string' || typeof video.videoSrc !== 'string') return;

            store.put({
                id: video.id,
                type: 'url',
                name: video.name || video.videoSrc,
                videoSrc: video.videoSrc,
                thumbnail: null,
                createdAt: video.createdAt,
            });
        });

        await idbDone(tx);
    }

    if (backup.selectedVideoId) {
        await setSelectedVideo(backup.selectedVideoId);
    }

    // Publish before reloading. Otherwise the next load pulls whatever is in
    // chrome.storage.sync, finds it newer than a freshly cleared local stamp,
    // and overwrites everything that was just imported.
    await pushSettings();
}

exportSettingsBtn.addEventListener('click', async () => {
    try {
        const backup = await buildBackup();
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `bento-settings-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();

        URL.revokeObjectURL(url);
        showBackupStatus('Settings exported.');
    } catch (error) {
        showBackupStatus(`Could not export: ${error.message}`, true);
    }
});

importSettingsBtn.addEventListener('click', () => importSettingsFile.click());

importSettingsFile.addEventListener('change', async () => {
    const file = importSettingsFile.files[0];
    if (!file) return;

    try {
        const backup = JSON.parse(await file.text());
        await restoreBackup(backup);
        showBackupStatus('Settings restored. Reloading…');
        setTimeout(() => location.reload(), 400);
    } catch (error) {
        const message = error instanceof SyntaxError ? 'That file is not valid JSON.' : error.message;
        showBackupStatus(`Could not import: ${message}`, true);
    } finally {
        // So picking the same file twice still fires a change event.
        importSettingsFile.value = '';
    }
});

// ---------------------------
// Built-in presets
// ---------------------------
// Each one is a backup file shipped with the extension rather than typed in —
// same format restoreBackup already knows how to read, so applying one is
// that function pointed at a bundled file instead of a picked one.
const PRESET_FILES = [
    'assets/presets/preset_1.json',
    'assets/presets/preset_2.json',
    'assets/presets/preset_3.json',
    'assets/presets/preset_4.json',
    'assets/presets/preset_5.json',
];

const presetGallery = document.querySelector('.preset-gallery');
const presetStatus = document.getElementById('preset-status');

let presetStatusTimer;

function showPresetStatus(message, isError = false) {
    presetStatus.textContent = message;
    presetStatus.classList.toggle('error', isError);

    clearTimeout(presetStatusTimer);
    presetStatusTimer = setTimeout(() => {
        presetStatus.textContent = '';
        presetStatus.classList.remove('error');
    }, 6000);
}

// Guards against a second tile being clicked mid-apply — restoreBackup clears
// localStorage partway through, so overlapping runs would race each other
// there rather than simply queueing.
let applyingPreset = false;

async function applyPreset(file, name) {
    if (applyingPreset) return;
    applyingPreset = true;
    showPresetStatus(`Applying ${name}…`);

    try {
        const response = await fetch(file);
        if (!response.ok) throw new Error(`${file} is missing from this build.`);

        const backup = await response.json();
        await restoreBackup(backup);

        showPresetStatus(`${name} applied. Reloading…`);
        setTimeout(() => location.reload(), 400);
    } catch (error) {
        showPresetStatus(`Could not apply ${name}: ${error.message}`, true);
        applyingPreset = false;
    }
}

function renderPresetGallery() {
    const fragment = document.createDocumentFragment();

    PRESET_FILES.forEach((file, index) => {
        const name = `Preset ${index + 1}`;

        const item = document.createElement('div');
        item.className = 'item';
        item.innerHTML = `
            <div class="bg-wrapper">
              <div class="thumbnail"></div>
            </div>
            <p></p>
        `;
        // No thumbnail image yet — see the .thumbnail placeholder in
        // settings.css. Set rather than interpolated, same reasoning as the
        // video gallery: nothing user-authored belongs pasted into markup.
        item.querySelector('p').textContent = name;
        item.onclick = () => applyPreset(file, name);

        fragment.appendChild(item);
    });

    presetGallery.replaceChildren(fragment);
}

if (presetGallery) renderPresetGallery();
