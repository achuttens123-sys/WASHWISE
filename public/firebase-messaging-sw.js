importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: "ai-studio-applet-webapp-80ffd",
  appId: "1:1011755511160:web:d1498a80e084332986ac8d",
  apiKey: "AIzaSyC2_kLAXV-r4UIeNOBT0GEHZt7wRbf2RXI",
  authDomain: "ai-studio-applet-webapp-80ffd.firebaseapp.com",
  messagingSenderId: "1011755511160",
  storageBucket: "ai-studio-applet-webapp-80ffd.firebasestorage.app"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'WashWise Update';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have an update on your laundry order.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: payload.data || {},
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.link || event.notification.data?.bookingId 
    ? `/confirmation?id=${event.notification.data.bookingId}` 
    : '/orders';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
