/**
 * Audio Compression Service
 *
 * Optimizes audio recording for medical consultations by:
 * - Reducing file size by 60-70% for 30-minute recordings
 * - Maintaining speech clarity for accurate transcription
 * - Supporting different recording types (consultation vs quick note)
 */

export interface AudioCompressionConfig {
  mimeType: string;
  audioBitsPerSecond?: number;
  numberOfAudioChannels?: number;
  sampleRate?: number;
}

export type RecordingType = 'consultation' | 'note' | 'custom';

export interface RecordingPreset {
  name: string;
  description: string;
  maxDuration: number; // in minutes
  targetFileSize: number; // in MB
  config: AudioCompressionConfig;
}

class AudioCompressionService {
  // Presets optimized for different use cases
  private presets: Record<RecordingType, RecordingPreset> = {
    consultation: {
      name: 'Medical Consultation',
      description: 'Optimized for 20-30 minute doctor visits',
      maxDuration: 30,
      targetFileSize: 15, // Target 15MB for 30-min recording
      config: {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 32000, // 32 kbps for speech
        numberOfAudioChannels: 1, // Mono for speech
        sampleRate: 16000, // 16 kHz is sufficient for speech
      }
    },
    note: {
      name: 'Quick Note',
      description: 'Higher quality for short recordings',
      maxDuration: 5,
      targetFileSize: 5,
      config: {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 64000, // 64 kbps for better quality
        numberOfAudioChannels: 1, // Still mono
        sampleRate: 24000, // Higher sample rate for clarity
      }
    },
    custom: {
      name: 'Custom Settings',
      description: 'User-defined quality settings',
      maxDuration: 60,
      targetFileSize: 20,
      config: {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 48000,
        numberOfAudioChannels: 1,
        sampleRate: 16000,
      }
    }
  };

  /**
   * Get optimal recording settings based on recording type
   */
  getOptimalSettings(recordingType: RecordingType = 'consultation'): AudioCompressionConfig {
    const preset = this.presets[recordingType];
    return { ...preset.config };
  }

  /**
   * Get recording preset information
   */
  getPreset(recordingType: RecordingType): RecordingPreset {
    return { ...this.presets[recordingType] };
  }

  /**
   * Get all available presets
   */
  getAllPresets(): RecordingPreset[] {
    return Object.values(this.presets);
  }

  /**
   * Check if browser supports required audio codecs
   */
  checkCodecSupport(): { opus: boolean; webm: boolean; mp4: boolean } {
    const support = {
      opus: false,
      webm: false,
      mp4: false
    };

    if (typeof MediaRecorder === 'undefined') {
      return support;
    }

    // Check for WebM with Opus codec
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      support.opus = true;
      support.webm = true;
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      support.webm = true;
    }

