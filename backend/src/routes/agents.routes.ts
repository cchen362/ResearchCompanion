import express from 'express';
import { AgentModel, Agent } from '../models/agent.model.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const CreateAgentSchema = z.object({
  topic_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(50),
  enabled: z.boolean().optional().default(true),
  config: z.record(z.string(), z.any()).optional(),
  schedule: z.string().optional()
});

const UpdateAgentSchema = CreateAgentSchema.partial().extend({
  last_run: z.coerce.date().optional(),
  next_run: z.coerce.date().optional()
});

// GET /api/agents - Get all agents for the authenticated user
router.get('/agents', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const topicId = req.query.topic_id as string | undefined;

    let agents;
    if (topicId) {
      agents = await AgentModel.getByTopicId(userId, topicId);
    } else {
      agents = await AgentModel.getAllByUserId(userId);
    }

    res.json({
      success: true,
      agents
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agents'
    });
  }
});

// GET /api/agents/:id - Get a single agent
router.get('/agents/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const agent = await AgentModel.getById(id, userId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    res.json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent'
    });
  }
});

// POST /api/agents - Create a new agent
router.post('/agents', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Validate request body
    const validation = CreateAgentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const agent = await AgentModel.create(userId, validation.data);

    res.status(201).json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create agent'
    });
  }
});

// POST /api/agents/defaults/:topicId - Create default agents for a topic
router.post('/agents/defaults/:topicId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { topicId } = req.params;

    const agents = await AgentModel.createDefaultsForTopic(userId, topicId);

    res.status(201).json({
      success: true,
      agents
    });
  } catch (error) {
    console.error('Error creating default agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create default agents'
    });
  }
});

// POST /api/agents/repair/:topicId - Create missing default agents for existing topic
router.post('/agents/repair/:topicId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { topicId } = req.params;

    // Get existing agents for this topic
    const existing = await AgentModel.getByTopicId(userId, topicId);
    const existingTypes = new Set(existing.map(a => a.type));

    // Define required agents
    const requiredAgents = [
      { type: 'treatment_breakthrough', name: 'Treatment Breakthrough Agent' },
      { type: 'clinical_trial', name: 'Clinical Trial Agent' },
      { type: 'medical_literature', name: 'Medical Literature Agent' }
    ];

    // Find and create missing agents
    const created: Agent[] = [];
    const errors: string[] = [];

    for (const { type, name } of requiredAgents) {
      if (!existingTypes.has(type)) {
        try {
          const agent = await AgentModel.create(userId, {
            topic_id: topicId,
            name,
            type,
            enabled: true,
            config: { searchDepth: 10 },
            schedule: 'daily'
          });
          created.push(agent);
          console.log(`[AgentRepair] Created missing agent: ${name} for topic ${topicId}`);
        } catch (error) {
          const errorMsg = `Failed to create ${name}: ${error instanceof Error ? error.message : 'Unknown'}`;
          console.error(`[AgentRepair] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    res.json({
      success: true,
      message: `Repair complete: ${created.length} agents created`,
      existing: existing.length,
      created: created.length,
      errors: errors.length > 0 ? errors : undefined,
      agents: [...existing, ...created]
    });
  } catch (error) {
    console.error('Error repairing agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to repair agents'
    });
  }
});

// PUT /api/agents/:id - Update an agent
router.put('/agents/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    // Validate request body
    const validation = UpdateAgentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const agent = await AgentModel.update(id, userId, validation.data);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    res.json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update agent'
    });
  }
});

// POST /api/agents/:id/toggle - Toggle agent enabled status
router.post('/agents/:id/toggle', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const agent = await AgentModel.toggleEnabled(id, userId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    res.json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('Error toggling agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle agent'
    });
  }
});

// POST /api/agents/:id/run - Update last run time
router.post('/agents/:id/run', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const agent = await AgentModel.updateLastRun(id, userId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    res.json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('Error updating agent run:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update agent run'
    });
  }
});

// DELETE /api/agents/:id - Delete an agent
router.delete('/agents/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const deleted = await AgentModel.delete(id, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    res.json({
      success: true,
      message: 'Agent deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete agent'
    });
  }
});

export default router;
