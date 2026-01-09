// Copy and paste these commands into the Chrome DevTools Console at http://localhost:5173

// 1. Unregister all service workers
navigator.serviceWorker.getRegistrations().then(function(registrations) {
  for(let registration of registrations) {
    registration.unregister();
    console.log('Unregistered:', registration.scope);
  }
  console.log('✅ All service workers unregistered');
});

// 2. Clear all caches
caches.keys().then(function(names) {
  for (let name of names) {
    caches.delete(name);
    console.log('Deleted cache:', name);
  }
  console.log('✅ All caches cleared');
});

// 3. Clear storage
localStorage.clear();
sessionStorage.clear();
console.log('✅ Local and session storage cleared');

// 4. After running these, do a hard refresh:
console.log('📌 Now press Ctrl+Shift+R (or Cmd+Shift+R on Mac) to hard refresh!');