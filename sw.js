// Service Worker for Survey Pro PWA
const CACHE_NAME = 'survey-pro-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/form-builder.html',
  '/css/styles.css',
  '/js/supabase.js',
  '/js/app.js',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Supabase API requests
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache the fetched response
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Network failed, try to return offline page
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Handle background sync for offline survey submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-surveys') {
    event.waitUntil(syncSurveys());
  }
});

async function syncSurveys() {
  // Get pending surveys from IndexedDB
  const db = await openDB();
  const tx = db.transaction('pending-surveys', 'readonly');
  const store = tx.objectStore('pending-surveys');
  const surveys = await store.getAll();

  for (const survey of surveys) {
    try {
      // Try to submit to server
      await submitSurvey(survey);
      // Remove from pending
      const deleteTx = db.transaction('pending-surveys', 'readwrite');
      await deleteTx.objectStore('pending-surveys').delete(survey.id);
    } catch (error) {
      console.error('Failed to sync survey:', error);
    }
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('survey-pro-offline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-surveys')) {
        db.createObjectStore('pending-surveys', { keyPath: 'id' });
      }
    };
  });
}

async function submitSurvey(survey) {
  // This would use Supabase client to submit
  // For now, just log
  console.log('Syncing survey:', survey);
}
