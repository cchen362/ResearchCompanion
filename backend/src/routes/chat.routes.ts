import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { aiService } from '../services/ai.service.js';
import { Anthropic } from '@anthropic-ai/sdk';
import { FindingModel } from '../models/finding.model.js';

const router = Router();

// Request validation schemas
const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  chatId: z.string(),
  topicId: z.string(),
  context: z.object({
    findings: z.array(z.object({
      id: z.string(),
      title: z.string().optional(),
      content: z.string(),
      source: z.string(),
      type: z.string().optional(),
      createdAt: z.string().optional(),
      priority: z.string().optional()
    })).optional(),
    previousMessages: z.array(z.object({
      role: z.string(),
      content: z.string()
    })).optional(),
    currentFindings: z.array(z.string()).optional(),
    expandedTopics: z.array(z.string()).optional(),
    recentInteractions: z.array(z.string()).optional(),
    userPreferences: z.record(z.string(), z.any()).optional(),
    conversationFocus: z.string().optional()
  }),
  stream: z.boolean().optional()
});

const TitleGenerationSchema = z.object({
  message: z.string().min(1).max(500),
  chatId: z.string()
});

const SuggestionsRequestSchema = z.object({
  topicId: z.string(),
  context: z.object({
    currentFindings: z.array(z.string()).optional(),
    recentInteractions: z.array(z.string()).optional(),
    conversationFocus: z.string().optional()
  })
});

/**
 * Non-streaming chat completion
 */
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const validated = ChatRequestSchema.parse(req.body);
    const userId = (req as any).user?.id;

    // Enrich findings from database if user is authenticated
    let enrichedContext = validated.context;
    if (userId && validated.context.findings && validated.context.findings.length > 0) {
      enrichedContext = await enrichFindingsContext(userId, validated.context, validated.topicId);
    }

    // Build the system prompt with enriched context
    const systemPrompt = buildSystemPrompt(enrichedContext);

    // Build the messages array
    const messages: Anthropic.Messages.MessageParam[] = [
      { role: 'user', content: validated.message }
    ];

    // Add previous messages for context (last 10 messages)
    if (validated.context.previousMessages) {
      const contextMessages = validated.context.previousMessages
        .slice(-10)
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));
      messages.unshift(...contextMessages);
    }

    // Get AI response
    const response = await aiService.client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      temperature: 0.7,
      system: systemPrompt,
      messages
    });

    // Extract content
    const content = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Process citations from the response
    const citations = extractCitations(content, enrichedContext.findings || []);
    console.log('🔍 [BACKEND] Citations extracted:', {
      count: citations.length,
      citations: citations,
      findingsCount: enrichedContext.findings?.length || 0,
      contentHasBrackets: /\[\d+\]/.test(content)
    });

    // Generate suggested questions
    const suggestedQuestions = await generateSuggestedQuestions(
      validated.topicId,
      validated.context,
      content
    );

    // Find related findings
    const relatedFindings = findRelatedFindings(
      content,
      enrichedContext.findings || []
    );

    res.json({
      content,
      citations,
      suggestedQuestions,
      relatedFindings,
      model: response.model,
      tokens: response.usage?.output_tokens,
      processingTime: Date.now()
    });
  } catch (error) {
    console.error('Chat completion error:', error);
    res.status(500).json({
      error: 'Failed to generate response',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Streaming chat completion using Server-Sent Events
 */
router.post('/stream', async (req: Request, res: Response) => {
  try {
    const validated = ChatRequestSchema.parse(req.body);
    const userId = (req as any).user?.id;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Enrich findings from database if user is authenticated
    let enrichedContext = validated.context;
    if (userId && validated.context.findings && validated.context.findings.length > 0) {
      enrichedContext = await enrichFindingsContext(userId, validated.context, validated.topicId);
    }

    // Build the system prompt with enriched context
    const systemPrompt = buildSystemPrompt(enrichedContext);

    // Build the messages array
    const messages: Anthropic.Messages.MessageParam[] = [
      { role: 'user', content: validated.message }
    ];

    // Add previous messages for context
    if (validated.context.previousMessages) {
      const contextMessages = validated.context.previousMessages
        .slice(-10)
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));
      messages.unshift(...contextMessages);
    }

    // Create streaming response
    const stream = await aiService.client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      temperature: 0.7,
      system: systemPrompt,
      messages,
      stream: true
    });

    let fullContent = '';
    let citationsSent = false;

    // Process stream
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const token = chunk.delta.text;
        fullContent += token;

        // Send token to client
        res.write(`data: ${JSON.stringify({
          type: 'token',
          content: token
        })}\n\n`);

        // Check for citations periodically
        if (!citationsSent && fullContent.includes('[')) {
          const citations = extractCitations(fullContent, validated.context.findings || []);
          for (const citation of citations) {
            res.write(`data: ${JSON.stringify({
              type: 'citation',
              citation
            })}\n\n`);
          }
          citationsSent = true;
        }
      } else if (chunk.type === 'message_stop') {
        // Generate metadata at the end
        const suggestedQuestions = await generateSuggestedQuestions(
          validated.topicId,
          validated.context,
          fullContent
        );

        const relatedFindings = findRelatedFindings(
          fullContent,
          validated.context.findings || []
        );

        // Send metadata
        res.write(`data: ${JSON.stringify({
          type: 'metadata',
          suggestedQuestions,
          relatedFindings
        })}\n\n`);

        // Send completion signal
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
  } catch (error) {
    console.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Stream failed'
    })}\n\n`);
    res.end();
  }
});

/**
 * Generate a title for a chat
 */
router.post('/generate-title', async (req: Request, res: Response) => {
  try {
    const validated = TitleGenerationSchema.parse(req.body);

    const response = await aiService.client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 50,
      temperature: 0.5,
      system: 'Generate a concise, descriptive title (max 50 characters) for a medical conversation that starts with the following message. Return only the title, no quotes or formatting.',
      messages: [
        { role: 'user', content: validated.message }
      ]
    });

    const title = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : 'New Conversation';

    res.json({ title });
  } catch (error) {
    console.error('Title generation error:', error);
    res.status(500).json({
      error: 'Failed to generate title',
      title: 'New Conversation'
    });
  }
});

/**
 * Get suggested questions
 */
router.post('/suggestions', async (req: Request, res: Response) => {
  try {
    const validated = SuggestionsRequestSchema.parse(req.body);

    const questions = await generateSuggestedQuestions(
      validated.topicId,
      validated.context,
      ''
    );

    res.json({ questions });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({
      error: 'Failed to generate suggestions',
      questions: []
    });
  }
});

// Helper functions

function buildSystemPrompt(context: any): string {
  let prompt = `You are a knowledgeable medical research assistant helping users understand and explore medical research findings.
