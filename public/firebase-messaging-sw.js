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
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/firebase-logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
