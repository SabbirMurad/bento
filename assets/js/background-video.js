const DB_NAME = "themeDB";
const STORE_NAME = "videos";
const VIDEO_KEY = "backgroundVideo";

const preset_backgrounds = ['Tokyo Midnight Rain', 'Dark King and the Crown of Thorns'];

// Which one a profile that has never chosen a background ends up on. Named
// rather than "the first preset", because the store hands them back in key
// order and dark-king sorts ahead of tokyo.
const DEFAULT_PRESET = 'Tokyo Midnight Rain';

const presetId = name => `preset-${toDashCase(name)}`;

// Bump when preset_backgrounds changes, or when anything about a stored preset
// record does — the paths below are written into IndexedDB once and read back
// forever after, so a thumbnail that changes extension without a bump is a 404
// on every install that already ran. The flag this replaces was a boolean — it
// could only say that presets had been put in at some point, so a profile that
// had already run kept the ones it got the first time and never saw a change to
// the list. Anyone who ran the old build is still holding three presets whose
// files no longer ship.
const PRESETS_VERSION = 3;
const videoInput = document.querySelector("#settings-sidebar .video-selector #videoInput")

// Open DB
//
// One connection, opened once and shared. Every caller used to open its own,
// so a first run fired several upgrade requests at the same time and the
// callbacks came back in a different order than on any later load — which is
// why the bug below only ever showed itself once per profile.
let dbPromise;

function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains("videos")) {
                db.createObjectStore("videos", { keyPath: "id" });
            }

            if (!db.objectStoreNames.contains("settings")) {
                db.createObjectStore("settings");
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    return dbPromise;
}

async function generateVideoThumbnail(file) {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.src = URL.createObjectURL(file);
        video.muted = true;
        video.currentTime = 1;

        video.onloadeddata = () => {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            canvas
                .getContext("2d")
                .drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(blob => resolve(blob), "image/png");
        };
    });
}

async function saveUserVideo(file) {
    const db = await openDB();
    const thumbnail = await generateVideoThumbnail(file);

    const videoObj = {
        id: crypto.randomUUID(),
        type: "user",
        name: file.name,
        videoSrc: file,
        thumbnail,
        createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
        const tx = db.transaction("videos", "readwrite");
        tx.objectStore("videos").add(videoObj);
        tx.oncomplete = () => resolve(videoObj);
        tx.onerror = reject;
    });
}

// Awaiting this used to tell you nothing: the function handed back a resolved
// promise as soon as it had registered a callback, so the presets went in some
// time after whoever awaited it had already moved on and drawn the gallery.
function idbRequest(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function idbDone(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Brings the stored presets in line with the list above: puts what ships now,
// takes out presets that no longer do. Anything the user uploaded is left
// alone — only entries marked type "preset" are ours to remove.
async function syncPresetVideos() {
    const db = await openDB();

    const version = await idbRequest(
        db.transaction("settings", "readonly").objectStore("settings").get("presetsVersion")
    );
    if (version === PRESETS_VERSION) return;

    const wanted = new Map(preset_backgrounds.map(name => [presetId(name), name]));

    // Read in its own transaction and finish before opening the write one. An
    // await inside a live transaction is how you get TransactionInactiveError.
    const existing = await loadAllVideos();
    const stale = existing
        .filter(video => video.type === "preset" && !wanted.has(video.id))
        .map(video => video.id);

    const tx = db.transaction("videos", "readwrite");
    const store = tx.objectStore("videos");

    stale.forEach(id => store.delete(id));

    wanted.forEach((name, id) => {
        store.put({
            id,
            type: "preset",
            name,
            videoSrc: `assets/video/${toDashCase(name)}.mp4`,
            thumbnail: `assets/video/${toDashCase(name)}.webp`
        });
    });

    await idbDone(tx);

    const flagTx = db.transaction("settings", "readwrite");
    flagTx.objectStore("settings").put(PRESETS_VERSION, "presetsVersion");
    // The boolean this replaced would otherwise sit there forever meaning
    // nothing to anyone.
    flagTx.objectStore("settings").delete("presetsInserted");
    await idbDone(flagTx);
}

async function loadAllVideos() {
    const db = await openDB();

    return new Promise(resolve => {
        const tx = db.transaction("videos", "readonly");
        const request = tx.objectStore("videos").getAll();
        request.onsuccess = () => resolve(request.result);
    });
}

// Two renders can be in flight at once — selectVideo calls this, and so does
// startup. The old version emptied the wrapper up here and only appended after
// two awaits, so both could get past the clear before either filled it, and
// every background ended up on the page twice. It righted itself on the next
// load because by then the presets existed and the two calls no longer
// overlapped.
//
// Now nothing is written until the data is in hand, the whole list goes in as
// one replacement, and a render that has been overtaken drops out instead of
// appending on top of the newer one.
let galleryRenderToken = 0;

async function renderVideoGallery() {
    const wrapper = document.querySelector('.available-videos');
    const token = ++galleryRenderToken;

    const videos = await loadAllVideos();
    const selectedId = await getSelectedVideoId();

    if (token !== galleryRenderToken) return;

    const fragment = document.createDocumentFragment();

    videos.forEach(video => {
        const item = document.createElement("div");
        item.className = `item ${video.id === selectedId ? "active" : ""}`;

        const isSelected = video.id === selectedId;

        if (isSelected) item.classList.add('selected');

        const thumbSrc =
            video.type === "user"
                ? URL.createObjectURL(video.thumbnail)
                : video.thumbnail;

        item.innerHTML = `
            <div class="bg-wrapper">
              <img class="background">
              <div class="overlay"></div>
              <img src="/assets/icon/check-circle.svg" class="check">
            </div>
            <p></p>
        `;

        // Set rather than interpolated: a name is whatever the uploaded file
        // was called, which is not something to paste into markup.
        item.querySelector('.background').src = thumbSrc;
        item.querySelector('p').textContent = video.name;

        item.onclick = () => selectVideo(video);
        fragment.appendChild(item);
    });

    wrapper.replaceChildren(fragment);
}

async function setSelectedVideo(id) {
    const db = await openDB();
    const tx = db.transaction("settings", "readwrite");
    tx.objectStore("settings").put(id, "selectedVideo");
}

async function getSelectedVideoId() {
    const db = await openDB();
    const tx = db.transaction("settings", "readonly");
    return new Promise(resolve => {
        const req = tx.objectStore("settings").get("selectedVideo");
        req.onsuccess = () => resolve(req.result);
    });
}

async function selectVideo(video) {
    const videoElement = document.getElementById("bg-video");

    videoElement.src =
        video.type === "user"
            ? URL.createObjectURL(video.videoSrc)
            : video.videoSrc;

    await setSelectedVideo(video.id);
    renderVideoGallery();
}

videoInput.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;

    const video = await saveUserVideo(file);
    await selectVideo(video);
});

// One sequence rather than two that raced: the presets have to be in the store
// before anything can look for a video to play, and both of those have to be
// settled before the gallery is worth drawing. selectVideo renders on its way
// out, so the only path with nothing to select does the drawing itself.
(async () => {
    await syncPresetVideos();

    const videos = await loadAllVideos();
    const selectedId = await getSelectedVideoId();

    const video =
        videos.find(v => v.id === selectedId)
        // Nothing chosen yet, or what was chosen was a preset that has since
        // stopped shipping and been cleared out from under it.
        || videos.find(v => v.id === presetId(DEFAULT_PRESET))
        || videos.find(v => v.type === "preset")
        || videos[0];

    if (video) await selectVideo(video);
    else await renderVideoGallery();
})();