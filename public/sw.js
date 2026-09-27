// Service worker do izi Freelas.
// Estratégia: navegação é network-first (dados do Supabase precisam estar sempre frescos) com
// fallback para o cache quando offline; assets estáticos do build são cache-first, já que o Next
// gera nomes com hash e nunca reaproveita a mesma URL para conteúdo diferente.

const CACHE_VERSION = "izi-freelas-v2";
const SCOPE = self.registration.scope;
const PRECACHE_URLS = [
  "",
  "dashboard",
  "login",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
].map((path) => new URL(path, SCOPE).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      // Um item que falhar não pode impedir a instalação do SW inteiro.
      .then((cache) => Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("izi-freelas-v") && key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Push notifications can arrive while the app is closed; keep their UI handling in the
// existing service worker so GitHub Pages continues using a single worker/scope.
self.addEventListener("push", (event) => {
  let payload = {};

  try {
    const parsed = event.data?.json();
    payload = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    payload = { body: event.data?.text() ?? "" };
  }

  const title = typeof payload.title === "string" ? payload.title : "IZI Freelas";
  const target = new URL(typeof payload.url === "string" ? payload.url : "dashboard/tasks", SCOPE);

  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof payload.body === "string" ? payload.body : "Abra suas tarefas para continuar.",
      icon: new URL("icons/icon-192.png", SCOPE).toString(),
      badge: new URL("icons/icon-192.png", SCOPE).toString(),
      tag: typeof payload.tag === "string" ? payload.tag : undefined,
      data: { url: target.toString() },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "dashboard/tasks", SCOPE);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      for (const windowClient of windows) {
        if (new URL(windowClient.url).origin === target.origin) {
          await windowClient.navigate(target.toString());
          return windowClient.focus();
        }
      }

      return self.clients.openWindow(target.toString());
    }),
  );
});

function isStaticAsset(url) {
  return url.pathname.includes("/_next/static/") || url.pathname.includes("/icons/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Supabase e qualquer outra origem passam direto: nunca servir dado de usuário do cache.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || Response.error()),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
