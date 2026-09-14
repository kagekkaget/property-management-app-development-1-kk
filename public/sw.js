/* Kavlingo Palembang — service worker untuk mode offline */
const CACHE = "kavlingo-cache-v3";
const SHELL = ["/", "/login", "/dashboard"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Jangan pernah cache data dinamis dari API (dipakai localStorage sebagai fallback offline)
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy).catch(() => undefined));
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match("/dashboard").then((d) => d || Response.error())),
      ),
  );
});
