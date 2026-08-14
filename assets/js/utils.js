function getFavicon(domain) {
    try {
        const url = new URL(domain.includes("://") ? domain : "https://" + domain);
        return `https://www.google.com/s2/favicons?domain=${url.origin}&sz=64`;
    } catch {
        return 'assets/icon/web.svg';
    }
}

// Points an <img> at the best icon for a link, and keeps it pointed at
// something that renders. Used by anything that draws a list of links:
// shortcuts, bookmarks, the search history dropdown.
//
// The service above answers per host, and a host has only one favicon — so
// every Google product sharing one comes back wearing the same picture. A
// link to a spreadsheet showed the Docs icon, because Sheets, Slides and
// Forms all live on docs.google.com too. The Google panel already keeps a
// proper icon for each of those, so ask it first and leave the favicon
// service everything else.
//
// findGoogleProduct comes from google.js, which index.html loads ahead of
// every file that draws a list of links. It used to load after them, and a
// guard here quietly took the favicon whenever it was not defined yet —
// which is why Google bookmarks and shortcuts came out generic while the
// search dropdown, which only draws once you type, came out right.
function applyLinkIcon(img, url) {
    const product = findGoogleProduct(url);

    if (product) {
        applyGoogleIcon(img, product);
        return;
    }

    img.src = getFavicon(url);

    // Without this, a favicon the service cannot supply leaves a broken image
    // sitting in the row.
    img.addEventListener('error', () => {
        img.src = 'assets/icon/web.svg';
    }, { once: true });
}

function toDashCase(str) {
    // TODO: Implement the logic to convert a string to dash case
    return str.replace(/\s+/g, '-').toLowerCase();
}

function addHttpToUrl(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    return url;
}