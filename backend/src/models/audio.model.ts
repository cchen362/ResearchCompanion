import { db } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface AudioRecordingDB {
  id: string;
  user_id: string;
  timeline_event_id?: string;
  topic_id?: string;
  file_name: string;
  file_size: number;
  duration: number;
  mime_type: string;
  audio_data?: Buffer;  // For storing audio blob directly
  storage_path?: string;  // For file system storage
  transcription?: string;
  transcription_status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export class AudioModel {
  /**
   * Create a new audio recording
   */
  static async create(
    userId: string,
    audioData: {
      timelineEventId?: string;
      topicId?: string;
      fileName: string;
      fileSize: number;
      duration: number;
      mimeType: string;
      audioBlob?: Buffer;
      transcription?: string;
      metadata?: any;
    }
  ): Promise<AudioRecordingDB> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO audio_recordings (
        id, user_id, timeline_event_id, topic_id, file_name,
        file_size, duration, mime_type, audio_data, transcription,
        transcription_status, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      id,
      userId,
      audioData.timelineEventId || null,
      audioData.topicId || null,
      audioData.fileName,
      audioData.fileSize,
      audioData.duration,
      audioData.mimeType,
      audioData.audioBlob || null,
      audioData.transcription || null,
      audioData.transcription ? 'completed' : 'pending',
      audioData.metadata ? JSON.stringify(audioData.metadata) : null,
      now,
      now
    ];

    try {
      const result = await db.query(query, values);
      return this.parseAudioRecording(result.rows[0]);
    } catch (error) {
      console.error('Error creating audio recording:', error);
      throw error;
    }
  }

  /**
   * Get all audio recordings for a user
   */
  static async getByUser(userId: string): Promise<AudioRecordingDB[]> {
    const query = `
      SELECT id, user_id, timeline_event_id, topic_id, file_name,
             file_size, duration, mime_type, storage_path, transcription,
             transcription_status, metadata, created_at, updated_at
      FROM audio_recordings
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    try {
      const result = await db.query(query, [userId]);
      return result.rows.map(row => this.parseAudioRecording(row));
    } catch (error) {
      console.error('Error getting user audio recordings:', error);
      throw error;
    }
  }

  /**
   * Get audio recordings for a specific topic
   */
  static async getByTopic(userId: string, topicId: string): Promise<AudioRecordingDB[]> {
    const query = `
      SELECT id, user_id, timeline_event_id, topic_id, file_name,
             file_size, duration, mime_type, storage_path, transcription,
             transcription_status, metadata, created_at, updated_at
      FROM audio_recordings
      WHERE user_id = $1 AND topic_id = $2
      ORDER BY created_at DESC
    `;

    try {
      const result = await db.query(query, [userId, topicId]);
      return result.rows.map(row => this.parseAudioRecording(row));
    } catch (error) {
      console.error('Error getting topic audio recordings:', error);
      throw error;
    }
  }

  /**
   * Get a single audio recording by ID (with audio data)
   */
  static async getById(userId: string, audioId: string): Promise<AudioRecordingDB | null> {
    const query = `
      SELECT * FROM audio_recordings
      WHERE id = $1 AND user_id = $2
    `;

    try {
      const result = await db.query(query, [audioId, userId]);
      if (result.rows.length === 0) {
        return null;
      }
      return this.parseAudioRecording(result.rows[0]);
    } catch (error) {
      console.error('Error getting audio recording:', error);
      throw error;
    }
  }

  /**
   * Get audio recording by timeline event ID
   */
  static async getByTimelineEvent(userId: string, timelineEventId: string): Promise<AudioRecordingDB | null> {
    const query = `
      SELECT * FROM audio_recordings
      WHERE timeline_event_id = $1 AND user_id = $2
    `;

    try {
      const result = await db.query(query, [timelineEventId, userId]);
      if (result.rows.length === 0) {
        return null;
      }
      return this.parseAudioRecording(result.rows[0]);
    } catch (error) {
      console.error('Error getting audio by timeline event:', error);
      throw error;
    }
  }

  /**
   * Update audio recording transcription
   */
  static async updateTranscription(
    userId: string,
    audioId: string,
    transcription: string,
    status: 'completed' | 'failed' = 'completed'
  ): Promise<AudioRecordingDB | null> {
    const query = `
      UPDATE audio_recordings
      SET transcription = $1,
          transcription_status = $2,
          updated_at = $3
      WHERE id = $4 AND user_id = $5
      RETURNING *
    `;

    try {
      const result = await db.query(query, [
        transcription,
        status,
        new Date(),
        audioId,
        userId
      ]);

      if (result.rows.length === 0) {
        return null;
      }
      return this.parseAudioRecording(result.rows[0]);
    } catch (error) {
      console.error('Error updating transcription:', error);
      throw error;
    }
  }

  /**
   * Update audio recording metadata
   */
  static async updateMetadata(
    userId: string,
    audioId: string,
    metadata: any
  ): Promise<AudioRecordingDB | null> {
    const query = `
      UPDATE audio_recordings
      SET metadata = $1,
          updated_at = $2
      WHERE id = $3 AND user_id = $4
      RETURNING *
    `;

    try {
      const result = await db.query(query, [
        JSON.stringify(metadata),
        new Date(),
        audioId,
        userId
      ]);

      if (result.rows.length === 0) {
        return null;
      }
      return this.parseAudioRecording(result.rows[0]);
    } catch (error) {
      console.error('Error updating metadata:', error);
      throw error;
    }
  }

  /**
   * Delete an audio recording
   */
  static async delete(userId: string, audioId: string): Promise<boolean> {
    const query = `
      DELETE FROM audio_recordings
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;

    try {
      const result = await db.query(query, [audioId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting audio recording:', error);
      throw error;
    }
  }

  /**
   * Delete all audio recordings for a topic
   */
  static async deleteByTopic(userId: string, topicId: string): Promise<number> {
    const query = `
      DELETE FROM audio_recordings
      WHERE user_id = $1 AND topic_id = $2
      RETURNING id
    `;

    try {
      const result = await db.query(query, [userId, topicId]);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error deleting topic audio recordings:', error);
      throw error;
    }
  }

  /**
   * Get audio recordings needing transcription
   */
  static async getPendingTranscriptions(limit: number = 10): Promise<AudioRecordingDB[]> {
    const query = `
      SELECT * FROM audio_recordings
      WHERE transcription_status = 'pending'
      ORDER BY created_at ASC
      LIMIT $1
    `;

    try {
      const result = await db.query(query, [limit]);
      return result.rows.map(row => this.parseAudioRecording(row));
    } catch (error) {
      console.error('Error getting pending transcriptions:', error);
      throw error;
    }
  }

  /**
   * Parse database row to AudioRecordingDB
   */
  private static parseAudioRecording(row: any): AudioRecordingDB {
    return {
      id: row.id,
      user_id: row.user_id,
      timeline_event_id: row.timeline_event_id,
      topic_id: row.topic_id,
      file_name: row.file_name,
      file_size: row.file_size,
      duration: row.duration,
      mime_type: row.mime_type,
      audio_data: row.audio_data,
      storage_path: row.storage_path,
      transcription: row.transcription,
      transcription_status: row.transcription_status,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}