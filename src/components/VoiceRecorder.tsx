import { useState, useRef, useEffect } from 'react';
import { transcribeAudio } from '@/services/api';
import { createTimelineEvent, getTimelineForTopic } from '@/utils/db/timeline';
import { topicsService } from '@/services/topics.service';
import { TranscriptionSummary } from './TranscriptionSummary';
import { ChevronDown, ChevronRight, Mic, MicOff, Clock, Calendar, FileText, Eye, Settings, Info } from 'lucide-react';
import { audioCompressionService, type RecordingType, type RecordingPreset } from '@/services/audioCompression.service';
import type { Topic, VoiceTranscriptionResult, TimelineEvent } from '@/types';

interface VoiceRecorderProps {
  topicId?: string;
  topics: Topic[];
  onComplete?: () => void;
}

export default function VoiceRecorder({ topicId, topics: propsTopics, onComplete }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState<VoiceTranscriptionResult['summary'] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState(topicId || '');
  const [error, setError] = useState('');
  const [previousRecordings, setPreviousRecordings] = useState<TimelineEvent[]>([]);
  const [showPrevious, setShowPrevious] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const [expandedRecordings, setExpandedRecordings] = useState<Set<string>>(new Set());
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);

  // Audio compression settings
  const [recordingType, setRecordingType] = useState<RecordingType>('consultation');
  const [showSettings, setShowSettings] = useState(false);
  const [estimatedFileSize, setEstimatedFileSize] = useState(0);
  const [actualFileSize, setActualFileSize] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load topics from database on mount
  useEffect(() => {
    const loadTopics = async () => {
      setIsLoadingTopics(true);
      try {
        const allTopics = await topicsService.getTopics();
        setTopics(allTopics);

        // Set selected topic if not already set
        if (!selectedTopicId && allTopics.length > 0) {
          setSelectedTopicId(allTopics[0].id);
        }
      } catch (err) {
        console.error('Error loading topics:', err);
        setError('Failed to load topics');
      } finally {
        setIsLoadingTopics(false);
      }
    };

    loadTopics();
  }, []); // Only run on mount

  // Update selected topic when topics change
  useEffect(() => {
    if (!selectedTopicId && topics.length > 0) {
      setSelectedTopicId(topics[0].id);
    }
  }, [topics, selectedTopicId]);

  // Load previous recordings for the selected topic
  useEffect(() => {
    const loadPreviousRecordings = async () => {
      if (selectedTopicId) {
        try {
          const events = await getTimelineForTopic(selectedTopicId);
          const voiceNotes = events.filter(e => e.type === 'voice_note');
          setPreviousRecordings(voiceNotes.sort((a, b) => b.timestamp - a.timestamp));
        } catch (err) {
          console.error('Error loading previous recordings:', err);
        }
      }
    };

    loadPreviousRecordings();
  }, [selectedTopicId]);

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Update estimated file size every second
          const estimatedSize = audioCompressionService.estimateFileSize(newTime, recordingType);
          setEstimatedFileSize(estimatedSize);
          return newTime;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isPaused, recordingType]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      setError('');

      // Get optimized compression settings
      const compressionSettings = audioCompressionService.getOptimalSettings(recordingType);

      // Check codec support
      const codecSupport = audioCompressionService.checkCodecSupport();
      if (!codecSupport.webm && !codecSupport.mp4) {
        setError('Your browser does not support required audio recording formats.');
        return;
      }

      // Get microphone with optimized constraints
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: compressionSettings.sampleRate
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });
      streamRef.current = stream;

      // Create MediaRecorder with compression settings
      const recorderOptions: MediaRecorderOptions = {
        mimeType: compressionSettings.mimeType
      };

      // Add bitrate if supported (Chrome, Edge)
      if (compressionSettings.audioBitsPerSecond) {
        recorderOptions.audioBitsPerSecond = compressionSettings.audioBitsPerSecond;
      }

      console.log('Starting recording with settings:', recorderOptions);

      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: compressionSettings.mimeType });
        setAudioBlob(blob);

        // Calculate actual file size
        const actualSizeMB = blob.size / (1024 * 1024);
        setActualFileSize(actualSizeMB);
        console.log(`Recording complete. Size: ${actualSizeMB.toFixed(2)}MB (estimated: ${estimatedFileSize.toFixed(2)}MB)`);
      };

      mediaRecorder.start(200); // Capture in 200ms chunks
      setIsRecording(true);
      setRecordingTime(0);
      setEstimatedFileSize(0);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      // Stop all tracks to release the microphone
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const processRecording = async () => {
    if (!audioBlob || !selectedTopicId) return;

    setIsProcessing(true);
    setError('');

    try {
      // Prepare title for recording
      const title = `Doctor Visit - ${new Date().toLocaleDateString()}`;

      // Send audio to backend for transcription, summarization, and server storage
      const result = await transcribeAudio(audioBlob, {
        topicId: selectedTopicId,
        title,
        duration: recordingTime,
        metadata: {
          recordingType,
          estimatedFileSize,
          actualFileSize,
          processedAt: Date.now()
        }
      });

      setTranscript(result.transcript);
      setSummary(result.summary);

      // If server didn't save (no timelineEventId), create locally
      if (!result.timelineEventId) {
        // Save to timeline locally
        const event = await createTimelineEvent(
          selectedTopicId,
          'voice_note',
          title,
          {
            transcript: result.transcript,
            summary: result.summary,
            duration: recordingTime,
            recordedAt: Date.now()
          },
          {
            recordingType,
            processedAt: Date.now()
          }
        );
      }

      // Mark as saved successfully
      setSavedSuccessfully(true);

      // Reload previous recordings
      const events = await getTimelineForTopic(selectedTopicId);
      const voiceNotes = events.filter(e => e.type === 'voice_note');
      setPreviousRecordings(voiceNotes.sort((a, b) => b.timestamp - a.timestamp));

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error('Error processing recording:', err);
      setError('Failed to process recording. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setTranscript('');
    setSummary(null);
    setRecordingTime(0);
    setError('');
    setSavedSuccessfully(false);
  };

  const toggleRecordingExpansion = (recordingId: string) => {
    const newExpanded = new Set(expandedRecordings);
    if (newExpanded.has(recordingId)) {
      newExpanded.delete(recordingId);
    } else {
      newExpanded.add(recordingId);
    }
    setExpandedRecordings(newExpanded);
  };

  if (isLoadingTopics) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="text-gray-600">Loading topics...</span>
        </div>
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please create a topic first to record voice notes.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Voice Recording</h2>

      {/* Topic Selector and Recording Settings */}
      {!isRecording && !audioBlob && (
        <div className="space-y-6 mb-6">
          {/* Topic Selection */}
          <div>
            <label htmlFor="recording-topic" className="block text-sm font-medium text-gray-700 mb-2">
              Select Topic for Recording
            </label>
            <select
              id="recording-topic"
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            >
              {topics.map(topic => (
                <option key={topic.id} value={topic.id}>
                  {topic.name} - {topic.diseaseProfile.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recording Type Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Recording Type
              </label>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
              >
                <Settings className="w-4 h-4" />
                Advanced Settings
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['consultation', 'note'] as RecordingType[]).map((type) => {
                const preset = audioCompressionService.getPreset(type);
                const quality = audioCompressionService.getQualityIndicator(
                  preset.config.audioBitsPerSecond || 32000
                );
                const isSelected = recordingType === type;

                return (
                  <button
                    key={type}
                    onClick={() => setRecordingType(type)}
                    className={`relative p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2">
                        <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                    <div className="text-left">
                      <div className="font-medium text-gray-900">{preset.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-600">
                          Max {preset.maxDuration} min
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className={`text-xs ${quality.color}`}>
                          {quality.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Target size: ~{preset.targetFileSize}MB
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {showSettings && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Advanced Settings</h4>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-gray-400" />
                    <span>Audio is compressed using Opus codec for optimal size</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-gray-400" />
                    <span>Mono recording at {recordingType === 'consultation' ? '16kHz' : '24kHz'} sample rate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-gray-400" />
                    <span>Bitrate: {audioCompressionService.getPreset(recordingType).config.audioBitsPerSecond?.toLocaleString()} bps</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-gray-400" />
                    <span>30-minute recording will be approximately {audioCompressionService.estimateFileSize(1800, recordingType).toFixed(1)}MB</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex flex-col items-center space-y-4">
        {!isRecording && !audioBlob && (
          <button
            onClick={startRecording}
            className="flex items-center justify-center w-32 h-32 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-all transform hover:scale-105"
          >
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </button>
        )}

        {isRecording && (
          <div className="flex flex-col items-center space-y-4">
            <div className="text-3xl font-mono text-gray-700">
              {formatTime(recordingTime)}
            </div>

            <div className="flex items-center space-x-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-sm text-gray-600">
                {isPaused ? 'Paused' : 'Recording...'}
              </span>
            </div>

            {/* File Size Indicator */}
            <div className="bg-gray-50 rounded-lg px-4 py-2">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">Estimated size:</span>
                  <span className="font-medium text-gray-900">
                    {audioCompressionService.formatFileSize(estimatedFileSize)}
                  </span>
                </div>
                {estimatedFileSize > 20 && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <Info className="w-4 h-4" />
                    <span className="text-xs">Approaching size limit</span>
                  </div>
                )}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Using {recordingType === 'consultation' ? 'consultation' : 'high quality'} compression
              </div>
            </div>

            <div className="flex space-x-4">
              {!isPaused ? (
                <button
                  onClick={pauseRecording}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md"
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={resumeRecording}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md"
                >
                  Resume
                </button>
              )}

              <button
                onClick={stopRecording}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md"
              >
                Stop
              </button>
            </div>
          </div>
        )}

        {audioBlob && !isProcessing && !transcript && (
          <div className="w-full space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">Recording complete!</p>
              <div className="space-y-2">
                <p className="text-lg font-semibold">Duration: {formatTime(recordingTime)}</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">
                    Actual size: <span className="font-medium text-gray-900">
                      {audioCompressionService.formatFileSize(actualFileSize)}
                    </span>
                  </span>
                  <span className="text-gray-500">
                    (Estimated was {audioCompressionService.formatFileSize(estimatedFileSize)})
                  </span>
                </div>
                {actualFileSize > 25 && (
                  <div className="bg-amber-50 text-amber-800 text-sm p-2 rounded-md flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    <span>File exceeds 25MB limit. Consider using consultation mode for long recordings.</span>
                  </div>
                )}
              </div>

              <audio controls className="w-full mt-4">
                <source src={URL.createObjectURL(audioBlob)} type="audio/webm" />
                Your browser does not support the audio element.
              </audio>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={processRecording}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
              >
                Process Recording
              </button>

              <button
                onClick={resetRecording}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="w-full text-center py-8">
            <div className="inline-flex items-center space-x-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="text-gray-600">Processing your recording...</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
          </div>
        )}

        {transcript && summary && (
          <div className="w-full space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold text-green-800">
                  Recording Processed {savedSuccessfully && 'and Saved to Timeline'}
                </span>
              </div>
              {savedSuccessfully && (
                <p className="text-sm text-green-700 mt-1">
                  Your recording has been saved and will appear in your timeline and previous recordings.
                </p>
              )}
            </div>

            <TranscriptionSummary
              summary={summary}
              transcript={transcript}
              duration={recordingTime}
              recordedAt={Date.now()}
              expandable={false}
            />

            <button
              onClick={resetRecording}
              className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
            >
              Record Another Visit
            </button>
          </div>
        )}

        {error && (
          <div className="w-full bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </div>

      {/* Previous Recordings Section */}
      {previousRecordings.length > 0 && !isRecording && !audioBlob && !transcript && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Previous Recordings</h3>
            <button
              onClick={() => setShowPrevious(!showPrevious)}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
            >
              {showPrevious ? (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  Show
                </>
              )}
              <span className="ml-1">({previousRecordings.length})</span>
            </button>
          </div>

          {showPrevious && (
            <div className="space-y-4">
              {previousRecordings.slice(0, 5).map((recording) => {
                const data = recording.data as any;
                const recordingDate = new Date(recording.timestamp);
                const isExpanded = expandedRecordings.has(recording.id);

                return (
                  <div key={recording.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <button
                          onClick={() => toggleRecordingExpansion(recording.id)}
                          className="flex-1 flex items-start gap-2 text-left hover:bg-gray-50 -ml-2 -mt-2 -mb-2 p-2 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-500 mt-0.5" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-500 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{recording.title}</h4>
                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {recordingDate.toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {recordingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {data.duration && (
                                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                                  {Math.floor(data.duration / 60)}:{(data.duration % 60).toString().padStart(2, '0')}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>

                        {data.summary?.sentiment && (
                          <span className={`text-xs px-2 py-1 rounded-full self-start ${
                            data.summary.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                            data.summary.sentiment === 'concerned' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {data.summary.sentiment === 'positive' ? '✓ Positive' :
                             data.summary.sentiment === 'concerned' ? '⚠ Attention' :
                             '• Stable'}
                          </span>
                        )}
                      </div>

                      {!isExpanded && data.summary && (
                        <div className="mt-3 pl-7">
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {data.summary.visitSummary}
                          </p>
                          {data.summary.nextSteps && data.summary.nextSteps.length > 0 && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                              <FileText className="w-3.5 h-3.5" />
                              <span>{data.summary.nextSteps.length} action items</span>
                              {data.summary.importantMentions && data.summary.importantMentions.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{data.summary.importantMentions.length} key points</span>
                                </>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => toggleRecordingExpansion(recording.id)}
                            className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Full Summary
                          </button>
                        </div>
                      )}
                    </div>

                    {isExpanded && data.summary && (
                      <div className="border-t border-gray-200 p-4 bg-gray-50">
                        <TranscriptionSummary
                          summary={data.summary}
                          transcript={data.transcript}
                          duration={data.duration}
                          recordedAt={data.recordedAt || recording.timestamp}
                          expandable={true}
                          className="bg-transparent"
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {previousRecordings.length > 5 && (
                <p className="text-sm text-gray-500 text-center">
                  Showing 5 of {previousRecordings.length} recordings. View timeline for complete history.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}