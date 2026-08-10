// Not registered in manifest.json while the music / YouTube player is off.
// See the note at the top of service-worker.js before re-enabling it.
(function () {
  let video = null;
  let hooked = false;

  function getVideo() {
    if (video && video.isConnected) return video;
    video = document.querySelector('video');
    return video;
  }

  function sendState(extra) {
    const v = getVideo();
    if (!v) return;
    chrome.runtime.sendMessage({
      type: 'ytState',
      isPlaying: !v.paused && !v.ended,
      currentTime: v.currentTime || 0,
      duration: v.duration || 0,
      ended: v.ended,
      ...extra,
    }).catch(() => {});
  }

  function hookVideo(v) {
    if (hooked) return;
    hooked = true;
    v.addEventListener('play',  () => sendState());
    v.addEventListener('pause', () => sendState());
    v.addEventListener('ended', () => sendState({ ended: true }));
    v.addEventListener('durationchange', () => sendState());
    setInterval(sendState, 500);
  }

  function waitForVideo() {
    const v = getVideo();
    if (v) { hookVideo(v); return; }
    const obs = new MutationObserver(() => {
      const v = getVideo();
      if (v) { obs.disconnect(); hookVideo(v); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const v = getVideo();
    if (!v) { sendResponse({ error: 'no video' }); return true; }
    if (msg.action === 'play')   v.play();
    if (msg.action === 'pause')  v.pause();
    if (msg.action === 'seek')   v.currentTime = msg.time;
    if (msg.action === 'volume') v.volume = Math.max(0, Math.min(1, msg.volume / 100));
    sendResponse({ ok: true });
    return true;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForVideo);
  } else {
    waitForVideo();
  }
})();
