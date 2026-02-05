import { query, queryOne } from '../db/database.js';

export interface Agent {
  id: string;
  user_id: string;
  topic_id?: string | null;
  name: string;
  type: string;
  enabled: boolean;
  config?: any;
  schedule?: string;
  last_run?: Date;
  next_run?: Date;
  created_at: Date;
  updated_at: Date;
  // Frontend-compatible fields (computed)
  status?: string;
  metrics?: any;
}

export interface CreateAgentData {
  topic_id?: string | null;
  name: string;
  type: string;
  enabled?: boolean;
  config?: any;
  schedule?: string;
}

export class AgentModel {
  // Get all agents for a user
  static async getAllByUserId(userId: string): Promise<Agent[]> {
    return query<Agent>(
      `SELECT * FROM agents
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
  }

  // Get agents for a specific topic
  static async getByTopicId(userId: string, topicId: string): Promise<Agent[]> {
    return query<Agent>(
      `SELECT * FROM agents
       WHERE user_id = $1 AND topic_id = $2
       ORDER BY created_at DESC`,
      [userId, topicId]
    );
  }

  // Get a single agent
  static async getById(id: string, userId: string): Promise<Agent | null> {
    return queryOne<Agent>(
      'SELECT * FROM agents WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
  }

  // Create a new agent
  static async create(userId: string, data: CreateAgentData): Promise<Agent> {
    const agent = await queryOne<Agent>(
      `INSERT INTO agents (user_id, topic_id, name, type, enabled, config, schedule)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        data.topic_id || null,
        data.name,
        data.type,
        data.enabled !== false,
        JSON.stringify(data.config || {}),
        data.schedule || 'manual'
      ]
    );

    if (!agent) {
      throw new Error('Failed to create agent');
    }

    return agent;
  }

  // Create default agents for a topic
  static async createDefaultsForTopic(userId: string, topicId: string): Promise<Agent[]> {
    const defaultAgents = [
      { name: 'Treatment Breakthrough Agent', type: 'treatment_breakthrough', schedule: 'daily' },
      { name: 'Clinical Trial Agent', type: 'clinical_trial', schedule: 'daily' },
      { name: 'Medical Literature Agent', type: 'medical_literature', schedule: 'daily' }
    ];

    const agents: Agent[] = [];
    const errors: string[] = [];

    for (const agentData of defaultAgents) {
      try {
        // Check if agent of this type already exists (idempotency)
        const existing = await queryOne<Agent>(
          'SELECT * FROM agents WHERE user_id = $1 AND topic_id = $2 AND type = $3',
          [userId, topicId, agentData.type]
        );

        if (existing) {
          console.log(`[AgentModel] Agent ${agentData.type} already exists for topic ${topicId}`);
          agents.push(existing);
          continue;
        }

        const agent = await this.create(userId, {
          ...agentData,
          topic_id: topicId,
          enabled: true,
          config: { searchDepth: 10 }
        });
        agents.push(agent);
        console.log(`[AgentModel] Created agent: ${agentData.name} for topic ${topicId}`);
      } catch (error) {
        const errorMsg = `Failed to create ${agentData.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[AgentModel] ${errorMsg}`);
        errors.push(errorMsg);
        // Continue creating other agents - don't let one failure block all
      }
    }

    // Log summary
    console.log(`[AgentModel] Created ${agents.length}/3 agents for topic ${topicId}`);
    if (errors.length > 0) {
      console.warn(`[AgentModel] Errors during agent creation:`, errors);
    }

    return agents;
  }

  // Update an agent
  static async update(id: string, userId: string, updates: Partial<Agent>): Promise<Agent | null> {
    const allowedFields = ['name', 'type', 'enabled', 'config', 'schedule', 'last_run', 'next_run'];
    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'config') {
          setClause.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          setClause.push(`${key} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    }

    if (setClause.length === 0) {
      return this.getById(id, userId);
    }

    values.push(id, userId);

    return queryOne<Agent>(
      `UPDATE agents
       SET ${setClause.join(', ')}
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING *`,
      values
    );
  }

  // Update last run time
  static async updateLastRun(id: string, userId: string): Promise<Agent | null> {
    return queryOne<Agent>(
      `UPDATE agents
       SET last_run = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );
  }

  // Toggle enabled status
  static async toggleEnabled(id: string, userId: string): Promise<Agent | null> {
    const agent = await this.getById(id, userId);
    if (!agent) return null;

    return this.update(id, userId, { enabled: !agent.enabled });
  }

  // Delete an agent
  static async delete(id: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM agents WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return result.length > 0;
  }

  // Delete all agents for a topic
  static async deleteByTopicId(userId: string, topicId: string): Promise<number> {
    const result = await query(
      'DELETE FROM agents WHERE user_id = $1 AND topic_id = $2 RETURNING id',
      [userId, topicId]
    );
    return result.length;
  }

  // Get agents due for scheduled run
  static async getDueForRun(userId: string): Promise<Agent[]> {
    return query<Agent>(
      `SELECT * FROM agents
       WHERE user_id = $1
         AND enabled = true
         AND (next_run IS NULL OR next_run <= CURRENT_TIMESTAMP)
       ORDER BY next_run ASC NULLS FIRST`,
      [userId]
    );
  }
}
