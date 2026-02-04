import { useState, useEffect } from 'react';
import { getDB } from '@/utils/db/database';
import { topicsService } from '@/services/topics.service';
import type { ResearchFinding, Topic } from '@/types';

interface FindingsViewerProps {
  topicId?: string;
}

export default function FindingsViewer({ topicId }: FindingsViewerProps) {
  const [findings, setFindings] = useState<ResearchFinding[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(topicId || '');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'high-relevance'>('all');

  useEffect(() => {
    loadTopics();
  }, []);

  useEffect(() => {
    if (selectedTopicId) {
      loadFindings(selectedTopicId);
    }
  }, [selectedTopicId]);

  const loadTopics = async () => {
    try {
      const db = await getDB();
      const allTopics = await db.getAll('topics');
      setTopics(allTopics);
      if (!selectedTopicId && allTopics.length > 0) {
        setSelectedTopicId(allTopics[0].id);
      }
    } catch (error) {
      console.error('Error loading topics:', error);
    }
  };

  const loadFindings = async (topicId: string) => {
    try {
      setLoading(true);
      const db = await getDB();
      const topicFindings = await db.getAllFromIndex('findings', 'by-topic', topicId);

      // Sort by timestamp, newest first
      topicFindings.sort((a, b) => b.timestamp - a.timestamp);

      setFindings(topicFindings);
    } catch (error) {
      console.error('Error loading findings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredFindings = () => {
    switch (filter) {
      case 'new':
        return findings.filter(f => f.isNew);
      case 'high-relevance':
        // Filter by priority instead of deprecated relevanceScore
        return findings.filter(f => f.priority === 'critical' || f.priority === 'high');
      default:
        return findings;
    }
  };

  const markAsRead = async (findingId: string) => {
    try {
      const db = await getDB();
      const finding = await db.get('findings', findingId);
      if (finding) {
        finding.isNew = false;
        finding.userEngagement = {
          ...finding.userEngagement,
          viewed: true
        };
        await db.put('findings', finding);
        loadFindings(selectedTopicId);
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: ResearchFinding['type']) => {
    switch (type) {
      case 'treatment':
        return '💊';
      case 'trial':
        return '🔬';
      case 'study':
        return '📚';
      case 'guideline':
        return '📋';
      case 'news':
        return '📰';
      default:
        return '📄';
    }
  };

  const filteredFindings = getFilteredFindings();

  if (topics.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No topics created yet. Add a topic to start seeing research findings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Topic Selector and Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="topic-select" className="block text-sm font-medium text-gray-700 mb-1">
              Select Topic
            </label>
            <select
              id="topic-select"
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  filter === 'all'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All ({findings.length})
              </button>
              <button
                onClick={() => setFilter('new')}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  filter === 'new'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                New ({findings.filter(f => f.isNew).length})
              </button>
              <button
                onClick={() => setFilter('high-relevance')}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  filter === 'high-relevance'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                High Priority ({findings.filter(f => f.priority === 'critical' || f.priority === 'high').length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Findings List */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-gray-500">
            {filter === 'all'
              ? 'No findings yet. Run agents to discover research.'
              : `No ${filter === 'new' ? 'new' : 'high relevance'} findings.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFindings.map(finding => (
            <div
              key={finding.id}
              className={`bg-white shadow rounded-lg overflow-hidden ${
                finding.isNew ? 'ring-2 ring-indigo-500' : ''
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getTypeIcon(finding.type)}</span>
                      <h3 className="text-lg font-medium text-gray-900">{finding.title}</h3>
                      {finding.isNew && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          New
                        </span>
                      )}
                    </div>

                    <p className="text-gray-600 mb-4">{finding.summary}</p>

                    {finding.extractedEntities && (
                      <div className="mb-4 space-y-2">
                        {finding.extractedEntities.medications && (
                          <div className="flex flex-wrap gap-2">
                            <span className="text-sm text-gray-500">Medications:</span>
                            {finding.extractedEntities.medications.map((med, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {med}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {finding.priority && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          finding.priority === 'critical' ? 'bg-red-100 text-red-800' :
                          finding.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          finding.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {finding.priority} priority
                        </span>
                      )}
                      <span>{finding.source.displayName || finding.source.name}</span>
                      <span>{new Date(finding.timestamp).toLocaleDateString()}</span>
                    </div>

                    {finding.source.url && (
                      <div className="mt-4">
                        <a
                          href={finding.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
                        >
                          View Source →
                        </a>
                      </div>
                    )}
                  </div>

                  {finding.isNew && (
                    <button
                      onClick={() => markAsRead(finding.id)}
                      className="ml-4 text-sm text-gray-500 hover:text-gray-700"
                    >
                      Mark as read
                    </button>
                  )}
                </div>

                {finding.isContradictory && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      ⚠️ This finding may contradict previous research. Review carefully.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}