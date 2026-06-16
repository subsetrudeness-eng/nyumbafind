// NyumbaFind Service Worker
// Makes the app work offline and loads faster

const CACHE_NAME = "nyumbafind-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/static/js/main.chunk.js",
  "/static/js/bundle.js",
  "/manifest.json",
];

// Install — cache all static files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — serve from cache first, then network
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip Supabase and PayChangu API calls — always use network
  if (
    event.request.url.includes("supabase.co") ||
    event.request.url.includes("paychangu.com") ||
    event.request.url.includes("wa.me")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Return cached version if available
      if (cached) return cached;

      // Otherwise fetch from network and cache it
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
          return response;
        })
        .catch(() => {
          // Offline fallback — return homepage
          return caches.match("/index.html");
        });
    })
  );
});

// Push notifications (for future use)
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || "NyumbaFind 🏠", {
      body:    data.body || "You have a new notification",
      icon:    "/icons/icon-192.png",
      badge:   "/icons/icon-192.png",
      vibrate: [200, 100, 200],
    })
  );
});
