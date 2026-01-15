// Service Worker Registration and Management
import { logger } from './logger';

export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      logger.log('Service Worker registered:', registration);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        logger.log('Service Worker update found');
        const newWorker = registration.installing;

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is ready
              logger.log('New Service Worker ready');
              // Optionally show a notification to the user
              showUpdateNotification();
            }
          });
        }
      });

      // Request notification permission
      await requestNotificationPermission();

      // Register periodic sync if supported
      await registerPeriodicSync(registration);

      return registration;
    } catch (error) {
      logger.error('Service Worker registration failed:', error);
      throw error;
    }
  } else {
    logger.warn('Service Workers not supported in this browser');
    return null;
  }
}

export async function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
    logger.log('Service Worker unregistered');
  }
}

async function requestNotificationPermission() {
  if ('Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      logger.log('Notification permission:', permission);
      return permission === 'granted';
    } catch (error) {
      logger.warn('Notification permission request failed:', error);
      return false;
    }
  }
  return false;
}

async function registerPeriodicSync(registration: ServiceWorkerRegistration) {
  if ('periodicSync' in registration) {
    try {
      // @ts-ignore - Periodic Sync API is experimental
      await registration.periodicSync.register('check-agents', {
        minInterval: 12 * 60 * 60 * 1000 // 12 hours
      });
      logger.log('Periodic sync registered');
    } catch (error) {
      logger.log('Periodic sync registration failed:', error);
    }
  }
}

function showUpdateNotification() {
  if (Notification.permission === 'granted') {
    new Notification('Medical Research Companion Updated', {
      body: 'A new version is available. Refresh to update.',
      icon: '/icon-192.png'
    });
  }
}

// Send message to service worker
export async function sendMessageToSW(message: any): Promise<any> {
  if (!navigator.serviceWorker.controller) {
    logger.warn('No service worker controller available');
    return null;
  }

  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel();
    let timeoutId: NodeJS.Timeout;

    messageChannel.port1.onmessage = (event) => {
      clearTimeout(timeoutId);
      if (event.data.error) {
        reject(event.data.error);
      } else {
        resolve(event.data);
      }
    };

    navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);

    // Timeout after 5 seconds (reduced from 30)
    timeoutId = setTimeout(() => {
      reject(new Error('Service Worker message timeout'));
    }, 5000);
  });
}

// Schedule agent check via service worker
export async function scheduleAgentCheck(delayMinutes = 60) {
  return sendMessageToSW({
    type: 'SCHEDULE_AGENT_CHECK',
    delay: delayMinutes
  });
}

// Trigger immediate agent run via service worker
export async function triggerAgentRun() {
  return sendMessageToSW({
    type: 'RUN_AGENTS_NOW'
  });
}

// Check if service worker is supported and registered
export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}

// Get service worker registration
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    return navigator.serviceWorker.ready;
  }
  return null;
}

// Request background sync
export async function requestBackgroundSync(tag: string) {
  const registration = await getServiceWorkerRegistration();

  if (registration && 'sync' in registration) {
    try {
      // @ts-ignore - Background Sync API
      await registration.sync.register(tag);
      logger.log(`Background sync registered: ${tag}`);
    } catch (error) {
      logger.error('Background sync registration failed:', error);
    }
  }
}

// Check if app is installed (PWA)
export function isAppInstalled(): boolean {
  // Check if running as standalone app
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // Check if running from home screen (iOS)
  // @ts-ignore
  const isIosStandalone = window.navigator.standalone === true;

  return isStandalone || isIosStandalone;
}

// Prompt to install PWA
export async function promptInstallPWA() {
  // @ts-ignore - beforeinstallprompt is not in TypeScript definitions
  const deferredPrompt = window.deferredPrompt;

  if (deferredPrompt) {
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    logger.log('PWA install prompt result:', choiceResult.outcome);

    // Clear the deferred prompt
    // @ts-ignore
    window.deferredPrompt = null;

    return choiceResult.outcome === 'accepted';
  }

  return false;
}

// Listen for PWA install prompt
export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();

    // Store the event for later use
    // @ts-ignore
    window.deferredPrompt = e;

    logger.log('PWA install prompt ready');

    // Optionally show custom install UI
    showCustomInstallUI();
  });
}

function showCustomInstallUI() {
  // This could trigger a custom UI element in your app
  const event = new CustomEvent('pwa-install-available');
  window.dispatchEvent(event);
}