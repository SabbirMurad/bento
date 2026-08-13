// Export and import your setup as a file.
//
// State is spread across three stores: settings in localStorage, shortcuts and
// bookmark order in chrome.storage.sync, and the background image or video in
// IndexedDB. A backup reaches the first two. The background media is left out
// on purpose — a video would turn a small settings file into a large one, and
// the point of this is to be easy to keep somewhere safe.

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

    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        settings,
        synced,
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
