-- Medical Companion PWA Database Schema
-- PostgreSQL 15
-- This script initializes the database with all required tables and indexes

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (for authentication and multi-device access)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP WITH TIME ZONE
);

-- Device tracking for multi-device support
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_id)
);

-- Topics table (medical conditions/diseases being tracked)
CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    patient_context JSONB DEFAULT '{}', -- age, symptoms, comorbidities, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    archived BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    last_digest_viewed_at TIMESTAMP WITH TIME ZONE
);

-- Research agents configuration
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'pubmed', 'clinical_trials', 'treatment', 'general'
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    schedule VARCHAR(50), -- 'daily', 'weekly', 'manual'
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Research findings from agents
CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    source JSONB NOT NULL, -- {type, name, displayName, url, journal, publishDate}
    metadata JSONB DEFAULT '{}',
    relevance_score DECIMAL(3,2),
    category VARCHAR(50), -- 'research', 'treatment', 'clinical_trial', 'news'
    tags TEXT[],
    is_read BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI-generated digests
CREATE TABLE IF NOT EXISTS digests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(500),
    whats_new JSONB DEFAULT '{}'::jsonb,
    key_takeaways JSONB DEFAULT '[]'::jsonb,
    featured_discovery JSONB DEFAULT NULL,
    notable_findings JSONB DEFAULT '[]'::jsonb,
    source_breakdown JSONB DEFAULT NULL,
    for_your_doctor JSONB DEFAULT '{}'::jsonb,
    finding_ids UUID[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Digest generation queue
CREATE TABLE IF NOT EXISTS digest_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL,
    digest_type VARCHAR(50) NOT NULL DEFAULT 'smart',
    timeframe VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    result_id UUID REFERENCES digests(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    CONSTRAINT unique_active_queue UNIQUE (user_id, topic_id, digest_type, timeframe)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT,
    priority VARCHAR(20) DEFAULT 'normal',
    data JSONB DEFAULT '{}',
    read_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat conversations (using 'chats' table as per actual application code)
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    context JSONB DEFAULT '{}',
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages (using 'chat_messages' table as per actual application code)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    citations JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User preferences and settings
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'light',
    notifications_enabled BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT false,
    auto_generate_digests BOOLEAN DEFAULT true,
    digest_frequency VARCHAR(20) DEFAULT 'weekly',
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    privacy_settings JSONB DEFAULT '{}',
    ui_preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Session management for authentication
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255),
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_topics_user_id ON topics(user_id);
CREATE INDEX idx_topics_created_at ON topics(created_at DESC);
CREATE INDEX idx_findings_user_id ON findings(user_id);
CREATE INDEX idx_findings_topic_id ON findings(topic_id);
CREATE INDEX idx_findings_created_at ON findings(created_at DESC);
CREATE INDEX idx_findings_category ON findings(category);
CREATE INDEX idx_findings_is_starred ON findings(is_starred) WHERE is_starred = true;
-- Prevent duplicate findings by source URL per user+topic
CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_unique_source_url
ON findings (user_id, topic_id, (source->>'url'))
WHERE source->>'url' IS NOT NULL AND source->>'url' <> '#';
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_topic_id ON chats(user_id, topic_id);
CREATE INDEX idx_chats_last_message ON chats(last_message_at DESC);
CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id, created_at);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);

-- Digest queue indexes
CREATE INDEX idx_digest_queue_user_topic ON digest_queue(user_id, topic_id);
CREATE INDEX idx_digest_queue_status ON digest_queue(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_digest_queue_created_at ON digest_queue(created_at DESC);
CREATE INDEX idx_digest_queue_topic_timeframe ON digest_queue(topic_id, timeframe);

-- Notification indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- Composite indexes for common query patterns
CREATE INDEX idx_findings_user_topic ON findings(user_id, topic_id);
CREATE INDEX idx_digests_user_topic ON digests(user_id, topic_id);
CREATE INDEX idx_digests_created_at ON digests(created_at DESC);

-- Create update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON topics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_findings_updated_at BEFORE UPDATE ON findings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_digests_updated_at BEFORE UPDATE ON digests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update chat's last_message_at when a message is added
CREATE OR REPLACE FUNCTION update_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chats
    SET last_message_at = CURRENT_TIMESTAMP,
        message_count = message_count + 1
    WHERE id = NEW.chat_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_timestamp
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at();

-- Digest queue helper functions
CREATE OR REPLACE FUNCTION cancel_stale_digest_queue_items()
RETURNS void AS $$
BEGIN
  UPDATE digest_queue
  SET
    status = 'cancelled',
    completed_at = CURRENT_TIMESTAMP,
    error = 'Cancelled due to timeout (stale queue item)'
  WHERE
    status = 'pending'
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_active_queue_for_topic(
  p_user_id UUID,
  p_topic_id UUID,
  p_timeframe VARCHAR(50)
)
RETURNS TABLE (
  queue_id UUID,
  status VARCHAR(50),
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ
) AS $$
BEGIN
  PERFORM cancel_stale_digest_queue_items();
  RETURN QUERY
  SELECT
    id as queue_id,
    digest_queue.status,
    digest_queue.created_at,
    digest_queue.started_at
  FROM digest_queue
  WHERE
    user_id = p_user_id
    AND topic_id = p_topic_id
    AND timeframe = p_timeframe
    AND digest_queue.status IN ('pending', 'processing')
  ORDER BY digest_queue.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create default admin user (optional, remove in production)
-- Password: admin123 (change this!)
INSERT INTO users (email, password_hash, name, email_verified)
VALUES ('admin@medcompanion.local', '$2b$10$RPw3fkQ/EpAc6QKYeRnMb.PkSvrBrDLTBg8nUOKA/B/tvImJVdywK', 'Admin User', true)
ON CONFLICT (email) DO NOTHING;

-- Grant permissions (adjust as needed for your setup)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO meduser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO meduser;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO meduser;