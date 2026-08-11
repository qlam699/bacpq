/* Service Worker: Web Push + notification click. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let title = 'Bạc Phú Quý Tracker';
  let body = 'Giá bạc đã thay đổi';
  let tag = 'bacpq-price';

  try {
    if (event.data) {
      const raw = event.data.text();
      try {
        const data = JSON.parse(raw);
        if (data.title) title = String(data.title);
        if (data.body) body = String(data.body);
        if (data.tag) tag = String(data.tag);
      } catch {
        if (raw) body = raw;
      }
    }
  } catch {
    // keep defaults
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,
      silent: false,
      requireInteraction: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    }),
  );
});
