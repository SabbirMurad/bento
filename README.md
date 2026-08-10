# Bento

A Chrome new tab page you arrange yourself. The clock, bookmarks, shortcuts,
search bar and Google links are pieces you move, restyle, reorder or switch
off — none of it is fixed in place.

Chrome extension, Manifest V3, no build step, no dependencies.

## Running it locally

```
chrome://extensions  →  Developer mode  →  Load unpacked  →  pick this folder
```

Open a new tab. Changes to the source show up on reload; changes to
`manifest.json` need the extension reloaded from `chrome://extensions`.

Serving the folder over `http://localhost` also works for quick CSS and layout
work, but `chrome.bookmarks`, `chrome.history` and `chrome.storage` are
undefined there, so bookmarks and shortcuts throw on load and stay empty.
Anything touching those has to be checked in the real extension.

## What can be customised

| Area | Controls |
| --- | --- |
| Clock | Eleven faces, text colour, position |
| Background | Image or video, blur, shadow, blend mode |
| Bookmarks | Show/hide, text colour, position, drag to reorder |
| Shortcuts | Add/remove, drag to reorder, row or column, spacing, colour, position |
| Search | Show/hide, position, history suggestions |
| Google | Fifty services to pick from, drag to reorder, colour, position |
| General | Glass tint, arrange widgets on the page |

## Layout

```
manifest.json          MV3 manifest. Only override is chrome_url_overrides.newtab
index.html             The whole page, plus the settings sidebar markup
assets/js/
  utils.js             Favicon URLs, url helpers. Loads first
  settings.js          Settings sidebar: tabs, colours, positions, widget visibility
  clock.js             All eleven clock faces and the tick
  bookmark.js          Bookmarks bar, reordering
  shortcuts.js         Shortcut tiles and the add/reorder sidebar
  background.js        Background image, blur, shadow, blend
  background-video.js  Background video, stored in IndexedDB
  google.js            The fifty-service catalogue, picker and panel
  arrange.js           Drag widgets on the page. Loads after settings.js
assets/css/            One stylesheet per area, same names
assets/brand/          Logo, and the theme-aware SVG favicon
tools/                 Generators, see below
```

### Two things worth knowing before editing

**Widget positions have one owner.** `settings.js` registers each positionable
widget in `widgetPositionControls`, keyed by the element id in the panel's
`content-id`. Dragging a widget calls `place()` on that entry, so the align
buttons, the number inputs and `localStorage` never disagree about where
something is. Add a widget by adding one line of markup:

```html
<div class="item position" content-id="my-widget" default-vertical="top"></div>
```

The six buttons and four inputs inside it are generated. `default-horizontal`
and `default-vertical` say which edge the widget's own CSS anchors it to —
they cannot be read off the element, because an absolutely positioned box
resolves `left` and `top` to pixels even when the stylesheet only set `right`
and `bottom`.

**Widget visibility is declarative too.** Put
`data-widget-toggle="<element id>"` on a checkbox and it gets a working
show/hide, stored under `widget-visible:<id>`.

## Generators

Output is committed, so none of this runs at install time. Node only, no
dependencies.

```
node tools/make-clock-thumbs.js    # assets/image/clock_option/*.svg
node tools/make-brand-assets.js    # assets/brand/*.svg, assets/favicon/icon*.png
node tools/make-package.js         # dist/<name>-<version>.zip
```

The thumbnails and icons are generated rather than drawn because they are not
meant to be hand-edited — the word clock preview alone is 110 SVG elements,
and the PNG icons are rasterised in Node so there is no dependency to install.

## Building for the Chrome Web Store

1. Bump `"version"` in `manifest.json`. The store rejects a version it has
   already accepted.
2. `node tools/make-package.js`
3. Upload `dist/bento-<version>.zip` at the
   [Developer Dashboard](https://chrome.google.com/webstore/devconsole) under
   Package → Upload new package.

The script ships only what the extension loads, and refuses to build if a
shipped file points at an asset that would not be in the zip — that class of
bug otherwise only appears once installed from the store.

## Permissions

Three, each for one visible thing:

- `bookmarks` — the bookmarks bar
- `history` — suggestions in the search bar
- `storage` — shortcuts and bookmark order

Settings live in `localStorage`, and `sync.js` mirrors them into
`chrome.storage.sync` (skipping the push if a snapshot would exceed the 8KB
chrome.storage.sync allows for one item); shortcuts and bookmark order live in
`chrome.storage.sync` directly. The background video lives in IndexedDB and
does not sync — a fresh machine gets everything else but has to have its
background set again.

Site icons come from Google's public favicon service and the page fonts from
Google Fonts. There is no account, no analytics and no server.

## The dormant music player

`music-player.js`, `youtube_player.js`, `service-worker.js`,
`content-script.js` and `player-sandbox.*` are in the repo but are not
registered in the manifest and are not shipped. They are switched off, and
the permissions they needed — host access to every site, plus
`declarativeNetRequest` — are what made a new tab extension look like it
modified browsing.

Turning it back on needs more than uncommenting the script tags in
`index.html`; see the note at the top of `service-worker.js`. It also loads
`youtube.com/iframe_api`, which is remote code and not allowed under MV3, so
that needs solving first.