    // Check for MP4 support (fallback)
    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      support.mp4 = true;
    }

    return support;
  }

  /**
   * Get the best available mime type for the browser
   */
  getBestAvailableMimeType(): string {
    const support = this.checkCodecSupport();

    if (support.opus) {
      return 'audio/webm;codecs=opus';
    } else if (support.webm) {
      return 'audio/webm';
    } else if (support.mp4) {
      return 'audio/mp4';
    }

    // Default fallback
    return 'audio/webm';
  }

  /**
   * Estimate file size based on recording duration and settings
   */
  estimateFileSize(durationSeconds: number, recordingType: RecordingType = 'consultation'): number {
    const preset = this.presets[recordingType];
    const bitrate = preset.config.audioBitsPerSecond || 32000;

    // Calculate size in bytes: (bitrate in bits/sec * duration in sec) / 8 bits per byte
    const sizeInBytes = (bitrate * durationSeconds) / 8;

    // Add ~10% overhead for container and metadata
    const withOverhead = sizeInBytes * 1.1;

    // Convert to MB
    return withOverhead / (1024 * 1024);
  }

  /**
   * Calculate optimal bitrate for target file size
   */
  calculateOptimalBitrate(
    targetSizeMB: number,
    durationMinutes: number
  ): number {
    // Convert to seconds and bytes
    const durationSeconds = durationMinutes * 60;
    const targetSizeBytes = targetSizeMB * 1024 * 1024;

    // Account for 10% container overhead
    const availableBytes = targetSizeBytes * 0.9;

    // Calculate bitrate: (bytes * 8 bits/byte) / seconds
    const bitrate = (availableBytes * 8) / durationSeconds;

    // Round to nearest 1000 and clamp between 16k and 128k
    const rounded = Math.round(bitrate / 1000) * 1000;
    return Math.max(16000, Math.min(128000, rounded));
  }

  /**
   * Create a custom preset with specific constraints
   */
  createCustomPreset(
    maxDurationMinutes: number,
    targetSizeMB: number
  ): AudioCompressionConfig {
    const bitrate = this.calculateOptimalBitrate(targetSizeMB, maxDurationMinutes);

    // Determine sample rate based on bitrate
    let sampleRate = 16000; // Default for speech
    if (bitrate >= 64000) {
      sampleRate = 24000;
    } else if (bitrate >= 96000) {
      sampleRate = 48000;
    }

    return {
      mimeType: this.getBestAvailableMimeType(),
      audioBitsPerSecond: bitrate,
      numberOfAudioChannels: 1, // Always mono for speech
      sampleRate
    };
  }

  /**
   * Compress an existing audio blob using Web Audio API
   * Note: This is a placeholder for future enhancement using Web Audio API
   * for more advanced compression/processing
   */
  async compressAudioBlob(
    blob: Blob,
    targetSettings: AudioCompressionConfig
  ): Promise<Blob> {
    // For now, return the original blob
    // In the future, we could use Web Audio API to:
    // 1. Decode the audio
    // 2. Downsample if needed
    // 3. Apply compression/filtering
    // 4. Re-encode with new settings

    console.warn('Advanced audio compression not yet implemented. Using original recording settings.');
    return blob;
  }

  /**
   * Get recommended settings based on expected recording duration
   */
  getRecommendedSettings(expectedDurationMinutes: number): {
    recordingType: RecordingType;
    preset: RecordingPreset;
    estimatedSize: number;
  } {
    // Choose preset based on duration
    let recordingType: RecordingType;
    if (expectedDurationMinutes <= 5) {
      recordingType = 'note';
    } else if (expectedDurationMinutes <= 30) {
      recordingType = 'consultation';
    } else {
      // For very long recordings, use custom with lower bitrate
      recordingType = 'custom';
      // Update custom preset for long recordings
      this.presets.custom.config = this.createCustomPreset(
        expectedDurationMinutes,
        20 // Target 20MB max
      );
    }

    const preset = this.getPreset(recordingType);
    const estimatedSize = this.estimateFileSize(expectedDurationMinutes * 60, recordingType);

    return {
      recordingType,
      preset,
      estimatedSize
    };
  }

  /**
   * Format file size for display
   */
  formatFileSize(sizeInMB: number): string {
    if (sizeInMB < 1) {
      return `${(sizeInMB * 1024).toFixed(0)} KB`;
    }
    return `${sizeInMB.toFixed(1)} MB`;
  }

  /**
   * Get quality indicator based on bitrate
   */
  getQualityIndicator(bitrate: number): {
    level: 'low' | 'medium' | 'high';
    label: string;
    color: string;
  } {
    if (bitrate <= 32000) {
      return {
        level: 'low',
        label: 'Standard (optimized for size)',
        color: 'text-yellow-600'
      };
    } else if (bitrate <= 64000) {
      return {
        level: 'medium',
        label: 'Good (balanced)',
        color: 'text-blue-600'
      };
    } else {
      return {
        level: 'high',
        label: 'High (best quality)',
        color: 'text-green-600'
      };
    }
  }
}

// Export singleton instance
export const audioCompressionService = new AudioCompressionService();

// Export types for use in components
export type { AudioCompressionConfig, RecordingPreset };