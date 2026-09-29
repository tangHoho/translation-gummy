// 翻譯年糕 service worker：離線快取 + Android「分享到這個 App」
importScripts("version.js");
const CACHE = "gummy-" + self.APP_VERSION;
const SHARE_CACHE = "share";
const ASSETS = ["./", "./index.html", "./config.js", "./version.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== SHARE_CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Android 分享進來的截圖或文字
  if (e.request.method === "POST" && url.origin === location.origin && url.pathname.endsWith("/share")) {
    e.respondWith((async () => {
      const form = await e.request.formData();
      const files = form.getAll("images").filter(f => f && f.type && f.type.startsWith("image/")).slice(0, 4);
      const text = [form.get("title"), form.get("text"), form.get("url")].filter(Boolean).join("\n");
      const cache = await caches.open(SHARE_CACHE);
      for (const k of await cache.keys()) await cache.delete(k);
      for (let i = 0; i < files.length; i++) {
        await cache.put(new URL(`./shared/img${i}`, self.registration.scope).href,
          new Response(files[i], { headers: { "content-type": files[i].type } }));
      }
      if (text) await cache.put(new URL("./shared/text", self.registration.scope).href, new Response(text));
      return Response.redirect(new URL("./?shared=1", self.registration.scope).href, 303);
    })());
    return;
  }

  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // 先用網路（拿到最新版），沒網路才用快取
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
