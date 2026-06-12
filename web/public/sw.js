self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Restaurant Planner", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Restaurant Planner", {
      body: payload.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: payload.url ?? "/",
      tag: payload.tag ?? "rp-notification",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
