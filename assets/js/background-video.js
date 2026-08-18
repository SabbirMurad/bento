const DB_NAME = "themeDB";
const STORE_NAME = "videos";
const VIDEO_KEY = "backgroundVideo";

// Presets are links, not shipped files — motionbgs.com serves them, so no
// video ever sits in the package. Each is exactly what saveUrlVideo would have
// stored had someone pasted the link in by hand.
const preset_backgrounds = [
    { name: 'Tokyo Midnight Rain', url: 'https://motionbgs.com/media/9963/tokyo-midnight-rain.1920x1080.mp4' },
    { name: 'Divine General Mahoraga', url: 'https://motionbgs.com/media/7041/divine-general-mahoraga.1920x1080.mp4' },
    { name: 'Spider-Man Marvel Rivals', url: 'https://motionbgs.com/media/7245/spider-man-marvel-rivals.1920x1080.mp4' },
    { name: 'Dark King and the Crown of Thorns', url: 'https://motionbgs.com/media/9821/dark-king-and-the-crown-of-thorns.1920x1080.mp4' },
    { name: 'Dark Queen', url: 'https://motionbgs.com/media/9230/dark-queen.1920x1080.mp4' },
    { name: 'Celestial Veil', url: 'https://motionbgs.com/media/8626/celestial-veil.1920x1080.mp4' },
    { name: 'Gabimaru Hollow Flame', url: 'https://motionbgs.com/media/9357/gabimaru-hollow-flame.1920x1080.mp4' },
    { name: 'Ayanami Rei Beneath Blue Light', url: 'https://motionbgs.com/media/8773/ayanami-rei-beneath-blue-light.1920x1080.mp4' },
    { name: 'Girl and Toyota AE86', url: 'https://motionbgs.com/media/9837/girl-and-toyota-ae86.1920x1080.mp4' },
    { name: 'Luffy Meditation', url: 'https://motionbgs.com/media/8623/luffy-meditation.1920x1080.mp4' },
    { name: 'Totoro on Top of a Tree', url: 'https://motionbgs.com/media/135/totoro-on-top-of-a-tree.1920x1080.mp4' },
    { name: 'Confused Frieren', url: 'https://motionbgs.com/media/8868/confused-frieren.1920x1080.mp4' },
    { name: 'Evelyn', url: 'https://motionbgs.com/media/9217/evelyn.1920x1080.mp4' },
    { name: 'Sleeping Among Flowers', url: 'https://motionbgs.com/media/9851/sleeping-among-flowers.1920x1080.mp4' },
    { name: 'Glitch Queen Awakens', url: 'https://motionbgs.com/media/8765/glitch-queen-awakens.1920x1080.mp4' },
    { name: 'Monochrome Daydreams', url: 'https://motionbgs.com/media/9693/monochrome-daydreams.1920x1080.mp4' },
    { name: 'Crimson Silence', url: 'https://motionbgs.com/media/9097/crimson-silence.1920x1080.mp4' },
];

// Which one a profile that has never chosen a background ends up on. Named
// rather than "the first preset", because the store hands them back in key
// order and that is alphabetical over the preset ids, not the order they are
// listed above.
const DEFAULT_PRESET = 'Tokyo Midnight Rain';

const presetId = name => `preset-${toDashCase(name)}`;

// Bump when preset_backgrounds changes, or when anything about a stored preset
// record does — the records below are written into IndexedDB once and read
// back forever after, so a link that changes extension without a bump is a
// dead preset on every install that already ran. The flag this replaces was a
// boolean — it could only say that presets had been put in at some point, so a
// profile that had already run kept the ones it got the first time and never
// saw a change to the list.
const PRESETS_VERSION = 5;
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

// A still of the first second, kept as a blob so the gallery costs nothing to
// draw. Only for uploads: reading pixels back out of a video is what a canvas
// will not do across origins, which is why a video added by URL carries no
// thumbnail and is drawn from the video itself instead.
//
// Resolves with null rather than hanging if the file turns out not to be
// playable. It used to have no error path at all, so a file the decoder
// refused left this promise pending for the life of the page and the upload
// it was awaited by simply never finished.
async function generateVideoThumbnail(file) {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.src = URL.createObjectURL(file);
        video.muted = true;
        video.currentTime = 1;

        video.onerror = () => resolve(null);

        video.onloadeddata = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                canvas
                    .getContext("2d")
                    .drawImage(video, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(blob => resolve(blob), "image/png");
            } catch {
                resolve(null);
            }
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

// How long a URL gets to prove it is a video before it is turned away. Only
// metadata is asked for, so this is a headers-and-a-few-KB round trip, not a
// download — but a host that accepts the connection and then says nothing
// would otherwise leave the Add button spinning forever.
const VIDEO_URL_PROBE_MS = 15000;

// Loads far enough to know the URL really is a playable video, and hands back
// its dimensions and duration. Everything the extension shows about a video by
// URL comes from the video itself, so this doubles as the check that there is
// anything there at all — a link that 404s, points at a web page, or holds a
// codec this build cannot decode is rejected here rather than stored and left
// to fail silently on the page every time a tab opens.
function probeVideoUrl(url) {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        let timer;

        const done = outcome => {
            clearTimeout(timer);
            video.onloadedmetadata = null;
            video.onerror = null;
            // Stops the fetch that is still in flight when this rejects.
            video.removeAttribute("src");
            video.load();
            outcome();
        };

        video.preload = "metadata";
        video.muted = true;

        video.onloadedmetadata = () => {
            const { videoWidth, videoHeight, duration } = video;
            // An audio file loads metadata perfectly happily and then draws
            // nothing at all.
            if (!videoWidth || !videoHeight) {
                done(() => reject(new Error("That link has no picture in it.")));
                return;
            }
            done(() => resolve({ width: videoWidth, height: videoHeight, duration }));
        };

        video.onerror = () => done(() => reject(
            new Error("Could not play that link. It has to be a direct link to a video file.")
        ));

        timer = setTimeout(() => done(() => reject(
            new Error("That link took too long to answer.")
        )), VIDEO_URL_PROBE_MS);

        video.src = url;
    });
}

