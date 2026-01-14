import { useState, useEffect } from 'react';
import { getDB } from '@/utils/db/database';
import { getAllTopics } from '@/utils/db/topics';

export function DebugPanel() {
  const [notificationCount, setNotificationCount] = useState(0);
  const [topicCount, setTopicCount] = useState(0);
  const [lastNotification, setLastNotification] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('DebugPanel mounted and running');

    const checkData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check topics
        const topics = await getAllTopics();
        setTopicCount(topics.length);
        console.log('DEBUG: Topics in DB:', topics.length);

        // Check notifications
        const db = await getDB();
        const notifications = await db.getAll('notifications');
        setNotificationCount(notifications.length);
        console.log('DEBUG: Notifications in DB:', notifications.length);

        if (notifications.length > 0) {
          setLastNotification(notifications[notifications.length - 1]);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('DEBUG: Error checking data:', error);
        setError(String(error));
        setIsLoading(false);
      }
    };

    checkData();
    const interval = setInterval(checkData, 2000);

    return () => clearInterval(interval);
  }, []);

  // Always render something visible
  return (
    <div
      className="fixed bottom-4 left-4 bg-red-500 p-4 rounded-lg shadow-2xl border-4 border-black text-sm"
      style={{
        zIndex: 99999,
        backgroundColor: '#FEF3C7',
        borderColor: '#D97706',
        minWidth: '200px'
      }}
    >
      <div className="font-bold mb-2 text-yellow-900">🔍 DEBUG PANEL</div>
      {isLoading ? (
        <div className="text-gray-700">Loading...</div>
      ) : error ? (
        <div className="text-red-600">Error: {error}</div>
      ) : (
        <>
          <div className="text-gray-800 font-semibold">Topics: {topicCount}</div>
          <div className="text-gray-800 font-semibold">Notifications: {notificationCount}</div>
          {lastNotification && (
            <div className="mt-2 text-xs">
              <div className="text-gray-700">Last notification:</div>
              <div className="text-gray-600">{lastNotification.title}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}