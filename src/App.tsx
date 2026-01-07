import { useEffect, useState } from 'react';
import { initDB, requestPersistentStorage } from './utils/db/database';
import { getAllTopics } from './utils/db/topics';
import { registerServiceWorker, listenForInstallPrompt, scheduleAgentCheck } from './utils/serviceWorker';
import Dashboard from './components/Dashboard';
import TopicManager from './components/TopicManager';
import AgentMonitor from './components/agents/AgentMonitor';
import FindingsViewerProgressive from './components/FindingsViewerProgressive';
import NotificationCenter from './components/NotificationCenter';
import VoiceRecorder from './components/VoiceRecorder';
import Timeline from './components/Timeline';
import ErrorBoundary from './components/ErrorBoundary';
import type { Topic } from './types';
import './App.css';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'topics' | 'agents' | 'findings' | 'timeline' | 'voice'>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    // Initialize database and request persistent storage
    const setupApp = async () => {
      try {
        await initDB();
        await requestPersistentStorage();
        setIsDbReady(true);

        // Load topics
        const allTopics = await getAllTopics();
        setTopics(allTopics);

        // Register service worker
        try {
          await registerServiceWorker();

          // Listen for PWA install prompt
          listenForInstallPrompt();

          // Schedule agent checks every hour - but don't fail if it times out
          scheduleAgentCheck(60).catch(err => {
            console.warn('Agent scheduling failed (non-critical):', err);
          });
        } catch (swError) {
          console.warn('Service worker registration failed (non-critical):', swError);
          // Continue without service worker - app still works
        }
      } catch (err) {
        console.error('Failed to initialize app:', err);
        setError('Failed to initialize the application. Please refresh the page.');
      }
    };

    setupApp();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Initializing Medical Research Companion...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Medical Research Companion
              </h1>
            </div>

            {/* Navigation */}
            <nav className="flex space-x-4">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'dashboard'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('topics')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'topics'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Topics
              </button>
              <button
                onClick={() => setCurrentView('agents')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'agents'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Agents
              </button>
              <button
                onClick={() => setCurrentView('findings')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'findings'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Findings
              </button>
              <button
                onClick={() => setCurrentView('timeline')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'timeline'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => setCurrentView('voice')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'voice'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Voice
              </button>
            </nav>

            {/* Notification icon */}
            <ErrorBoundary fallback={null}>
              <NotificationCenter />
            </ErrorBoundary>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'topics' && <TopicManager />}
        {currentView === 'agents' && <AgentMonitor />}
        {currentView === 'findings' && <FindingsViewerProgressive />}
        {currentView === 'timeline' && <Timeline />}
        {currentView === 'voice' && (
          <VoiceRecorder
            topics={topics}
            onComplete={async () => {
              // Refresh topics after recording
              const updatedTopics = await getAllTopics();
              setTopics(updatedTopics);
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;