// The last path segment, which for a direct video link is the filename. Falls
// back to the host, so something recognisable always ends up under the
// thumbnail.
function nameFromVideoUrl(parsed) {
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : parsed.hostname;
}

async function saveUrlVideo(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl.trim());
    } catch {
        throw new Error("That is not a URL.");
    }

    // https only, and not out of preference. The new tab page is served from
    // chrome-extension://, which is a secure context, so a plain http video is
    // mixed content and blocked before it reaches the network — and media-src
    // in the page's own CSP allows https and nothing else remote. Saying so
    // here beats storing a link that can only ever fail.
    if (parsed.protocol !== "https:") {
        throw new Error("The link has to start with https.");
    }

    const existing = await loadAllVideos();
    const already = existing.find(video => video.type === "url" && video.videoSrc === parsed.href);
    if (already) return already;

    await probeVideoUrl(parsed.href);

    const db = await openDB();
    const videoObj = {
        id: crypto.randomUUID(),
        type: "url",
        name: nameFromVideoUrl(parsed),
        videoSrc: parsed.href,
        // Deliberately absent. See generateVideoThumbnail: a still cannot be
        // taken from another origin's video, so the gallery draws these from
        // the video element itself.
        thumbnail: null,
        createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
        const tx = db.transaction("videos", "readwrite");
        tx.objectStore("videos").add(videoObj);
        tx.oncomplete = () => resolve(videoObj);
        tx.onerror = () => reject(tx.error);
    });
}

