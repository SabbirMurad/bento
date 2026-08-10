// Mirrors your settings into chrome.storage.sync, so signing into Chrome on
// another machine brings your page with it. Shortcuts and bookmark order
// already synced; the clock face, colours, positions, Google picks and widget
// visibility did not, which meant a second machine got your links but a
// factory-default page.
//
// Settings stay in localStorage as the working copy. Everything downstream
// reads them synchronously while it starts, and chrome.storage.sync is async,
// so making it the primary store would mean restructuring every read site.

const SETTINGS_SYNC_KEY = 'bento-settings';
const SETTINGS_STAMP_KEY = 'settings-synced-at';
const SETTINGS_PUSH_DELAY = 1500;
// chrome.storage.sync rejects any single item over 8KB.
const SETTINGS_MAX_BYTES = 7500;

const syncStore = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;

// Patched below, so the originals are kept to write without re-triggering a push.
const nativeSetItem = localStorage.setItem.bind(localStorage);
const nativeRemoveItem = localStorage.removeItem.bind(localStorage);

function settingsSnapshot() {
    const values = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== SETTINGS_STAMP_KEY) values[key] = localStorage.getItem(key);
    }
    return values;
}

// Nothing may be pushed until the pull has been given its chance, or a write
// during startup would stamp local as the newest and bury a newer snapshot
// from another machine before it was ever read.
let resolvePull;
const pullSettled = new Promise(resolve => { resolvePull = resolve; });

let pushTimer;

async function pushSettings() {
    await pullSettled;
    if (!syncStore) return;

    const payload = { at: Date.now(), values: settingsSnapshot() };
    const size = JSON.stringify(payload).length;

    if (size > SETTINGS_MAX_BYTES) {
        console.warn(`[bento] settings are ${size} bytes, over the ${SETTINGS_MAX_BYTES} chrome.storage.sync allows for one item — not syncing`);
        return;
    }

    try {
        await chrome.storage.sync.set({ [SETTINGS_SYNC_KEY]: payload });
        nativeSetItem(SETTINGS_STAMP_KEY, String(payload.at));
    } catch (error) {
        console.warn('[bento] could not sync settings:', error.message);
    }
}

function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushSettings, SETTINGS_PUSH_DELAY);
}

// Every setting in the project is written through localStorage. Patching the
// two writers here means a setting added later syncs without anyone
// remembering to wire it up, which a saveSetting() helper would not.
localStorage.setItem = (key, value) => {
    nativeSetItem(key, value);
    if (key !== SETTINGS_STAMP_KEY) schedulePush();
};

localStorage.removeItem = key => {
    nativeRemoveItem(key);
    schedulePush();
};

(async () => {
    if (!syncStore) {
        resolvePull();
        return;
    }

    try {
        const stored = (await chrome.storage.sync.get(SETTINGS_SYNC_KEY))[SETTINGS_SYNC_KEY];
        const localStamp = Number(localStorage.getItem(SETTINGS_STAMP_KEY) || 0);

        if (stored && stored.values && stored.at > localStamp) {
            Object.entries(stored.values).forEach(([key, value]) => nativeSetItem(key, value));
            nativeSetItem(SETTINGS_STAMP_KEY, String(stored.at));

            // The page has already read localStorage and drawn itself by now,
            // and there is no way to hand it a new set of values afterwards.
            // Reloading is the honest option; it only happens when another
            // machine actually saved something newer, and the stamp written
            // above stops it happening twice.
            resolvePull();
            location.reload();
            return;
        }
    } catch (error) {
        console.warn('[bento] could not read synced settings:', error.message);
    }

    resolvePull();
})();
