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
      // 不管欄位名稱、有沒有標示類型，只要是檔案就收下
      const all = [...form.entries()];
      const files = all.map(([, v]) => v).filter(v => v && typeof v !== "string" && v.size > 0).slice(0, 4);
      const text = ["title", "text", "url"].map(k => form.get(k)).filter(v => typeof v === "string" && v).join("\n");
      const cache = await caches.open(SHARE_CACHE);
      for (const k of await cache.keys()) await cache.delete(k);
      // 記錄這次分享的資訊，方便頁面判斷與除錯
      const meta = { id: Date.now(), files: files.length, fields: all.map(([k, v]) => k + (typeof v === "string" ? "" : ":file")) };
      await cache.put(new URL("./shared/meta", self.registration.scope).href, new Response(JSON.stringify(meta)));
      for (let i = 0; i < files.length; i++) {
        await cache.put(new URL(`./shared/img${i}`, self.registration.scope).href,
          new Response(files[i], { headers: { "content-type": files[i].type || "image/jpeg" } }));
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
