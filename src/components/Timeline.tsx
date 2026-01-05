import { useState, useEffect } from 'react';
import { getAllTopics } from '@/utils/db/topics';
import { getTimelineForTopic, deleteTimelineEvent } from '@/utils/db/timeline';
import type { Topic, TimelineEvent } from '@/types';

export default function Timeline() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | TimelineEvent['type']>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTopics();
  }, []);

  useEffect(() => {
    if (selectedTopicId) {
      loadTimeline();
    }
  }, [selectedTopicId]);

  const loadTopics = async () => {
    try {
      const allTopics = await getAllTopics();
      setTopics(allTopics);
      if (allTopics.length > 0 && !selectedTopicId) {
        setSelectedTopicId(allTopics[0].id);
      }
    } catch (error) {
      console.error('Error loading topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = async () => {
    if (!selectedTopicId) return;

    try {
      setLoading(true);
      const timelineEvents = await getTimelineForTopic(selectedTopicId);
      setEvents(timelineEvents);
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteTimelineEvent(eventId);
        await loadTimeline();
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    }
  };

  const getFilteredEvents = () => {
    let filtered = events;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(e => e.type === filterType);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        JSON.stringify(e.data).toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'doctor_visit':
        return '👨‍⚕️';
      case 'test_result':
        return '🧪';
      case 'medication_change':
        return '💊';
      case 'symptom':
        return '🌡️';
      case 'voice_note':
        return '🎤';
      case 'research_finding':
        return '🔬';
      case 'milestone':
        return '⭐';
      default:
        return '📝';
    }
  };

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'doctor_visit':
        return 'bg-blue-100 border-blue-300';
      case 'test_result':
        return 'bg-purple-100 border-purple-300';
      case 'medication_change':
        return 'bg-green-100 border-green-300';
      case 'symptom':
        return 'bg-yellow-100 border-yellow-300';
      case 'voice_note':
        return 'bg-indigo-100 border-indigo-300';
      case 'research_finding':
        return 'bg-pink-100 border-pink-300';
      case 'milestone':
        return 'bg-orange-100 border-orange-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const filteredEvents = getFilteredEvents();

  if (topics.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No topics created yet. Add a topic to start tracking events.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Patient Timeline</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Topic Selector */}
          <div>
            <label htmlFor="timeline-topic" className="block text-sm font-medium text-gray-700 mb-1">
              Select Topic
            </label>
            <select
              id="timeline-topic"
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

          {/* Type Filter */}
          <div>
            <label htmlFor="timeline-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Type
            </label>
            <select
              id="timeline-filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            >
              <option value="all">All Events</option>
              <option value="doctor_visit">Doctor Visits</option>
              <option value="test_result">Test Results</option>
              <option value="medication_change">Medication Changes</option>
              <option value="symptom">Symptoms</option>
              <option value="voice_note">Voice Notes</option>
              <option value="research_finding">Research Findings</option>
              <option value="milestone">Milestones</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label htmlFor="timeline-search" className="block text-sm font-medium text-gray-700 mb-1">
              Search Events
            </label>
            <input
              id="timeline-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search timeline..."
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>
        </div>

        {/* Event Count */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Showing {filteredEvents.length} of {events.length} events
          </p>
          <button
            onClick={() => loadTimeline()}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">
            {filterType === 'all' && !searchQuery
              ? 'No events recorded yet.'
              : 'No events match your filters.'}
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>

          {/* Events */}
          <div className="space-y-6">
            {filteredEvents.map((event, index) => (
              <div key={event.id} className="relative flex items-start">
                {/* Timeline dot */}
                <div className="absolute left-8 w-4 h-4 -ml-2 bg-white border-2 border-gray-400 rounded-full z-10"></div>

                {/* Event card */}
                <div className={`ml-16 flex-1 p-4 rounded-lg border-2 ${getEventColor(event.type)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{getEventIcon(event.type)}</span>
                        <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                      </div>

                      {event.description && (
                        <p className="text-gray-700 mb-2">{event.description}</p>
                      )}

                      {/* Event-specific data display */}
                      {event.type === 'voice_note' && event.data?.summary && (
                        <div className="bg-white bg-opacity-50 rounded p-3 mb-2">
                          <p className="text-sm font-medium text-gray-700 mb-1">Summary:</p>
                          <p className="text-sm text-gray-600">{event.data.summary}</p>
                          {event.data.duration && (
                            <p className="text-xs text-gray-500 mt-1">
                              Duration: {Math.floor(event.data.duration / 60)}:{(event.data.duration % 60).toString().padStart(2, '0')}
                            </p>
                          )}
                        </div>
                      )}

                      {event.type === 'test_result' && event.data && (
                        <div className="bg-white bg-opacity-50 rounded p-3 mb-2">
                          <p className="text-sm text-gray-600">{JSON.stringify(event.data, null, 2)}</p>
                        </div>
                      )}

                      {event.type === 'medication_change' && event.data && (
                        <div className="bg-white bg-opacity-50 rounded p-3 mb-2">
                          {event.data.medication && (
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Medication:</span> {event.data.medication}
                            </p>
                          )}
                          {event.data.dosage && (
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Dosage:</span> {event.data.dosage}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Tags */}
                      {event.tags && event.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {event.tags.map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-1 text-xs bg-white bg-opacity-70 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <p className="text-sm text-gray-600">
                          {formatDate(event.timestamp)}
                        </p>

                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Event Button */}
      <div className="fixed bottom-6 right-6">
        <button
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-lg"
          title="Add Event"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}