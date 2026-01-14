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
import { ChatPanel } from './components/ChatPanel';
import { AnalyticsView } from './components/AnalyticsView';
import { useUIStore } from './stores/uiStore';
import { MessageSquare } from 'lucide-react';
import type { Topic } from './types';
import './App.css';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'topics' | 'agents' | 'findings' | 'timeline' | 'voice' | 'analytics'>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  const { chatPanelOpen, setChatPanelOpen } = useUIStore();

  // Function to refresh topics from database
  const refreshTopics = async () => {
    try {
      const allTopics = await getAllTopics();
      setTopics(allTopics);
    } catch (err) {
      console.error('Failed to refresh topics:', err);
    }
  };

  useEffect(() => {
    // Initialize database and request persistent storage
    const setupApp = async () => {
      try {
        await initDB();
        await requestPersistentStorage();
        setIsDbReady(true);

        // Load topics
        await refreshTopics();

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

  // Refresh topics when returning from topics view or any other view that might have changed topics
  useEffect(() => {
    if (isDbReady && (currentView === 'dashboard' || currentView === 'voice' || currentView === 'agents')) {
      refreshTopics();
    }
  }, [currentView, isDbReady]);

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
              <button
                onClick={() => setCurrentView('analytics')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'analytics'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Research Insights
              </button>
            </nav>

            <div className="flex items-center space-x-4">
              {/* Topic selector for chat */}
              {topics.length > 1 && (
                <select
                  value={selectedTopic?.id || ''}
                  onChange={(e) => {
                    const topic = topics.find(t => t.id === e.target.value);
                    setSelectedTopic(topic || null);
                  }}
                  className="text-sm border rounded-md px-2 py-1 bg-white"
                  title="Select topic for chat"
                >
                  <option value="">Select Topic</option>
                  {topics.map(topic => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Chat button */}
              {topics.length > 0 && (
                <button
                  onClick={() => {
                    if (!selectedTopic && topics.length > 0) {
                      setSelectedTopic(topics[0]);
                    }
                    setChatPanelOpen(!chatPanelOpen);
                  }}
                  className="relative p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Open AI Chat"
                >
                  <MessageSquare className="h-5 w-5" />
                  {chatPanelOpen && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full"></span>
                  )}
                </button>
              )}

              {/* Notification icon */}
              <ErrorBoundary fallback={null}>
                <NotificationCenter />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' && <Dashboard setCurrentView={setCurrentView} />}
        {currentView === 'topics' && (
          <TopicManager
            onTopicsChange={refreshTopics}
          />
        )}
        {currentView === 'agents' && <AgentMonitor />}
        {currentView === 'findings' && <FindingsViewerProgressive />}
        {currentView === 'timeline' && <Timeline />}
        {currentView === 'voice' && (
          <VoiceRecorder
            topics={topics}
            onComplete={refreshTopics}
          />
        )}
        {currentView === 'analytics' && <AnalyticsView />}
      </main>

      {/* Chat Panel - Slide in from right */}
      {chatPanelOpen && selectedTopic && (
        <div className="fixed right-0 top-0 h-full z-40 shadow-2xl bg-white" style={{ width: '500px' }}>
          <ChatPanel
            topicId={selectedTopic.id}
            topicName={selectedTopic.name}
            onClose={() => setChatPanelOpen(false)}
            className="h-full w-full"
          />
        </div>
      )}
    </div>
  );
}

export default App;