You have access to research findings, clinical trials, and medical literature that the user has collected.

Your responses should be:
- Accurate and evidence-based, drawing from the provided findings when available
- Clear and easy to understand, avoiding unnecessary medical jargon
- Professional and factual without using emojis or decorative symbols
- Focused on the user's specific questions

FORMATTING GUIDELINES:
- Use markdown formatting sparingly and appropriately:
  - Use ** for important medical terms or key findings (e.g., **Vebeglogene Autotemcel**)
  - Use ## for major section headers when organizing complex responses
  - Use - for bullet points in lists
- Do NOT use emojis or decorative Unicode symbols
- Keep formatting professional and focused on readability
- Prioritize clarity and structure in your responses

When you have limited information from the findings:
- Be transparent about what information is available vs. what is missing
- Provide specific, actionable suggestions for obtaining more information
- Share what IS known from the findings, even if incomplete
- Suggest specific questions the user could explore or search terms to use

When referencing research findings, use citations in the format [1], [2], etc. and briefly mention the source type.

Important: You are NOT providing medical advice. Encourage users to consult with healthcare professionals for medical decisions. However, you CAN help interpret research findings and explain medical concepts.`;

  if (context.findings && context.findings.length > 0) {
    prompt += '\n\nAvailable research findings for reference:\n';
    context.findings.forEach((finding: any, index: number) => {
      const sourceInfo = finding.source || 'Unknown Source';
      const title = finding.title || 'Untitled';
      const content = finding.content || finding.summary || '';

      prompt += `\n[${index + 1}] ${sourceInfo} - "${title}"`;
      if (content) {
        // Provide more context, up to 400 chars instead of 200
        prompt += `\nContent: ${content.substring(0, 400)}${content.length > 400 ? '...' : ''}`;
      }
      prompt += '\n';
    });
  }

  if (context.conversationFocus) {
    prompt += `\n\nCurrent conversation focus: ${context.conversationFocus}`;
  }

  return prompt;
}

function extractCitations(
  content: string,
  findings: any[]
): Array<{
  findingId: string;
  citationNumber: number;
  citationText: string;
  highlightStart: number;
  highlightEnd: number;
}> {
  const citations: Array<any> = [];
  const citationPattern = /\[(\d+)\]/g;
  let match;

  while ((match = citationPattern.exec(content)) !== null) {
    const index = parseInt(match[1]) - 1;
    if (index >= 0 && index < findings.length) {
      const finding = findings[index];
      citations.push({
        findingId: finding.id,
        citationNumber: index + 1,
        citationText: finding.title || finding.content?.substring(0, 100) || 'Research Finding',
        highlightStart: match.index,
        highlightEnd: match.index + match[0].length
      });
    }
  }

  return citations;
}

async function generateSuggestedQuestions(
  topicId: string,
  context: any,
  lastResponse: string
): Promise<string[]> {
  try {
    const prompt = `Based on the medical research context about topic ${topicId} and the conversation so far, suggest 3-5 relevant follow-up questions the user might want to ask.

