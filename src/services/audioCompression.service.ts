/**
 * Audio Compression Service - DEPRECATED STUB
 *
 * This service was deprecated in Phase 1 Service Layer Consolidation.
 * Audio compression is not needed for the core application.
 * This stub exists only to prevent build errors.
 *
 * TODO: Remove in Phase 3 (Component Decomposition) along with VoiceRecorder.tsx
 */

export type RecordingType = 'voice_note' | 'doctor_visit' | 'symptom_log' | 'medication_reminder';

export interface RecordingPreset {
  quality: 'low' | 'medium' | 'high';
  format: string;
  sampleRate: number;
  bitRate: number;
}

class AudioCompressionService {
  private presets: Record<RecordingType, RecordingPreset> = {
    voice_note: { quality: 'medium', format: 'webm', sampleRate: 22050, bitRate: 48000 },
    doctor_visit: { quality: 'high', format: 'webm', sampleRate: 44100, bitRate: 128000 },
    symptom_log: { quality: 'medium', format: 'webm', sampleRate: 22050, bitRate: 48000 },
    medication_reminder: { quality: 'low', format: 'webm', sampleRate: 16000, bitRate: 32000 }
  };

  getPreset(type: RecordingType): RecordingPreset {
    console.warn('[AudioCompressionService] This service is deprecated.');
    return this.presets[type] || this.presets.voice_note;
  }

  async compressAudio(blob: Blob, _preset: RecordingPreset): Promise<Blob> {
    console.warn('[AudioCompressionService] This service is deprecated. Returning original blob.');
    return blob;
  }
}

export const audioCompressionService = new AudioCompressionService();
