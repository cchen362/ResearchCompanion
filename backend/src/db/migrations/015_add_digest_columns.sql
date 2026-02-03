-- Migration: Add missing columns to digests table
-- Fixes: Issue 22 - "column layman_summary does not exist" error
-- Date: 2026-02-04
-- Author: Medical Companion PWA Team

-- Add missing columns that backend expects but were not in original schema
ALTER TABLE digests
ADD COLUMN IF NOT EXISTS layman_summary TEXT,
ADD COLUMN IF NOT EXISTS key_takeaways JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS trends JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS clinical_implications JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS lifestyle_considerations JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS questions_for_doctor JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS warning_signs JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_digests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS digest_updated_at_trigger ON digests;

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER digest_updated_at_trigger
BEFORE UPDATE ON digests
FOR EACH ROW
EXECUTE FUNCTION update_digests_updated_at();

-- Add comments for documentation
COMMENT ON COLUMN digests.layman_summary IS 'Simplified summary for non-medical users';
COMMENT ON COLUMN digests.key_takeaways IS 'Array of key points from the digest';
COMMENT ON COLUMN digests.trends IS 'Identified trends: emerging, declining, stable';
COMMENT ON COLUMN digests.clinical_implications IS 'Clinical relevance and implications';
COMMENT ON COLUMN digests.lifestyle_considerations IS 'Lifestyle and behavioral recommendations';
COMMENT ON COLUMN digests.questions_for_doctor IS 'Questions to discuss with healthcare provider';
COMMENT ON COLUMN digests.warning_signs IS 'Warning signs to watch for';
COMMENT ON COLUMN digests.updated_at IS 'Timestamp of last update';

-- Rollback instructions (if needed):
-- ALTER TABLE digests DROP COLUMN IF EXISTS layman_summary;
-- ALTER TABLE digests DROP COLUMN IF EXISTS key_takeaways;
-- ALTER TABLE digests DROP COLUMN IF EXISTS trends;
-- ALTER TABLE digests DROP COLUMN IF EXISTS clinical_implications;
-- ALTER TABLE digests DROP COLUMN IF EXISTS lifestyle_considerations;
-- ALTER TABLE digests DROP COLUMN IF EXISTS questions_for_doctor;
-- ALTER TABLE digests DROP COLUMN IF EXISTS warning_signs;
-- ALTER TABLE digests DROP COLUMN IF EXISTS updated_at;
-- DROP TRIGGER IF EXISTS digest_updated_at_trigger ON digests;
-- DROP FUNCTION IF EXISTS update_digests_updated_at();