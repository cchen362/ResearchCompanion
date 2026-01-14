import { getDB } from './database';
import type { Topic, DiseaseProfile, PatientContext } from '@/types';

// Generate a unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Create a new topic
export async function createTopic(
  name: string,
  diseaseProfile: DiseaseProfile,
  patientContext?: PatientContext
): Promise<Topic> {
  const db = await getDB();

  const topic: Topic = {
    id: generateId(),
    name,
    diseaseProfile,
    patientContext,
    agents: [],
    researchHistory: [],
    insights: [],
    connections: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    familyAccess: []
  };

  await db.add('topics', topic);

  // Dispatch event to notify UI components
  window.dispatchEvent(new CustomEvent('topic-created', { detail: { topic } }));

  return topic;
}

// Get a topic by ID
export async function getTopic(id: string): Promise<Topic | undefined> {
  const db = await getDB();
  return db.get('topics', id);
}

// Get all topics
export async function getAllTopics(): Promise<Topic[]> {
  const db = await getDB();
  return db.getAllFromIndex('topics', 'by-date');
}

// Update a topic
export async function updateTopic(topic: Topic): Promise<void> {
  const db = await getDB();
  topic.updatedAt = Date.now();
  await db.put('topics', topic);
}

// Delete a topic
export async function deleteTopic(id: string): Promise<void> {
  const db = await getDB();

  // Also delete associated agents and findings
  const agents = await db.getAllFromIndex('agents', 'by-topic', id);
  const findings = await db.getAllFromIndex('findings', 'by-topic', id);

  const tx = db.transaction(['topics', 'agents', 'findings'], 'readwrite');

  await tx.objectStore('topics').delete(id);

  for (const agent of agents) {
    await tx.objectStore('agents').delete(agent.id);
  }

  for (const finding of findings) {
    await tx.objectStore('findings').delete(finding.id);
  }

  await tx.done;
}

// Search topics by name
export async function searchTopicsByName(query: string): Promise<Topic[]> {
  const db = await getDB();
  const allTopics = await db.getAll('topics');

  const lowerQuery = query.toLowerCase();
  return allTopics.filter(topic =>
    topic.name.toLowerCase().includes(lowerQuery) ||
    topic.diseaseProfile.name.toLowerCase().includes(lowerQuery)
  );
}

// Get topics by disease category
export async function getTopicsByCategory(category: string): Promise<Topic[]> {
  const db = await getDB();
  const allTopics = await db.getAll('topics');

  return allTopics.filter(topic =>
    topic.diseaseProfile.category.includes(category)
  );
}

// Get topics that need agent updates
export async function getTopicsNeedingUpdate(
  hoursThreshold: number = 24
): Promise<Topic[]> {
  const db = await getDB();
  const allTopics = await db.getAll('topics');
  const threshold = Date.now() - (hoursThreshold * 60 * 60 * 1000);

  return allTopics.filter(topic => {
    if (!topic.lastAgentRun) return true;
    return topic.lastAgentRun < threshold;
  });
}

// Add research finding to topic
export async function addResearchToTopic(
  topicId: string,
  findingId: string
): Promise<void> {
  const db = await getDB();
  const topic = await db.get('topics', topicId);

  if (topic) {
    const finding = await db.get('findings', findingId);
    if (finding) {
      topic.researchHistory.push(finding);
      topic.updatedAt = Date.now();
      topic.lastAgentRun = Date.now();
      await db.put('topics', topic);
    }
  }
}

// Get topics with family access for a specific member
export async function getTopicsForFamilyMember(memberId: string): Promise<Topic[]> {
  const db = await getDB();
  const allTopics = await db.getAll('topics');

  return allTopics.filter(topic =>
    topic.familyAccess?.some(access => access.memberId === memberId)
  );
}

// Check if topic should be updated based on disease progression
export function shouldUpdateTopic(topic: Topic): boolean {
  const lastRun = topic.lastAgentRun || 0;
  const hoursSinceLastRun = (Date.now() - lastRun) / (1000 * 60 * 60);

  // Adaptive scheduling based on disease progression rate
  switch (topic.diseaseProfile.progressionRate) {
    case 'rapid':
      return hoursSinceLastRun >= 12; // Check twice daily
    case 'moderate':
      return hoursSinceLastRun >= 24; // Check daily
    case 'slow':
      return hoursSinceLastRun >= 168; // Check weekly
    case 'variable':
    default:
      return hoursSinceLastRun >= 24; // Default to daily
  }
}