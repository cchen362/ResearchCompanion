// Service Worker for Medical Research Companion PWA
// IMPORTANT: Keep CACHE_NAME version in sync with DB_VERSION in src/utils/db/database.ts
const CACHE_NAME = 'med-companion-v5';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Don't cache API calls
          if (!event.request.url.includes('/api/')) {
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
          }

          return response;
        });
      })
      .catch(() => {
        // Offline fallback
        return new Response('Offline - Please check your connection', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      })
  );
});

// Background sync for agent runs
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync event:', event.tag);

  if (event.tag === 'run-agents') {
    event.waitUntil(runScheduledAgents());
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('[ServiceWorker] Periodic sync event:', event.tag);

  if (event.tag === 'check-agents') {
    event.waitUntil(checkAndRunAgents());
  }
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push event');

  const options = {
    body: event.data ? event.data.text() : 'New medical research update available',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Findings'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Medical Research Companion', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click:', event.action);

  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/findings')
    );
  }
});

// Message event for communication with the app
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);

  if (event.data && event.data.type === 'SCHEDULE_AGENT_CHECK') {
    scheduleAgentCheck(event.data.delay);
    // Send response back to prevent timeout
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true });
    }
  }

  if (event.data && event.data.type === 'RUN_AGENTS_NOW') {
    runScheduledAgents().then(() => {
      event.ports[0].postMessage({ success: true });
    }).catch((error) => {
      event.ports[0].postMessage({ success: false, error: error.message });
    });
  }
});

// Helper function to run scheduled agents
async function runScheduledAgents() {
  console.log('[ServiceWorker] Running scheduled agents');

  try {
    // Open IndexedDB
    const dbRequest = indexedDB.open('MedCompanionDB', 5);

    return new Promise((resolve, reject) => {
      dbRequest.onsuccess = async (event) => {
        const db = event.target.result;

        // Get all topics
        const topicsStore = db.transaction(['topics'], 'readonly').objectStore('topics');
        const topicsRequest = topicsStore.getAll();

        topicsRequest.onsuccess = async () => {
          const topics = topicsRequest.result;

          // Get all agents
          const agentsStore = db.transaction(['agents'], 'readonly').objectStore('agents');
          const agentsRequest = agentsStore.getAll();

          agentsRequest.onsuccess = async () => {
            const agents = agentsRequest.result;

            // Filter agents that need to run
            const now = Date.now();
            const agentsToRun = agents.filter(agent => {
              if (agent.status === 'disabled') return false;
              if (!agent.nextScheduledRun) return true;
              return agent.nextScheduledRun <= now;
            });

            console.log(`[ServiceWorker] Found ${agentsToRun.length} agents to run`);

            // Run each agent
            for (const agent of agentsToRun) {
              const topic = topics.find(t => t.id === agent.topicId);
              if (topic) {
                try {
                  // Call the API to run the agent
                  const response = await fetch('http://localhost:3001/api/run-agent', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ agent, topic })
                  });

                  if (response.ok) {
                    const result = await response.json();
                    console.log(`[ServiceWorker] Agent ${agent.name} completed:`, result);

                    // Show notification if findings were found
                    if (result.findingsCount > 0) {
                      self.registration.showNotification('New Research Found', {
                        body: `Found ${result.findingsCount} new findings for ${topic.name}`,
                        icon: '/icon-192.png',
                        badge: '/icon-192.png',
                        tag: `findings-${topic.id}`,
                        renotify: true
                      });
                    }
                  }
                } catch (error) {
                  console.error(`[ServiceWorker] Error running agent ${agent.name}:`, error);
                }
              }
            }

            resolve();
          };
        };
      };

      dbRequest.onerror = () => {
        reject(dbRequest.error);
      };
    });
  } catch (error) {
    console.error('[ServiceWorker] Error in runScheduledAgents:', error);
    throw error;
  }
}

// Helper function to check and run agents based on schedule
async function checkAndRunAgents() {
  console.log('[ServiceWorker] Checking agent schedules');

  try {
    // Open IndexedDB
    const dbRequest = indexedDB.open('MedCompanionDB', 5);

    return new Promise((resolve, reject) => {
      dbRequest.onsuccess = async (event) => {
        const db = event.target.result;

        // Get all topics
        const topicsStore = db.transaction(['topics'], 'readonly').objectStore('topics');
        const topicsRequest = topicsStore.getAll();

        topicsRequest.onsuccess = () => {
          const topics = topicsRequest.result;

          // Check each topic's progression rate
          const now = Date.now();
          topics.forEach(topic => {
            const lastRun = topic.lastAgentRun || 0;
            const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);

            let shouldRun = false;
            switch (topic.diseaseProfile.progressionRate) {
              case 'rapid':
                shouldRun = hoursSinceLastRun >= 12;
                break;
              case 'moderate':
                shouldRun = hoursSinceLastRun >= 24;
                break;
              case 'slow':
                shouldRun = hoursSinceLastRun >= 168;
                break;
              default:
                shouldRun = hoursSinceLastRun >= 24;
            }

            if (shouldRun) {
              console.log(`[ServiceWorker] Topic ${topic.name} needs agent run`);
              // Trigger agent run
              runScheduledAgents();
            }
          });

          resolve();
        };
      };

      dbRequest.onerror = () => {
        reject(dbRequest.error);
      };
    });
  } catch (error) {
    console.error('[ServiceWorker] Error in checkAndRunAgents:', error);
    throw error;
  }
}

// Helper function to schedule agent check
function scheduleAgentCheck(delayMinutes = 60) {
  console.log(`[ServiceWorker] Scheduling agent check in ${delayMinutes} minutes`);

  // Use setTimeout for simple scheduling
  setTimeout(() => {
    checkAndRunAgents();
  }, delayMinutes * 60 * 1000);
}

// Initial setup
console.log('[ServiceWorker] Service worker loaded');