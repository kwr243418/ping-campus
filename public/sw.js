// 핑캠퍼스 서비스 워커: Web Push 표시, 알림 클릭 시 열기, 오프라인 앱 껍데기 캐시
const CACHE = "ping-campus-v1";
const CACHE_ENABLED = new URL(self.location.href).searchParams.get("cache") === "1";
const APP_SHELL = ["/", "/week", "/my", "/settings", "/notifications", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  if (CACHE_ENABLED) {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE || !CACHE_ENABLED).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// 시간표·저장된 일정은 기기 저장소에 있으므로, 앱 화면과 정적 파일만 캐시하면 오프라인에서도 볼 수 있습니다
self.addEventListener("fetch", (event) => {
  if (!CACHE_ENABLED) return;
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    // 정적 파일: 캐시 우선
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }
  if (req.mode === "navigate") {
    // 화면: 네트워크 우선, 실패하면 캐시
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/")) || Response.error()),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "[핑캠퍼스]", body: "새 알림이 있어요.", url: "/", tag: undefined };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // 텍스트 페이로드
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      data: { url: data.url },
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const target = new URL(url, self.location.origin).href;
      for (const client of all) {
        if (!("focus" in client)) continue;
        try {
          // 서비스 워커가 아직 제어하지 않는 창은 navigate가 실패하므로, 그때는 새 창으로 엽니다
          const navigated = "navigate" in client ? await client.navigate(target) : null;
          await (navigated || client).focus();
          if (navigated) return;
        } catch {
          // 아래에서 새 창으로 엽니다
        }
        break;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
