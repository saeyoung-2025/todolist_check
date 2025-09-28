const CACHE_NAME = "checklist-app-v1.0.0";
const CACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./service-worker.js"
];

// 서비스 워커 설치
self.addEventListener("install", event => {
  console.log("Service Worker: Installing...");
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("Service Worker: Caching files");
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log("Service Worker: Installation complete");
        // 새 서비스 워커를 즉시 활성화
        return self.skipWaiting();
      })
      .catch(error => {
        console.error("Service Worker: Installation failed", error);
      })
  );
});

// 서비스 워커 활성화
self.addEventListener("activate", event => {
  console.log("Service Worker: Activating...");
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log("Service Worker: Deleting old cache", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("Service Worker: Activation complete");
        // 모든 탭에서 즉시 제어권 가져오기
        return self.clients.claim();
      })
      .catch(error => {
        console.error("Service Worker: Activation failed", error);
      })
  );
});

// 네트워크 요청 가로채기
self.addEventListener("fetch", event => {
  // GET 요청만 처리
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 캐시에 있으면 캐시된 버전 반환
        if (cachedResponse) {
          console.log("Service Worker: Serving from cache", event.request.url);
          return cachedResponse;
        }
        
        // 캐시에 없으면 네트워크에서 가져오기
        console.log("Service Worker: Fetching from network", event.request.url);
        return fetch(event.request)
          .then(response => {
            // 유효한 응답인지 확인
            if (!response || response.status !== 200 || response.type !== "basic") {
              return response;
            }
            
            // 응답을 복사 (한 번만 읽을 수 있으므로)
            const responseToCache = response.clone();
            
            // 캐시에 저장
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            console.error("Service Worker: Network fetch failed", error);
            
            // 오프라인 상태일 때 기본 페이지 반환
            if (event.request.destination === "document") {
              return caches.match("./index.html");
            }
            
            // 다른 리소스의 경우 에러 응답
            return new Response("오프라인 상태입니다.", {
              status: 408,
              statusText: "Offline"
            });
          });
      })
  );
});

// 백그라운드 동기화 (선택적)
self.addEventListener("sync", event => {
  console.log("Service Worker: Background sync", event.tag);
  
  if (event.tag === "background-sync") {
    event.waitUntil(
      // 여기에 백그라운드에서 실행할 작업 추가
      console.log("Background sync completed")
    );
  }
});

// 푸시 알림 처리 (선택적)
self.addEventListener("push", event => {
  if (event.data) {
    const data = event.data.json();
    console.log("Service Worker: Push received", data);
    
    const options = {
      body: data.body || "새로운 알림이 있습니다.",
      icon: "./icons/icon-192x192.png",
      badge: "./icons/badge-72x72.png",
      tag: "checklist-notification",
      requireInteraction: false,
      actions: [
        {
          action: "open",
          title: "열기"
        },
        {
          action: "close",
          title: "닫기"
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || "체크리스트 앱",
        options
      )
    );
  }
});

// 알림 클릭 처리
self.addEventListener("notificationclick", event => {
  console.log("Service Worker: Notification click", event);
  
  event.notification.close();
  
  if (event.action === "open") {
    event.waitUntil(
      clients.openWindow("./index.html")
    );
  }
});

// 메시지 처리 (앱과 서비스 워커 간 통신)
self.addEventListener("message", event => {
  console.log("Service Worker: Message received", event.data);
  
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case "SKIP_WAITING":
        self.skipWaiting();
        break;
      case "GET_VERSION":
        event.ports[0].postMessage({ version: CACHE_NAME });
        break;
      default:
        console.log("Service Worker: Unknown message type", event.data.type);
    }
  }
});

// 에러 처리
self.addEventListener("error", event => {
  console.error("Service Worker: Error occurred", event.error);
});

// 처리되지 않은 Promise 거부 처리
self.addEventListener("unhandledrejection", event => {
  console.error("Service Worker: Unhandled promise rejection", event.reason);
  event.preventDefault();
});