// Presets are not deletable: syncPresetVideos only puts them back when
// PRESETS_VERSION changes, so a deleted one would stay gone for good rather
// than until the next reload.
async function deleteVideo(id) {
    const db = await openDB();
    const tx = db.transaction("videos", "readwrite");
    tx.objectStore("videos").delete(id);
    await idbDone(tx);

    // Whatever was showing has just stopped existing, so fall back the same
    // way startup does when nothing has been chosen yet.
    if (await getSelectedVideoId() === id) {
        const videos = await loadAllVideos();
        const next = videos.find(v => v.id === presetId(DEFAULT_PRESET))
            || videos.find(v => v.type === "preset")
            || videos[0];

        if (next) {
            await selectVideo(next);
            return;
        }

        document.getElementById("bg-video").removeAttribute("src");
        await setSelectedVideo(null);
    }

    renderVideoGallery();
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

    const wanted = new Map(preset_backgrounds.map(preset => [presetId(preset.name), preset]));

    // Read in its own transaction and finish before opening the write one. An
    // await inside a live transaction is how you get TransactionInactiveError.
    const existing = await loadAllVideos();
    const stale = existing
        .filter(video => video.type === "preset" && !wanted.has(video.id))
        .map(video => video.id);

    const tx = db.transaction("videos", "readwrite");
    const store = tx.objectStore("videos");

    stale.forEach(id => store.delete(id));

    wanted.forEach(({ name, url }, id) => {
        store.put({
            id,
            type: "preset",
            name,
            videoSrc: url,
            // No local still to point at — see generateVideoThumbnail. The
            // gallery draws these from the video itself, same as a video added
            // by URL.
            thumbnail: null
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

// One gallery per video type — Presets, Uploaded videos and Added links each
// get their own tab and their own tile grid, so a video only ever needs
// filtering by which .available-videos it belongs in, not by anything drawn
// into the tile itself.
function galleryWrapperFor(type) {
    return document.querySelector(`.available-videos[data-video-type="${type}"]`);
}

async function renderVideoGallery() {
    const token = ++galleryRenderToken;

    const videos = await loadAllVideos();
    const selectedId = await getSelectedVideoId();

    if (token !== galleryRenderToken) return;

    const fragments = {
        preset: document.createDocumentFragment(),
        user: document.createDocumentFragment(),
        url: document.createDocumentFragment(),
    };

    videos.forEach(video => {
        const item = document.createElement("div");
        item.className = `item ${video.id === selectedId ? "active" : ""}`;

        const isSelected = video.id === selectedId;

        if (isSelected) item.classList.add('selected');

        // A video with no stored still — added by URL, or a preset that is
        // itself just a URL — shows the opening of the video itself instead.
        // None can be taken across origins. Muted, never played, and asked
        // only for metadata: enough to seek to the first second and hold that
        // frame, which costs a range request rather than the download a
        // poster would have needed.
        const fromVideo = !video.thumbnail;

        item.innerHTML = `
            <div class="bg-wrapper">
              ${fromVideo
                ? '<video class="background" muted playsinline preload="metadata"></video>'
                : '<img class="background">'}
              <div class="overlay"></div>
              <img src="/assets/icon/check-circle.svg" class="check">
              ${video.type === "preset" ? '' : '<button class="remove" type="button" title="Remove">&times;</button>'}
            </div>
            <p></p>
        `;

        const background = item.querySelector('.background');

        if (fromVideo) {
            background.addEventListener('loadedmetadata', () => {
                // Past any fade-in at the very start, and clamped so a clip
                // shorter than a second still shows something.
                background.currentTime = Math.min(1, background.duration / 2 || 0);
            }, { once: true });
            background.src = video.videoSrc;
        } else {
            background.src = video.type === "user"
                ? URL.createObjectURL(video.thumbnail)
                : video.thumbnail;
        }

        // Set rather than interpolated: a name is whatever the uploaded file
        // was called or whatever the end of a URL happens to be, neither of
        // which is something to paste into markup.
        item.querySelector('p').textContent = video.name;
        item.title = video.type === "url" ? video.videoSrc : video.name;

        const removeBtn = item.querySelector('.remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', e => {
                // The whole tile selects the background it sits on.
                e.stopPropagation();
                deleteVideo(video.id);
            });
        }

        item.onclick = () => selectVideo(video);

        // Guards a type this build does not know about rather than throwing
        // and abandoning every video still left in the loop — the only way to
        // reach here is a record written by some other version of the
        // extension, never something saveUserVideo, saveUrlVideo or
        // syncPresetVideos wrote themselves.
        const bucket = fragments[video.type];
        if (bucket) bucket.appendChild(item);
    });

    Object.entries(fragments).forEach(([type, fragment]) => {
        const wrapper = galleryWrapperFor(type);
        if (wrapper) wrapper.replaceChildren(fragment);
    });
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

// ---------------------------
// Add a background by URL
// ---------------------------
const videoUrlInput = document.getElementById("video-url-input");
const videoUrlAddBtn = document.getElementById("video-url-add");
const videoUrlStatus = document.getElementById("video-url-status");

function setVideoUrlStatus(message, isError) {
    videoUrlStatus.textContent = message;
    videoUrlStatus.classList.toggle("error", !!isError);
}

async function addVideoByUrl() {
    const url = videoUrlInput.value.trim();
    if (!url) return;

    // The probe can take a moment on a slow host, and a button that looks
    // ready to press again is an invitation to store the same link twice.
    videoUrlAddBtn.disabled = true;
    setVideoUrlStatus("Checking the link…");

    try {
        const video = await saveUrlVideo(url);
        await selectVideo(video);

        videoUrlInput.value = "";
        setVideoUrlStatus(`Added ${video.name}.`);
    } catch (error) {
        setVideoUrlStatus(error.message, true);
    } finally {
        videoUrlAddBtn.disabled = false;
    }
}

videoUrlAddBtn.addEventListener("click", addVideoByUrl);

videoUrlInput.addEventListener("keydown", e => {
    if (e.key === "Enter") addVideoByUrl();
});

// A message about the last link is only noise once the box holds a different
// one.
videoUrlInput.addEventListener("input", () => setVideoUrlStatus(""));

// Chrome throttles a hidden tab's timers and its rendering, but it does not
// stop the decoder — a looping 1080p background goes on costing CPU on every
// new tab the user has left open behind the one they are actually reading.
// Nothing is lost by stopping it: the video is muted, so the autoplay policy
// lets us start it again later without a user gesture.
const backgroundVideo = document.getElementById("bg-video");

function syncPlaybackToVisibility() {
    // Startup gets here before a background has been chosen, and there is
    // nothing to play until it has.
    if (!backgroundVideo.src) return;

    if (document.hidden) {
        backgroundVideo.pause();
        return;
    }

    // Rejects when a pause interrupts a start that is still in flight, which
    // switching tabs quickly does routinely. Not worth reporting, but left
    // uncaught it prints to the console every time it happens.
    backgroundVideo.play().catch(() => { });
}

document.addEventListener("visibilitychange", syncPlaybackToVisibility);

// A new tab page can be loaded without ever being looked at — middle-clicked
// into the background, or opened by a window that starts minimised — and the
// autoplay attribute does not care that nobody is watching. Catching it at the
// play event covers that whenever playback actually begins, which pausing
// straight after setting .src would not: the media load algorithm runs in a
// later task, and it is what starts the video in the first place.
backgroundVideo.addEventListener("play", () => {
    if (document.hidden) backgroundVideo.pause();
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