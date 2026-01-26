import { Router } from 'express';
import { AudioModel } from '../models/audio.model.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * Get all audio recordings for the authenticated user
 */
router.get('/audio', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const recordings = await AudioModel.getByUser(userId);

    // Don't send audio_data in list view to reduce payload
    const recordingsWithoutData = recordings.map(r => ({
      ...r,
      audio_data: undefined
    }));

    res.json({
      success: true,
      recordings: recordingsWithoutData
    });
  } catch (error) {
    console.error('Error fetching audio recordings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audio recordings'
    });
  }
});

/**
 * Get audio recordings for a specific topic
 */
router.get('/audio/topic/:topicId', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { topicId } = req.params;

    if (!topicId) {
      return res.status(400).json({
        success: false,
        error: 'Topic ID is required'
      });
    }

    const recordings = await AudioModel.getByTopic(userId, topicId);

    // Don't send audio_data in list view
    const recordingsWithoutData = recordings.map(r => ({
      ...r,
      audio_data: undefined
    }));

    res.json({
      success: true,
      recordings: recordingsWithoutData
    });
  } catch (error) {
    console.error('Error fetching topic audio recordings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch topic audio recordings'
    });
  }
});

/**
 * Get a single audio recording by ID (includes audio data)
 */
router.get('/audio/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const recording = await AudioModel.getById(userId, id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Audio recording not found'
      });
    }

    // Convert audio_data buffer to base64 if present
    if (recording.audio_data) {
      const audioBase64 = recording.audio_data.toString('base64');
      res.json({
        success: true,
        recording: {
          ...recording,
          audio_data: audioBase64
        }
      });
    } else {
      res.json({
        success: true,
        recording
      });
    }
  } catch (error) {
    console.error('Error fetching audio recording:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audio recording'
    });
  }
});

/**
 * Get audio recording by timeline event ID
 */
router.get('/audio/timeline/:timelineEventId', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { timelineEventId } = req.params;

    const recording = await AudioModel.getByTimelineEvent(userId, timelineEventId);

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Audio recording not found for this timeline event'
      });
    }

    // Convert audio_data buffer to base64 if present
    if (recording.audio_data) {
      const audioBase64 = recording.audio_data.toString('base64');
      res.json({
        success: true,
        recording: {
          ...recording,
          audio_data: audioBase64
        }
      });
    } else {
      res.json({
        success: true,
        recording
      });
    }
  } catch (error) {
    console.error('Error fetching audio by timeline event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audio recording'
    });
  }
});

/**
 * Create a new audio recording
 */
router.post('/audio', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const {
      timelineEventId,
      topicId,
      fileName,
      fileSize,
      duration,
      mimeType,
      audioData,
      transcription,
      metadata
    } = req.body;

    // Validate required fields
    if (!fileName || !fileSize || !duration || !mimeType) {
      return res.status(400).json({
        success: false,
        error: 'File name, size, duration, and MIME type are required'
      });
    }

    // Convert base64 audio data to buffer if present
    let audioBuffer: Buffer | undefined;
    if (audioData) {
      audioBuffer = Buffer.from(audioData, 'base64');
    }

    const recording = await AudioModel.create(userId, {
      timelineEventId,
      topicId,
      fileName,
      fileSize,
      duration,
      mimeType,
      audioBlob: audioBuffer,
      transcription,
      metadata
    });

    res.status(201).json({
      success: true,
      recording: {
        ...recording,
        audio_data: undefined // Don't send back the audio data
      }
    });
  } catch (error) {
    console.error('Error creating audio recording:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create audio recording'
    });
  }
});

/**
 * Update audio recording transcription
 */
router.put('/audio/:id/transcription', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { transcription, status } = req.body;

    if (!transcription) {
      return res.status(400).json({
        success: false,
        error: 'Transcription is required'
      });
    }

    const recording = await AudioModel.updateTranscription(
      userId,
      id,
      transcription,
      status || 'completed'
    );

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Audio recording not found or not authorized'
      });
    }

    res.json({
      success: true,
      recording: {
        ...recording,
        audio_data: undefined
      }
    });
  } catch (error) {
    console.error('Error updating transcription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update transcription'
    });
  }
});

/**
 * Update audio recording metadata
 */
router.put('/audio/:id/metadata', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { metadata } = req.body;

    if (!metadata) {
      return res.status(400).json({
        success: false,
        error: 'Metadata is required'
      });
    }

    const recording = await AudioModel.updateMetadata(userId, id, metadata);

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Audio recording not found or not authorized'
      });
    }

    res.json({
      success: true,
      recording: {
        ...recording,
        audio_data: undefined
      }
    });
  } catch (error) {
    console.error('Error updating metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update metadata'
    });
  }
});

/**
 * Delete an audio recording
 */
router.delete('/audio/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const deleted = await AudioModel.delete(userId, id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Audio recording not found or not authorized'
      });
    }

    res.json({
      success: true,
      message: 'Audio recording deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting audio recording:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete audio recording'
    });
  }
});

/**
 * Delete all audio recordings for a topic
 */
router.delete('/audio/topic/:topicId', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { topicId } = req.params;

    const count = await AudioModel.deleteByTopic(userId, topicId);

    res.json({
      success: true,
      message: `Deleted ${count} audio recordings for topic`,
      count
    });
  } catch (error) {
    console.error('Error deleting topic audio recordings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete topic audio recordings'
    });
  }
});

export default router;