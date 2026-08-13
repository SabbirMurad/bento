// Mirrors your settings into chrome.storage.sync, so signing into Chrome on
// another machine brings your page with it. Shortcuts and bookmark order
// already synced; the clock face, colours, positions, Google picks and widget
// visibility did not, which meant a second machine got your links but a
// factory-default page.
//
// Settings stay in localStorage as the working copy. Everything downstream
// reads them synchronously while it starts, and chrome.storage.sync is async,
// so making it the primary store would mean restructuring every read site.

// Settings belonging to features that have since been taken out. Deleting one
// locally is not enough on its own: the snapshot on another machine still
// carries it, and the pull below writes back every key it is given — so a
// removed setting would reappear on the next load, and go on being exported
// and synced forever. Listed here so all three paths can agree on it.
const RETIRED_KEYS = new Set([
    // The music player, removed in 127e813.
    'musicPlayerData',
]);

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

// Runs down here rather than beside the list, because schedulePush touches
// pushTimer and that is only declared above this point.
(function forgetRetiredKeys() {
    let removedAny = false;

    RETIRED_KEYS.forEach(key => {
        if (localStorage.getItem(key) === null) return;
        // The unpatched remover, so this does not schedule a push of its own
        // before the pull has had its chance.
        nativeRemoveItem(key);
        removedAny = true;
    });

    // Worth one push: it takes the key out of the copy in chrome.storage.sync
    // too, instead of leaving it there to be filtered on every future pull.
    if (removedAny) schedulePush();
})();

(async () => {
    if (!syncStore) {
        resolvePull();
        return;
    }

    try {
        const stored = (await chrome.storage.sync.get(SETTINGS_SYNC_KEY))[SETTINGS_SYNC_KEY];
        const localStamp = Number(localStorage.getItem(SETTINGS_STAMP_KEY) || 0);

        if (stored && stored.values && stored.at > localStamp) {
            Object.entries(stored.values).forEach(([key, value]) => {
                if (RETIRED_KEYS.has(key)) return;
                nativeSetItem(key, value);
            });
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
