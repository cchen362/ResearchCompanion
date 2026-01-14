import { getDB } from './database';
import { getAllTopics } from './topics';

/**
 * Clean up orphaned notifications that belong to deleted topics
 */
export async function cleanupOrphanedNotifications(): Promise<{
  removed: number;
  kept: number;
  errors: string[];
}> {
  const db = await getDB();
  const errors: string[] = [];
  let removed = 0;
  let kept = 0;

  try {
    // Get all existing topics
    const topics = await getAllTopics();
    const validTopicIds = new Set(topics.map(t => t.id));
    const validTopicNames = new Set(topics.map(t => t.name.toLowerCase()));
    const validDiseaseNames = new Set(topics.map(t => t.diseaseProfile.name.toLowerCase()));

    // Get all notifications
    const allNotifications = await db.getAll('notifications');
    console.log(`Checking ${allNotifications.length} notifications for orphans...`);
    console.log('Valid topic IDs:', Array.from(validTopicIds));
    console.log('Valid topic names:', Array.from(validTopicNames));

    // Start transaction for deletion
    const tx = db.transaction(['notifications'], 'readwrite');
    const store = tx.objectStore('notifications');

    for (const notification of allNotifications) {
      try {
        let isOrphaned = false;
        let reason = '';

        // Method 1: Check if notification has a topicId that no longer exists
        const topicId = notification.data?.topicId;
        if (topicId && !validTopicIds.has(topicId)) {
          isOrphaned = true;
          reason = `topicId ${topicId} not found`;
        }

        // Method 2: If no topics exist, all notifications are orphaned
        if (topics.length === 0 && !isOrphaned) {
          isOrphaned = true;
          reason = 'no topics exist';
        }

        // Method 3: Check if notification mentions a topic name that no longer exists
        // (for older notifications that might not have topicId)
        if (!isOrphaned && notification.title) {
          const titleLower = notification.title.toLowerCase();

          // Check if title mentions "Acromegaly" or "Muscular Dystrophies" specifically
          // when those topics don't exist
          if (titleLower.includes('acromegaly') && !validTopicNames.has('acromegaly') && !validDiseaseNames.has('acromegaly')) {
            isOrphaned = true;
            reason = 'mentions Acromegaly but topic deleted';
          } else if ((titleLower.includes('muscular dystrophies') || titleLower.includes('muscular dystrophy')) &&
                     !validTopicNames.has('muscular dystrophies') && !validDiseaseNames.has('muscular dystrophies')) {
            isOrphaned = true;
            reason = 'mentions Muscular Dystrophies but topic deleted';
          }
        }

        if (isOrphaned) {
          // This is an orphaned notification - delete it
          await store.delete(notification.id);
          removed++;
          console.log(`Removed orphaned notification: "${notification.title}" (reason: ${reason})`);
        } else {
          kept++;
        }
      } catch (err) {
        const errorMsg = `Failed to process notification ${notification.id}: ${err}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    await tx.done;

    console.log(`Cleanup complete: ${removed} orphaned notifications removed, ${kept} kept`);

    // Dispatch event to refresh UI
    window.dispatchEvent(new CustomEvent('notifications-cleaned', {
      detail: { removed, kept }
    }));

    return { removed, kept, errors };

  } catch (error) {
    const errorMsg = `Failed to clean up notifications: ${error}`;
    errors.push(errorMsg);
    console.error(errorMsg);
    return { removed: 0, kept: 0, errors };
  }
}

/**
 * Get statistics about notifications
 */
export async function getNotificationStats(): Promise<{
  total: number;
  orphaned: number;
  byType: Record<string, number>;
  byTopic: Record<string, number>;
}> {
  const db = await getDB();

  try {
    const topics = await getAllTopics();
    const validTopicIds = new Set(topics.map(t => t.id));
    const validTopicNames = new Set(topics.map(t => t.name.toLowerCase()));
    const validDiseaseNames = new Set(topics.map(t => t.diseaseProfile.name.toLowerCase()));
    const topicNames = new Map(topics.map(t => [t.id, t.name]));

    const allNotifications = await db.getAll('notifications');

    let orphaned = 0;
    const byType: Record<string, number> = {};
    const byTopic: Record<string, number> = {};

    for (const notification of allNotifications) {
      // Count by type
      const type = notification.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;

      let isOrphaned = false;

      // Check if orphaned using same logic as cleanup
      const topicId = notification.data?.topicId;
      if (topicId && !validTopicIds.has(topicId)) {
        isOrphaned = true;
      } else if (topics.length === 0) {
        isOrphaned = true;
      } else if (notification.title) {
        const titleLower = notification.title.toLowerCase();
        if (titleLower.includes('acromegaly') && !validTopicNames.has('acromegaly') && !validDiseaseNames.has('acromegaly')) {
          isOrphaned = true;
        } else if ((titleLower.includes('muscular dystrophies') || titleLower.includes('muscular dystrophy')) &&
                   !validTopicNames.has('muscular dystrophies') && !validDiseaseNames.has('muscular dystrophies')) {
          isOrphaned = true;
        }
      }

      if (isOrphaned) {
        orphaned++;
        byTopic['[Orphaned]'] = (byTopic['[Orphaned]'] || 0) + 1;
      } else if (topicId && validTopicIds.has(topicId)) {
        const topicName = topicNames.get(topicId) || topicId;
        byTopic[topicName] = (byTopic[topicName] || 0) + 1;
      }
    }

    return {
      total: allNotifications.length,
      orphaned,
      byType,
      byTopic
    };
  } catch (error) {
    console.error('Failed to get notification stats:', error);
    return {
      total: 0,
      orphaned: 0,
      byType: {},
      byTopic: {}
    };
  }
}

/**
 * Clean up old notifications (older than specified days)
 */
export async function cleanupOldNotifications(daysToKeep: number = 30): Promise<{
  removed: number;
  kept: number;
}> {
  const db = await getDB();

  try {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    const allNotifications = await db.getAll('notifications');

    const tx = db.transaction(['notifications'], 'readwrite');
    const store = tx.objectStore('notifications');

    let removed = 0;
    let kept = 0;

    for (const notification of allNotifications) {
      if ((notification.createdAt || 0) < cutoffTime) {
        await store.delete(notification.id);
        removed++;
      } else {
        kept++;
      }
    }

    await tx.done;

    console.log(`Removed ${removed} old notifications (older than ${daysToKeep} days)`);

    return { removed, kept };
  } catch (error) {
    console.error('Failed to clean up old notifications:', error);
    return { removed: 0, kept: 0 };
  }
}