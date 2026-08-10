// Not registered in manifest.json. It exists only for the music / YouTube
// player, which is off, and the permissions it needs ("declarativeNetRequest"
// plus host access to every site) are what makes a new tab extension look
// like it modifies browsing. Turning the player back on means restoring, in
// manifest.json: this file as "background.service_worker", the
// "declarativeNetRequest" permission, the content_scripts block pointing at
// content-script.js, host_permissions for YouTube, and the player-sandbox
// entry. Note the player also loads https://www.youtube.com/iframe_api, which
// is remote code and not allowed under MV3 — that needs solving first.
chrome.runtime.onInstalled.addListener(setupYouTubeRule);
chrome.runtime.onStartup.addListener(setupYouTubeRule);

async function setupYouTubeRule() {
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1001],
      addRules: [{
        id: 1001,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'Referer', operation: 'set', value: 'https://www.youtube.com/' }
          ]
        },
        condition: {
          urlFilter: '*youtube-nocookie.com/embed/*',
          resourceTypes: ['sub_frame']
        }
      }]
    });
    console.log('[SW] YouTube Referer rule set up');
  } catch (e) {
    console.error('[SW] Failed to set up rule:', e);
  }
}
