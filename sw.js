// Service worker: serves the app page itself, nothing else.
//
// A chapter link such as /books/<Book>/3 has no file behind it, so without
// this worker Pages answers with 404.html, which bounces to the site root,
// which loads the app — two page loads per link. Here every app route is
// answered straight from a cached copy of the app page (no network wait,
// and it opens offline), and the copy is refreshed in the background so the
// next visit picks up any change. Books, covers and lists are handled by the
// page's own caches and are never touched here.

var SHELL_CACHE = 'reader-shell-v1';
var SCOPE = new URL(self.registration.scope);
var SHELL_URL = SCOPE.href;  // the site root serves index.html

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(function (cache) { return cache.add(new Request(SHELL_URL, { cache: 'no-cache' })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf('reader-shell-') === 0 && k !== SHELL_CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// The app's own routes: the root, index.html, and /books/... page URLs —
// but not the .txt / .epub files under books/, which are real downloads.
function isAppRoute(url) {
  if (url.origin !== SCOPE.origin) return false;
  var p = url.pathname;
  var base = SCOPE.pathname;
  if (p === base || p === base + 'index.html') return true;
  return p.indexOf(base + 'books/') === 0 && !/\.(txt|epub)$/i.test(p);
}

function refreshShell() {
  return fetch(SHELL_URL, { cache: 'no-cache' }).then(function (res) {
    if (res.ok) {
      var copy = res.clone();
      caches.open(SHELL_CACHE).then(function (cache) { cache.put(SHELL_URL, copy); });
    }
    return res;
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  var url = new URL(req.url);
  if (!isAppRoute(url)) return;

  event.respondWith(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.match(SHELL_URL).then(function (cached) {
        var fresh = refreshShell();
        if (cached) {
          event.waitUntil(fresh.catch(function () {}));
          return cached;
        }
        // Nothing cached yet and the root failed: let the request go through
        // as it would without this worker.
        return fresh.catch(function () { return fetch(req); });
      });
    })
  );
});
