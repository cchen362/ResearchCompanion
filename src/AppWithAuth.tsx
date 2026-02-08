import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { initDB, requestPersistentStorage } from './utils/db/database';
import { topicsService } from './services/topics.service';
import { logger } from '@/utils/logger';
import { authService } from './services/auth.service';
import { HomePage } from './components/HomePage';
import TopicManager from './components/TopicManager';
import AgentMonitor from './components/agents/AgentMonitor';
import { ResearchPage } from './components/research';
import ErrorBoundary from './components/ErrorBoundary';
import { ChatPanel } from './components/ChatPanel';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { AuthGuard } from './components/auth/AuthGuard';
import NotificationCenter from './components/NotificationCenter';
import { useUIStore } from './stores/uiStore';
import { Container } from './components/ui/container';
import { cn } from '@/lib/utils';
import { useIsWideViewport } from './hooks/useViewport';
import { MessageSquare, LogOut, Menu, X, Bell } from 'lucide-react';
import type { Topic } from './types';
import type { AuthUser } from './services/auth.service';
import './App.css';

function MainApp() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'topics' | 'agents' | 'findings'>('home');
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { chatPanelOpen, setChatPanelOpen, chatFullscreen, toggleChatFullscreen } = useUIStore();
  const isWideViewport = useIsWideViewport();
  const usePushLayout = isWideViewport && chatPanelOpen && !chatFullscreen;

  // Function to refresh topics
  const refreshTopics = async () => {
    try {
      const allTopics = await topicsService.getTopics();
      setTopics(allTopics);

      // Auto-select first topic if none selected and topics exist
      if (!selectedTopic && allTopics.length > 0) {
        setSelectedTopic(allTopics[0]);
      }
    } catch (err) {
      logger.error('Failed to refresh topics:', err);
    }
  };

  // One-time cleanup: remove stale chat localStorage data from old persist middleware
  useEffect(() => {
    localStorage.removeItem('chat-store');
  }, []);

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
      } catch (err) {
        logger.error('Failed to initialize app:', err);
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

  const handleLogout = () => {
    authService.logout();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 dark:bg-red-950/20 flex items-center justify-center p-4">
        <div className="bg-[var(--color-surface)] rounded-lg shadow-xl p-6 max-w-md">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-[var(--color-text-secondary)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-sunken)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-[var(--color-text-secondary)]">Initializing Medical Research Companion...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-sunken)]">
      {/* Header */}
      <header className="bg-[var(--color-surface)] shadow-sm border-b border-[var(--color-border)]">
        <div className="mx-auto w-full" style={{ paddingInline: 'clamp(1rem, 4vw, 3rem)' }}>
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg sm:text-xl font-semibold text-[var(--color-text-primary)]">
                Medical Research Companion
              </h1>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-2">
              <button
                onClick={() => setCurrentView('home')}
                className={`hidden sm:block px-3 py-1.5 rounded-lg text-sm font-medium ${
                  currentView === 'home'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => setCurrentView('topics')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  currentView === 'topics'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]'
                }`}
              >
                Topics
              </button>
              <button
                onClick={() => setCurrentView('agents')}
                className={`hidden sm:block px-3 py-1.5 rounded-lg text-sm font-medium ${
                  currentView === 'agents'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]'
                }`}
              >
                Agents
              </button>
              <button
                onClick={() => setCurrentView('findings')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  currentView === 'findings'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]'
                }`}
              >
                Findings
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
                      ? 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)]'
                      : 'text-[var(--color-text-muted)] cursor-not-allowed'
                  }`}
                  title={topics.length > 0 ? "Open chat" : "Create a topic first"}
                  disabled={topics.length === 0}
                >
                  <MessageSquare className="w-5 h-5" />
                  {chatPanelOpen && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary-500 rounded-full"></span>
                  )}
                </button>

                {/* User dropdown */}
                <div className="relative ml-2">
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 rounded-md text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)] flex items-center gap-2 border border-[var(--color-border)]"
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
        <div className="md:hidden bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-2">
          <div className="space-y-1">
            <button
              onClick={() => {
                setCurrentView('home');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                currentView === 'home'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => {
                setCurrentView('topics');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                currentView === 'topics'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]'
              }`}
            >
              Topics
            </button>
            <button
              onClick={() => {
                setCurrentView('agents');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                currentView === 'agents'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]'
              }`}
            >
              Agents
            </button>
            <button
              onClick={() => {
                setCurrentView('findings');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                currentView === 'findings'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]'
              }`}
            >
              Findings
            </button>
            <hr className="my-2 border-[var(--color-border)]" />
            <div className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">
              {currentUser?.email}
            </div>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Main Content + Chat Layout Wrapper */}
      <div className="flex min-h-[calc(100vh-64px)]">
        {/* Main Content — shrinks when chat pushes on wide screens */}
        <main className={cn(
          'py-8 flex-1 min-w-0 transition-all duration-300',
          usePushLayout && 'mr-[500px]'
        )}>
          <Container variant={currentView === 'home' ? 'wide' : 'grid'}>
            <ErrorBoundary>
              {currentView === 'home' && (
                <HomePage
                  topics={topics}
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
                <ResearchPage
                  topicId={selectedTopic?.id}
                />
              )}
            </ErrorBoundary>
          </Container>
        </main>

        {/* Chat Panel — Push mode (wide) or Overlay mode (narrow) */}
        {chatPanelOpen && selectedTopic && (
          <>
            {chatFullscreen ? (
              <div className="fixed inset-0 z-50 bg-[var(--color-surface)]">
                <Container variant="reading" className="h-full">
                  <ChatPanel
                    topicId={selectedTopic.id}
                    topicName={selectedTopic.name}
                    onClose={() => { setChatPanelOpen(false); toggleChatFullscreen(); }}
                    onToggleFullscreen={toggleChatFullscreen}
                    isFullscreen={chatFullscreen}
                    className="h-full w-full"
                  />
                </Container>
              </div>
            ) : (
              <div
                className={cn(
                  'fixed right-0 bg-[var(--color-surface)] border-l border-[var(--color-border)]',
                  usePushLayout
                    ? 'top-16 h-[calc(100vh-64px)] z-40 shadow-sm'
                    : 'top-0 h-full z-50 shadow-xl rounded-l-xl'
                )}
                style={{ width: '500px' }}
              >
                <ChatPanel
                  topicId={selectedTopic.id}
                  topicName={selectedTopic.name}
                  onClose={() => setChatPanelOpen(false)}
                  onToggleFullscreen={toggleChatFullscreen}
                  isFullscreen={chatFullscreen}
                  className="h-full w-full"
                />
              </div>
            )}
          </>
        )}
      </div>
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