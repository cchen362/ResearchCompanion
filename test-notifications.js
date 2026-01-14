// Test script for notification cleanup functionality
// Run this in the browser console to test notification cleanup

async function testNotificationCleanup() {
  console.log('=== Testing Notification Cleanup ===\n');

  // Import the cleanup utilities
  const { cleanupOrphanedNotifications, getNotificationStats } = await import('./src/utils/db/cleanup.js');
  const { getDB } = await import('./src/utils/db/database.js');
  const { getAllTopics } = await import('./src/utils/db/topics.js');

  try {
    // 1. Check current state
    console.log('1. Checking current notification state...');
    const statsBefore = await getNotificationStats();
    console.log('   Total notifications:', statsBefore.total);
    console.log('   Orphaned notifications:', statsBefore.orphaned);
    console.log('   By type:', statsBefore.byType);
    console.log('   By topic:', statsBefore.byTopic);
    console.log('');

    // 2. Get current topics
    console.log('2. Current topics in database:');
    const topics = await getAllTopics();
    topics.forEach(t => console.log(`   - ${t.name} (ID: ${t.id})`));
    console.log('');

    // 3. Show some notifications
    console.log('3. Sample notifications:');
    const db = await getDB();
    const notifications = await db.getAll('notifications');
    notifications.slice(0, 3).forEach(n => {
      console.log(`   - ${n.title}`);
      console.log(`     TopicId: ${n.data?.topicId || 'none'}`);
      console.log(`     Created: ${new Date(n.createdAt).toLocaleString()}`);
    });
    console.log('');

    // 4. Perform cleanup
    if (statsBefore.orphaned > 0) {
      console.log('4. Cleaning up orphaned notifications...');
      const result = await cleanupOrphanedNotifications();
      console.log(`   ✅ Removed: ${result.removed} notifications`);
      console.log(`   ✅ Kept: ${result.kept} notifications`);

      if (result.errors.length > 0) {
        console.log('   ⚠️ Errors:', result.errors);
      }
      console.log('');

      // 5. Check state after cleanup
      console.log('5. State after cleanup:');
      const statsAfter = await getNotificationStats();
      console.log('   Total notifications:', statsAfter.total);
      console.log('   Orphaned notifications:', statsAfter.orphaned);
      console.log('');
    } else {
      console.log('4. No orphaned notifications to clean up!');
      console.log('');
    }

    console.log('=== Test Complete ===');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Function to manually create an orphaned notification for testing
async function createOrphanedNotification() {
  const { getDB } = await import('./src/utils/db/database.js');

  const db = await getDB();
  const testNotification = {
    id: `test-orphan-${Date.now()}`,
    type: 'agent_complete',
    title: 'Test Orphaned Notification',
    message: 'This is a test notification for a non-existent topic',
    priority: 'normal',
    createdAt: Date.now(),
    data: { topicId: 'non-existent-topic-id' }
  };

  await db.add('notifications', testNotification);
  console.log('✅ Created test orphaned notification');
  return testNotification.id;
}

// Make functions available globally
window.testNotificationCleanup = testNotificationCleanup;
window.createOrphanedNotification = createOrphanedNotification;
window.cleanupOrphanedNotifications = async () => {
  const { cleanupOrphanedNotifications } = await import('./src/utils/db/cleanup.js');
  return cleanupOrphanedNotifications();
};
window.getNotificationStats = async () => {
  const { getNotificationStats } = await import('./src/utils/db/cleanup.js');
  return getNotificationStats();
};

console.log(`
🔧 Notification Cleanup Test Functions Available:

1. testNotificationCleanup() - Run complete test suite
2. createOrphanedNotification() - Create a test orphaned notification
3. cleanupOrphanedNotifications() - Run cleanup manually
4. getNotificationStats() - Get notification statistics

Run: testNotificationCleanup() to start
`);