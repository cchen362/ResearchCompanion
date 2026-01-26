import api from './api';
import type { AudioRecording } from '@/types';

/**
 * Audio API Service
 * Handles all audio recording-related API calls to the backend
 */
class AudioAPIService {
  /**
   * Get all audio recordings for the current user
   */
  async getAllRecordings(): Promise<AudioRecording[]> {
    try {
      const response = await api.get('/audio');
      return this.transformRecordings(response.data.recordings || []);
    } catch (error) {
      console.error('Error fetching all audio recordings:', error);
      throw error;
    }
  }

  /**
   * Get audio recordings for a specific topic
   */
  async getRecordingsByTopic(topicId: string): Promise<AudioRecording[]> {
    try {
      const response = await api.get(`/audio/topic/${topicId}`);
      return this.transformRecordings(response.data.recordings || []);
    } catch (error) {
      console.error(`Error fetching audio for topic ${topicId}:`, error);
      throw error;
    }
  }

  /**
   * Get a single audio recording by ID (includes audio data)
   */
  async getRecording(audioId: string): Promise<AudioRecording | null> {
    try {
      const response = await api.get(`/audio/${audioId}`);
      return this.transformRecording(response.data.recording);
    } catch (error) {
      console.error(`Error fetching audio recording ${audioId}:`, error);
      if ((error as any).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get audio recording by timeline event ID
   */
  async getRecordingByTimelineEvent(timelineEventId: string): Promise<AudioRecording | null> {
    try {
      const response = await api.get(`/audio/timeline/${timelineEventId}`);
      return this.transformRecording(response.data.recording);
    } catch (error) {
      console.error(`Error fetching audio by timeline event ${timelineEventId}:`, error);
      if ((error as any).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new audio recording
   */
  async createRecording(data: {
    timelineEventId?: string;
    topicId?: string;
    fileName: string;
    fileSize: number;
    duration: number;
    mimeType: string;
    audioData?: string; // Base64
    transcription?: string;
    metadata?: any;
  }): Promise<AudioRecording> {
    try {
      const response = await api.post('/audio', data);
      return this.transformRecording(response.data.recording);
    } catch (error) {
      console.error('Error creating audio recording:', error);
      throw error;
    }
  }

  /**
   * Update audio recording transcription
   */
  async updateTranscription(
    audioId: string,
    transcription: string,
    status?: 'completed' | 'failed'
  ): Promise<AudioRecording> {
    try {
      const response = await api.put(`/audio/${audioId}/transcription`, {
        transcription,
        status
      });
      return this.transformRecording(response.data.recording);
    } catch (error) {
      console.error(`Error updating transcription for ${audioId}:`, error);
      throw error;
    }
  }

  /**
   * Update audio recording metadata
   */
  async updateMetadata(audioId: string, metadata: any): Promise<AudioRecording> {
    try {
      const response = await api.put(`/audio/${audioId}/metadata`, {
        metadata
      });
      return this.transformRecording(response.data.recording);
    } catch (error) {
      console.error(`Error updating metadata for ${audioId}:`, error);
      throw error;
    }
  }

  /**
   * Delete an audio recording
   */
  async deleteRecording(audioId: string): Promise<boolean> {
    try {
      const response = await api.delete(`/audio/${audioId}`);
      return response.data.success === true;
    } catch (error) {
      console.error(`Error deleting audio recording ${audioId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all audio recordings for a topic
   */
  async deleteByTopic(topicId: string): Promise<number> {
    try {
      const response = await api.delete(`/audio/topic/${topicId}`);
      return response.data.count || 0;
    } catch (error) {
      console.error(`Error deleting audio for topic ${topicId}:`, error);
      throw error;
    }
  }

  /**
   * Transform backend audio recording to frontend format
   */
  private transformRecording(backendRecording: any): AudioRecording {
    if (!backendRecording) return null as any;

    // The backend uses snake_case, frontend uses camelCase
    return {
      id: backendRecording.id,
      userId: backendRecording.user_id,
      timelineEventId: backendRecording.timeline_event_id,
      topicId: backendRecording.topic_id,
      fileName: backendRecording.file_name,
      fileSize: backendRecording.file_size,
      duration: backendRecording.duration,
      mimeType: backendRecording.mime_type,
      audioData: backendRecording.audio_data, // Base64 string if present
      storagePath: backendRecording.storage_path,
      transcription: backendRecording.transcription,
      transcriptionStatus: backendRecording.transcription_status,
      metadata: backendRecording.metadata || {},
      createdAt: new Date(backendRecording.created_at).getTime(),
      updatedAt: new Date(backendRecording.updated_at).getTime()
    };
  }

  /**
   * Transform an array of backend recordings
   */
  private transformRecordings(backendRecordings: any[]): AudioRecording[] {
    return backendRecordings.map(recording => this.transformRecording(recording));
  }
}

// Export singleton instance
export const audioAPIService = new AudioAPIService();