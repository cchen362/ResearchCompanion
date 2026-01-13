import { useState, useRef, useEffect } from 'react';
import { transcribeAudio } from '@/services/api';
import { createTimelineEvent, getTimelineForTopic } from '@/utils/db/timeline';
import type { Topic, VoiceTranscriptionResult, TimelineEvent } from '@/types';

interface VoiceRecorderProps {
  topicId?: string;
  topics: Topic[];
  onComplete?: () => void;
}

export default function VoiceRecorder({ topicId, topics, onComplete }: VoiceRecorderProps) {
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
        setRecordingTime(prev => prev + 1);
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
  }, [isRecording, isPaused]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
      };

      mediaRecorder.start(200); // Capture in 200ms chunks
      setIsRecording(true);
      setRecordingTime(0);
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
      // Send audio to backend for transcription and summarization
      const result = await transcribeAudio(audioBlob);

      setTranscript(result.transcript);
      setSummary(result.summary);

      // Save to timeline
      const event = await createTimelineEvent(
        selectedTopicId,
        'voice_note',
        `Doctor Visit - ${new Date().toLocaleDateString()}`,
        {
          transcript: result.transcript,
          summary: result.summary,
          duration: recordingTime,
          recordedAt: Date.now()
        },
        {
          // Optional metadata
          processedAt: Date.now()
        }
      );

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

      {/* Topic Selector */}
      {!isRecording && !audioBlob && (
        <div className="mb-6">
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
              <p className="text-lg font-semibold">Duration: {formatTime(recordingTime)}</p>

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

            {/* Visit Summary Section */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center space-x-2 mb-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="font-semibold text-gray-900">Visit Summary</h3>
                {summary.sentiment && (
                  <span className={`ml-auto text-xs px-2 py-1 rounded-full ${
                    summary.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                    summary.sentiment === 'concerned' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {summary.sentiment === 'positive' ? '✓ Positive' :
                     summary.sentiment === 'concerned' ? '⚠ Needs Attention' :
                     '• Neutral'}
                  </span>
                )}
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{summary.visitSummary}</p>
            </div>

            {/* Next Steps Section */}
            {summary.nextSteps && summary.nextSteps.length > 0 && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center space-x-2 mb-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <h3 className="font-semibold text-gray-900">Action Items</h3>
                </div>
                <ul className="space-y-2">
                  {summary.nextSteps.map((step, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <span className="text-gray-700">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Important Mentions Section */}
            {summary.importantMentions && summary.importantMentions.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <div className="flex items-center space-x-2 mb-3">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="font-semibold text-gray-900">Important Points</h3>
                </div>
                <ul className="space-y-2">
                  {summary.importantMentions.map((mention, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-amber-600 mr-2">!</span>
                      <span className="text-gray-700">{mention}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Full Transcript Section */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 className="font-semibold text-gray-900">Full Transcript</h3>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap text-sm">{transcript}</p>
            </div>

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
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              {showPrevious ? 'Hide' : 'Show'} ({previousRecordings.length})
            </button>
          </div>

          {showPrevious && (
            <div className="space-y-4">
              {previousRecordings.slice(0, 5).map((recording) => {
                const data = recording.data as any;
                const recordingDate = new Date(recording.timestamp);

                return (
                  <div key={recording.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{recording.description}</h4>
                        <p className="text-sm text-gray-500">
                          {recordingDate.toLocaleDateString()} at {recordingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {data.duration && (
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                          {Math.floor(data.duration / 60)}:{(data.duration % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>

                    {data.summary && (
                      <div className="mt-3 space-y-2">
                        {data.summary.visitSummary && (
                          <div className="text-sm text-gray-700">
                            <span className="font-medium">Summary:</span> {data.summary.visitSummary.substring(0, 150)}
                            {data.summary.visitSummary.length > 150 && '...'}
                          </div>
                        )}

                        {data.summary.nextSteps && data.summary.nextSteps.length > 0 && (
                          <div className="text-sm">
                            <span className="font-medium text-gray-700">Action Items:</span>
                            <ul className="mt-1 list-disc list-inside text-gray-600">
                              {data.summary.nextSteps.slice(0, 2).map((step: string, i: number) => (
                                <li key={i}>{step}</li>
                              ))}
                              {data.summary.nextSteps.length > 2 && (
                                <li className="text-gray-400">+{data.summary.nextSteps.length - 2} more</li>
                              )}
                            </ul>
                          </div>
                        )}

                        {data.summary.sentiment && (
                          <div className="mt-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              data.summary.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                              data.summary.sentiment === 'concerned' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {data.summary.sentiment === 'positive' ? '✓ Positive Visit' :
                               data.summary.sentiment === 'concerned' ? '⚠ Needs Attention' :
                               '• Routine Visit'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <details className="mt-3">
                      <summary className="text-sm text-indigo-600 hover:text-indigo-700 cursor-pointer">
                        View Full Transcript
                      </summary>
                      <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200">
                        {data.transcript || 'No transcript available'}
                      </p>
                    </details>
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