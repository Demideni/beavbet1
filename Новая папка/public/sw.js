/* Minimal Service Worker: required for installability on desktop browsers. */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first passthrough. We don't cache here (keep behavior unchanged).
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
