-- Migration: Create digest_queue table for server-side queue management
-- Purpose: Move digest queue from IndexedDB to PostgreSQL for multi-device sync
-- Issue: Fixes Issue 17 - "Digest Shows 'Generating AI-Powered Insights' Animation on Every Page Load"
-- Date: 2026-02-03

-- Create digest_queue table
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

  -- Prevent duplicate active queues for same topic/user/type/timeframe
  CONSTRAINT unique_active_queue UNIQUE NULLS NOT DISTINCT (user_id, topic_id, digest_type, timeframe, status)
);

-- Indexes for efficient queries
CREATE INDEX idx_digest_queue_user_topic ON digest_queue(user_id, topic_id);
CREATE INDEX idx_digest_queue_status ON digest_queue(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_digest_queue_created_at ON digest_queue(created_at DESC);
CREATE INDEX idx_digest_queue_topic_timeframe ON digest_queue(topic_id, timeframe);

-- Function to auto-cancel old pending items (older than 1 hour)
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

-- Function to get active queue for a topic
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
  -- First, clean up stale items
  PERFORM cancel_stale_digest_queue_items();

  -- Return active queue if exists
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
    AND status IN ('pending', 'processing')
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Add comment to table
COMMENT ON TABLE digest_queue IS 'Server-side digest generation queue for reliable multi-device synchronization';
COMMENT ON COLUMN digest_queue.status IS 'Queue item status: pending (waiting), processing (generating), completed (done), failed (error), cancelled (timeout)';
COMMENT ON COLUMN digest_queue.metadata IS 'Additional data like model used, token count, processing time, etc.';