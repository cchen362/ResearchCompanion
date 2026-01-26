import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { initDB, requestPersistentStorage } from './utils/db/database';
import { getAllTopics } from './utils/db/topics';
import { registerServiceWorker, listenForInstallPrompt, scheduleAgentCheck } from './utils/serviceWorker';
import { authService } from './services/auth.service';
import Dashboard from './components/Dashboard';
import TopicManager from './components/TopicManager';
import AgentMonitor from './components/agents/AgentMonitor';
import FindingsViewerProgressive from './components/FindingsViewerProgressive';
import VoiceRecorder from './components/VoiceRecorder';
import Timeline from './components/Timeline';
import ErrorBoundary from './components/ErrorBoundary';
import { ChatPanel } from './components/ChatPanelLazy';
import { AnalyticsView } from './components/AnalyticsView';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { AuthGuard } from './components/auth/AuthGuard';
import NotificationCenter from './components/NotificationCenter';
import { useUIStore } from './stores/uiStore';
import { MessageSquare, LogOut, Menu, X, Bell } from 'lucide-react';
import type { Topic } from './types';
import type { AuthUser } from './services/auth.service';
import './App.css';

function MainApp() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'topics' | 'agents' | 'findings' | 'timeline' | 'voice' | 'research'>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { chatPanelOpen, setChatPanelOpen } = useUIStore();

  // Function to refresh topics
  const refreshTopics = async () => {
    try {
      const allTopics = await getAllTopics();
      setTopics(allTopics);

      // Auto-select first topic if none selected and topics exist
      if (!selectedTopic && allTopics.length > 0) {
        setSelectedTopic(allTopics[0]);
      }
    } catch (err) {
      console.error('Failed to refresh topics:', err);
    }
  };

  useEffect(() => {
    // Initialize database and request persistent storage
    const setupApp = async () => {
      try {
        // Initialize auth
        const user = await authService.initialize();
        if (user) {
          setCurrentUser(user);
        }

        await initDB();
        await requestPersistentStorage();
        setIsDbReady(true);

        // Load topics
        await refreshTopics();

        // Service worker disabled - server-first architecture
        // Per CLAUDE.md: No offline support, service worker removed
        // try {
        //   await registerServiceWorker();
        //   listenForInstallPrompt();
        //   scheduleAgentCheck(60).catch(err => {
        //     console.warn('Agent scheduling failed (non-critical):', err);
        //   });
        // } catch (swError) {
        //   console.warn('Service worker registration failed (non-critical):', swError);
        // }
      } catch (err) {
        console.error('Failed to initialize app:', err);
        setError('Failed to initialize the application. Please refresh the page.');
      }
    };

    setupApp();
  }, []);

  // Listen for events that should trigger topic refresh
  useEffect(() => {
    const handleAgentComplete = () => {
      refreshTopics();
    };

    const handleTopicCreated = () => {
      refreshTopics();
    };

    const handleDigestCompleted = () => {
      refreshTopics();
    };

    window.addEventListener('agent-complete', handleAgentComplete);
    window.addEventListener('topic-created', handleTopicCreated);
    window.addEventListener('digest-completed', handleDigestCompleted);

    return () => {
      window.removeEventListener('agent-complete', handleAgentComplete);
      window.removeEventListener('topic-created', handleTopicCreated);
      window.removeEventListener('digest-completed', handleDigestCompleted);
    };
  }, []);

  // Also refresh topics periodically
  useEffect(() => {
    if (isDbReady) {
      const interval = setInterval(refreshTopics, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [isDbReady]);

  const handleLogout = () => {
    authService.logout();
  };

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
            <div className="flex items-center space-x-4">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                Medical Research Companion
              </h1>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-2">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`hidden sm:block px-2 py-1 rounded-md text-sm font-medium ${
                  currentView === 'dashboard'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('topics')}
                className={`px-2 py-1 rounded-md text-sm font-medium ${
                  currentView === 'topics'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Topics
              </button>
              <button
                onClick={() => setCurrentView('agents')}
                className={`hidden sm:block px-2 py-1 rounded-md text-sm font-medium ${
                  currentView === 'agents'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Agents
              </button>
              <button
                onClick={() => setCurrentView('findings')}
                className={`px-2 py-1 rounded-md text-sm font-medium ${
                  currentView === 'findings'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Findings
              </button>
              <button
                onClick={() => setCurrentView('timeline')}
                className={`hidden lg:block px-2 py-1 rounded-md text-sm font-medium ${
                  currentView === 'timeline'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => setCurrentView('voice')}
                className={`hidden lg:block px-2 py-1 rounded-md text-sm font-medium ${
                  currentView === 'voice'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Voice
              </button>
              <button
                onClick={() => setCurrentView('research')}
                className={`hidden md:block px-2 py-1 rounded-md text-sm font-medium ${
                  currentView === 'research'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Research Insights
              </button>

              {/* Action icons */}
              <div className="flex items-center space-x-2 ml-4 border-l pl-4">
                {/* Notification Center */}
                <NotificationCenter />

                {/* Chat Icon */}
                <button
                  onClick={() => {
                    if (topics.length > 0) {
                      // If no topic is selected, select the first one
                      if (!selectedTopic) {
                        setSelectedTopic(topics[0]);
                      }
                      setChatPanelOpen(!chatPanelOpen);
                    }
                  }}
                  className={`p-2 rounded-full ${
                    topics.length > 0
                      ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                  title={topics.length > 0 ? "Open chat" : "Create a topic first"}
                  disabled={topics.length === 0}
                >
                  <MessageSquare className="w-5 h-5" />
                  {chatPanelOpen && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full"></span>
                  )}
                </button>

                {/* User dropdown */}
                <div className="relative ml-2">
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-2 border border-gray-300"
                    title={currentUser?.email}
                  >
                    <span className="hidden sm:inline max-w-[150px] truncate">
                      {currentUser?.email?.split('@')[0]}
                    </span>
                    <LogOut className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-2">
          <div className="space-y-1">
            <button
              onClick={() => {
                setCurrentView('dashboard');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                currentView === 'dashboard'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => {
                setCurrentView('topics');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                currentView === 'topics'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Topics
            </button>
            <button
              onClick={() => {
                setCurrentView('agents');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                currentView === 'agents'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Agents
            </button>
            <button
              onClick={() => {
                setCurrentView('findings');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                currentView === 'findings'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Findings
            </button>
            <button
              onClick={() => {
                setCurrentView('timeline');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                currentView === 'timeline'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => {
                setCurrentView('voice');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                currentView === 'voice'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Voice
            </button>
            <button
              onClick={() => {
                setCurrentView('research');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                currentView === 'research'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Research Insights
            </button>
            <hr className="my-2 border-gray-200" />
            <div className="px-3 py-2 text-sm text-gray-600">
              {currentUser?.email}
            </div>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorBoundary>
          {currentView === 'dashboard' && (
            <Dashboard
              topics={topics}
              selectedTopic={selectedTopic}
              onSelectTopic={setSelectedTopic}
              setCurrentView={setCurrentView}
            />
          )}
          {currentView === 'topics' && (
            <TopicManager
              topics={topics}
              setTopics={setTopics}
              selectedTopic={selectedTopic}
              setSelectedTopic={setSelectedTopic}
            />
          )}
          {currentView === 'agents' && (
            <AgentMonitor
              topics={topics}
              selectedTopic={selectedTopic}
            />
          )}
          {currentView === 'findings' && (
            <FindingsViewerProgressive
              topicId={selectedTopic?.id}
              topicName={selectedTopic?.name}
            />
          )}
          {currentView === 'timeline' && (
            <Timeline topicId={selectedTopic?.id} />
          )}
          {currentView === 'voice' && (
            <VoiceRecorder
              topicId={selectedTopic?.id}
              topics={topics}
            />
          )}
          {currentView === 'research' && (
            <AnalyticsView
              topics={topics}
              selectedTopic={selectedTopic}
            />
          )}
        </ErrorBoundary>
      </main>

      {/* Chat Panel - Slide in from right */}
      {chatPanelOpen && selectedTopic && (
        <div className="fixed right-0 top-0 h-full z-50 shadow-2xl bg-white" style={{ width: '500px' }}>
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

export default function AppWithAuth() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <MainApp />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}