Context focus: ${context.conversationFocus || 'general inquiry'}
Last response summary: ${lastResponse.substring(0, 200)}

Return only a JSON array of question strings, no other formatting.`;

    const response = await aiService.client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      temperature: 0.7,
      system: 'You are a helpful assistant that suggests relevant medical research questions.',
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '[]';

    try {
      return JSON.parse(content);
    } catch {
      // Fallback to default questions
      return [
        'What are the key findings from recent research?',
        'Are there any contradictions in the research?',
        'What treatments show the most promise?'
      ];
    }
  } catch (error) {
    console.error('Failed to generate suggestions:', error);
    return [];
  }
}

function findRelatedFindings(
  content: string,
  findings: any[]
): string[] {
  const related: string[] = [];
  const contentLower = content.toLowerCase();

  for (const finding of findings) {
    // Check if finding topics are mentioned in the response
    const findingContent = (finding.content || '').toLowerCase();
    const findingTitle = (finding.title || '').toLowerCase();

    // Simple keyword matching - could be improved with NLP
    const keywords = findingTitle.split(' ').filter((w: string) => w.length > 4);

    for (const keyword of keywords) {
      if (contentLower.includes(keyword) && !related.includes(finding.id)) {
        related.push(finding.id);
        break;
      }
    }

    if (related.length >= 5) break; // Limit to 5 related findings
  }

  return related;
}

/**
 * Enrich findings context by fetching full details from database
 */
async function enrichFindingsContext(
  userId: string,
  context: any,
  topicId: string
): Promise<any> {
  try {
    // Get the finding IDs from the context
    const findingIds = context.findings?.map((f: any) => f.id) || [];

    if (findingIds.length === 0) {
      // If no findings provided, try to fetch recent findings for the topic
      const topicFindings = await FindingModel.getFiltered(userId, {
        topic_id: topicId,
        limit: 20
      });

      if (topicFindings.length > 0) {
        return {
          ...context,
          findings: topicFindings.map(f => ({
            id: f.id,
            title: f.title,
            content: f.content || f.summary || '',
            source: f.source?.displayName || f.source?.name || 'Unknown Source',
            type: f.category || 'research',
            createdAt: f.created_at,
            priority: f.relevance_score ? (f.relevance_score > 0.7 ? 'high' : f.relevance_score > 0.4 ? 'medium' : 'low') : 'medium'
          }))
        };
      }
      return context;
    }

    // Fetch full details for each finding from database
    const enrichedFindings = [];
    for (const findingId of findingIds) {
      const dbFinding = await FindingModel.getById(findingId, userId);

      if (dbFinding) {
        // Use database data to enrich the finding
        enrichedFindings.push({
          id: dbFinding.id,
          title: dbFinding.title,
          content: dbFinding.content || dbFinding.summary || '',
          source: dbFinding.source?.displayName || dbFinding.source?.name || 'Unknown Source',
          type: dbFinding.category || 'research',
          createdAt: dbFinding.created_at,
          priority: dbFinding.relevance_score ? (dbFinding.relevance_score > 0.7 ? 'high' : dbFinding.relevance_score > 0.4 ? 'medium' : 'low') : 'medium',
          // Include additional fields for richer context
          summary: dbFinding.summary,
          tags: dbFinding.tags,
          sourceUrl: dbFinding.source?.url,
          journal: dbFinding.source?.journal,
          publishDate: dbFinding.source?.publishDate
        });
      } else {
        // Keep the original finding if not found in DB (shouldn't happen but be safe)
        const originalFinding = context.findings.find((f: any) => f.id === findingId);
        if (originalFinding) {
          enrichedFindings.push(originalFinding);
        }
      }
    }

    // If we have fewer than expected, add more topic findings
    if (enrichedFindings.length < 10 && topicId) {
      const additionalFindings = await FindingModel.getFiltered(userId, {
        topic_id: topicId,
        limit: 10 - enrichedFindings.length
      });

      for (const finding of additionalFindings) {
        if (!enrichedFindings.find((f: any) => f.id === finding.id)) {
          enrichedFindings.push({
            id: finding.id,
            title: finding.title,
            content: finding.content || finding.summary || '',
            source: finding.source?.displayName || finding.source?.name || 'Unknown Source',
            type: finding.category || 'research',
            createdAt: finding.created_at,
            priority: finding.relevance_score ? (finding.relevance_score > 0.7 ? 'high' : finding.relevance_score > 0.4 ? 'medium' : 'low') : 'medium'
          });
        }
      }
    }

    return {
      ...context,
      findings: enrichedFindings
    };
  } catch (error) {
    console.error('Error enriching findings context:', error);
    // Return original context on error
    return context;
  }
}

export default router;