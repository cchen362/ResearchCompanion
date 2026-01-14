// Manual cleanup script - paste this into the browser console

async function manualCleanupAllNotifications() {
  console.log('🧹 Starting MANUAL cleanup of ALL notifications...');

  try {
    const dbName = 'MedCompanionDB';
    const request = indexedDB.open(dbName);

    request.onsuccess = async function(event) {
      const db = event.target.result;

      // Get all topics to identify which ones are valid
      const topicsStore = db.transaction(['topics'], 'readonly').objectStore('topics');
      const topicsRequest = topicsStore.getAll();

      topicsRequest.onsuccess = async function() {
        const topics = topicsRequest.result;
        const validTopicNames = new Set(topics.map(t => t.name.toLowerCase()));
        const validDiseaseNames = new Set(topics.map(t => t.diseaseProfile?.name?.toLowerCase()).filter(Boolean));

        console.log('Valid topics found:', topics.length);
        console.log('Topic names:', Array.from(validTopicNames));

        // Get all notifications
        const notifTx = db.transaction(['notifications'], 'readwrite');
        const notifStore = notifTx.objectStore('notifications');
        const notifRequest = notifStore.getAll();

        notifRequest.onsuccess = async function() {
          const notifications = notifRequest.result;
          console.log('Total notifications found:', notifications.length);

          let removed = 0;
          let kept = 0;

          // Start a new transaction for deletion
          const deleteTx = db.transaction(['notifications'], 'readwrite');
          const deleteStore = deleteTx.objectStore('notifications');

          for (const notification of notifications) {
            let shouldDelete = false;
            let reason = '';

            // If no topics exist, delete all notifications
            if (topics.length === 0) {
              shouldDelete = true;
              reason = 'No topics exist';
            }
            // Check if notification mentions Acromegaly or Muscular Dystrophies
            else if (notification.title) {
              const titleLower = notification.title.toLowerCase();

              if (titleLower.includes('acromegaly') &&
                  !validTopicNames.has('acromegaly') &&
                  !validDiseaseNames.has('acromegaly')) {
                shouldDelete = true;
                reason = 'Acromegaly topic deleted';
              } else if ((titleLower.includes('muscular dystroph') ||
                         titleLower.includes('muscular dystroph')) &&
                        !validTopicNames.has('muscular dystrophies') &&
                        !validDiseaseNames.has('muscular dystrophies')) {
                shouldDelete = true;
                reason = 'Muscular Dystrophies topic deleted';
              }
            }

            if (shouldDelete) {
              try {
                await deleteStore.delete(notification.id);
                removed++;
                console.log(`❌ Deleted: "${notification.title}" - Reason: ${reason}`);
              } catch (err) {
                console.error('Failed to delete:', notification.id, err);
              }
            } else {
              kept++;
              console.log(`✅ Kept: "${notification.title}"`);
            }
          }

          await deleteTx.done;

          console.log(`
=================================
🎯 CLEANUP COMPLETE!
=================================
❌ Removed: ${removed} notifications
✅ Kept: ${kept} notifications
=================================
Refresh the page to see changes.
          `);

          // Dispatch event to refresh UI
          window.dispatchEvent(new CustomEvent('notifications-cleaned', {
            detail: { removed, kept }
          }));
        };
      };
    };

    request.onerror = function(event) {
      console.error('Failed to open database:', event);
    };
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

// Alternative: Clear ALL notifications regardless
async function clearAllNotifications() {
  if (!confirm('⚠️ This will delete ALL notifications. Are you sure?')) {
    return;
  }

  console.log('🗑️ Clearing ALL notifications...');

  const dbName = 'MedCompanionDB';
  const request = indexedDB.open(dbName);

  request.onsuccess = async function(event) {
    const db = event.target.result;
    const tx = db.transaction(['notifications'], 'readwrite');
    const store = tx.objectStore('notifications');

    await store.clear();
    await tx.done;

    console.log('✅ All notifications cleared! Refresh the page.');

    // Dispatch event to refresh UI
    window.dispatchEvent(new CustomEvent('notifications-cleaned', {
      detail: { removed: 'all', kept: 0 }
    }));
  };
}

// Run the cleanup
console.log(`
🧹 Manual Cleanup Options:
==========================
1. manualCleanupAllNotifications() - Remove orphaned notifications
2. clearAllNotifications() - Delete ALL notifications

Type the function name to run it.
`);

// Make functions available globally
window.manualCleanupAllNotifications = manualCleanupAllNotifications;
window.clearAllNotifications = clearAllNotifications;