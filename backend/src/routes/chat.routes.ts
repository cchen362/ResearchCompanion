import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { aiService } from '../services/ai.service.js';
import { Anthropic } from '@anthropic-ai/sdk';
import { FindingModel } from '../models/finding.model.js';
import { logger } from '../utils/logger.js';

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
    conversationFocus: z.string().optional(),
    citationMap: z.record(z.string(), z.number()).optional() // Add citation map for persistence
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
    if (userId && validated.topicId) {
      // Always try to enrich context with topic findings when we have a user and topic
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

    // Log request size for debugging
    const requestSize = JSON.stringify({ system: systemPrompt, messages }).length;
    logger.info(`[chat.routes] AI Request size: ${requestSize} bytes (${(requestSize / 1024).toFixed(2)} KB)`);
    logger.debug(`[chat.routes] System prompt tokens (est): ${Math.ceil(systemPrompt.length / 4)}`);
    logger.debug(`[chat.routes] Total findings in context: ${enrichedContext.findings?.length || 0}`);

    // Get AI response with built-in retry from SDK
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

    // Process citations from the response using the citation map created in buildSystemPrompt
    const findingsForCitations = enrichedContext.findings || [];
    const citations = extractCitations(content, findingsForCitations, enrichedContext.citationMap);

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
      processingTime: Date.now(),
      citationMap: enrichedContext.citationMap // Include citation map for persistence
    });
  } catch (error: any) {
    logger.error('[chat.routes] Chat completion error:', error);

    // Check for specific error types
    if (error?.status === 529 || error?.error?.error?.type === 'overloaded_error') {
      logger.warn('[chat.routes] Anthropic API overloaded (529), SDK should have retried 3 times');
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'The AI service is currently overloaded. Please try again in a few moments.',
        retryAfter: 5
      });
    }

    if (error?.status === 429) {
      logger.warn('[chat.routes] Rate limit hit (429)');
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please slow down and try again in a moment.',
        retryAfter: 10
      });
    }

    if (error?.status === 401) {
      logger.error('[chat.routes] API key invalid or missing');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'AI service is not properly configured. Please contact support.'
      });
    }

    // Generic error response
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
    if (userId && validated.topicId) {
      // Always try to enrich context with topic findings when we have a user and topic
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

        // Don't extract citations during streaming - wait until message is complete
      } else if (chunk.type === 'message_stop') {
        logger.debug(`[chat.routes] Streaming response complete. Content: ${fullContent.length} chars, findings: ${enrichedContext.findings?.length || 0}`);

        // Find all citation numbers mentioned in content (handles both [30] and [30, 33])
        const mentionedCitations = new Set<number>();
        const citationPattern = /\[([0-9,\s]+)\]/g;
        let match;
        while ((match = citationPattern.exec(fullContent)) !== null) {
          const nums = match[1].split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
          nums.forEach(n => mentionedCitations.add(n));
        }
        logger.debug(`[chat.routes] Citations mentioned in content: [${Array.from(mentionedCitations).sort((a, b) => a - b).join(', ')}]`);

        // Extract ALL citations now that the response is complete using the citation map
        const citations = extractCitations(fullContent, enrichedContext.findings || [], enrichedContext.citationMap);
        if (citations.length > 0) {
          logger.debug(`[chat.routes] Extracted ${citations.length} citations from complete response`);

          // Send all citations at once
          for (const citation of citations) {
            res.write(`data: ${JSON.stringify({
              type: 'citation',
              citation
            })}\n\n`);
          }
        } else {
          logger.debug(`[chat.routes] No citations extracted despite ${mentionedCitations.size} being mentioned`);
        }

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

        // Send metadata including citation map for persistence
        res.write(`data: ${JSON.stringify({
          type: 'metadata',
          suggestedQuestions,
          relatedFindings,
          citationMap: enrichedContext.citationMap // Include citation map
        })}\n\n`);

        // Send completion signal
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
  } catch (error: any) {
    logger.error('[chat.routes] Streaming error:', error);

    let errorMessage = 'Stream failed';
    let shouldRetry = false;

    // Check for specific error types
    if (error?.status === 529 || error?.error?.error?.type === 'overloaded_error') {
      logger.warn('[chat.routes] Anthropic API overloaded (529)');
      errorMessage = 'The AI service is currently overloaded. Please try again in a few moments.';
      shouldRetry = true;
    } else if (error?.status === 429) {
      logger.warn('[chat.routes] Rate limit hit (429)');
      errorMessage = 'Too many requests. Please slow down and try again.';
      shouldRetry = true;
    } else if (error?.status === 401) {
      logger.error('[chat.routes] API key invalid or missing');
      errorMessage = 'AI service configuration error. Please contact support.';
    }

    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: errorMessage,
      shouldRetry
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
      system: 'Generate a warm, concise title (max 50 characters) for a conversation where a caregiver is exploring medical research. Use natural language like "Understanding treatment options" rather than clinical labels like "Query: Treatment modalities". Return only the title, no quotes or formatting.',
      messages: [
        { role: 'user', content: validated.message }
      ]
    });

    const title = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : 'New Conversation';

    res.json({ title });
  } catch (error) {
    logger.error('[chat.routes] Title generation error:', error);
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
    logger.error('[chat.routes] Suggestions error:', error);
    res.status(500).json({
      error: 'Failed to generate suggestions',
      questions: []
    });
  }
});

// Helper functions

/**
 * Create a stable citation mapping for findings
 * This assigns citation numbers to findings that persist across messages
 */
function createCitationMapping(findings: any[], existingMap?: Map<string, number>): Map<string, number> {
  const citationMap = new Map<string, number>(existingMap);
  let nextCitationNumber = 1;

  // Calculate next citation number if there's an existing map with values
  if (existingMap && existingMap.size > 0) {
    const values = Array.from(existingMap.values());
    if (values.length > 0) {
      nextCitationNumber = Math.max(...values) + 1;
    }
  }

  // Assign citation numbers to new findings not yet in the map
  for (const finding of findings) {
    if (!citationMap.has(finding.id)) {
      citationMap.set(finding.id, nextCitationNumber);
      nextCitationNumber++;
    }
  }

  logger.debug(`[chat.routes] createCitationMapping: ${citationMap.size} entries`);

  return citationMap;
}

function buildSystemPrompt(context: any): string {
  // Create or update the citation mapping
  const existingMap = context.citationMap
    ? new Map(Object.entries(context.citationMap).map(([k, v]) => [k, Number(v)] as [string, number]))
    : undefined;
  const citationMap = createCitationMapping(context.findings || [], existingMap);

  // Store the citation map back in the context for persistence
  context.citationMap = Object.fromEntries(citationMap);

  let prompt = `You are a caring and knowledgeable medical research companion. You support caregivers, parents, and families who are navigating complex medical conditions by helping them understand research findings in plain, reassuring language.

CORE PRINCIPLE — Facts, Not Scores:
- Every claim you make MUST be grounded in the provided research findings
- Always cite your sources using the assigned citation numbers
- Never invent, embellish, or soften factual information
- If findings are concerning, present them honestly with proper context
- If information is missing or uncertain, say so clearly

Your personality:
- Warm and conversational, like a well-informed friend who genuinely cares
- Acknowledge the emotional weight of medical research when appropriate
- Be honest about uncertainties without being alarmist
- Use inclusive language to create partnership ("Let's look at what the research says...")
- Respect that caregivers often become experts in their conditions

Your communication style:
- Clear and accessible — explain medical terms naturally in context
- Use short paragraphs and breathing room in responses
- Lead with the most relevant information, providing context for difficult findings
- When findings are concerning, pair them with what IS known and constructive next steps
- Ask thoughtful follow-up questions to understand what matters most to the user

What you must NOT do:
- Don't sugarcoat or downplay concerning research findings — honesty builds trust
- Don't be overly cheerful or minimize real concerns
- Don't use emojis or decorative symbols
- Don't provide medical advice — always encourage consulting healthcare professionals
- Don't be condescending about the user's level of medical knowledge
- Don't invent information to fill gaps — be transparent about what the research does and doesn't cover

FORMATTING GUIDELINES:
- Use markdown formatting sparingly and appropriately
- Use ** for important medical terms or key findings
- Use ## for major section headers when organizing complex responses
- Use - for bullet points in lists
- Keep formatting professional and focused on readability

When you have limited information from the findings:
- Be transparent about what information is available vs. what is missing
- Provide specific, actionable suggestions for obtaining more information
- Share what IS known from the findings, even if incomplete
- Suggest specific questions the user could explore or search terms to use

CRITICAL CITATION INSTRUCTIONS:
When referencing research findings, you MUST use the EXACT citation numbers provided below.
Each finding has been assigned a specific citation number that you must use when referencing it.
DO NOT create your own citation numbers or use array positions.

Available research findings with their assigned citation numbers:`;

  if (context.findings && context.findings.length > 0) {
    const findingsToInclude = context.findings;

    logger.debug(`[chat.routes] buildSystemPrompt: Including ${findingsToInclude.length} findings with stable citation numbers`);

    // Sort findings by their citation number for consistent presentation
    const findingsWithNumbers = findingsToInclude.map((finding: any) => ({
      finding,
      citationNumber: citationMap.get(finding.id) || 999
    })).sort((a: any, b: any) => a.citationNumber - b.citationNumber);

    findingsWithNumbers.forEach(({ finding, citationNumber }: any) => {
      const sourceInfo = finding.source || 'Unknown Source';
      const title = finding.title || 'Untitled';
      const content = finding.content || finding.summary || '';

      prompt += `\n\n[${citationNumber}] - Finding ID: ${finding.id}`;
      prompt += `\nSource: ${sourceInfo}`;
      prompt += `\nTitle: ${title}`;
      if (content) {
        // Limit content preview to reduce token usage (200 chars max)
        prompt += `\nContent: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`;
      }
    });

    prompt += `\n\nREMINDER: You have exactly ${citationMap.size} findings available with citation numbers from [1] to [${citationMap.size}].`;
    prompt += `\nUSE ONLY THE CITATION NUMBERS SHOWN ABOVE. Never create new citation numbers.`;
  } else {
    prompt += '\n\nNo research findings are currently available for citation.';
  }

  if (context.conversationFocus) {
    prompt += `\n\nCurrent conversation focus: ${context.conversationFocus}`;
  }

  prompt += '\n\nImportant: You are NOT a doctor and cannot provide medical advice. Always encourage consulting healthcare professionals for medical decisions. You CAN help interpret research findings, explain medical concepts, and help caregivers prepare informed questions for their medical team.';

  return prompt;
}

function extractCitations(
  content: string,
  findings: any[],
  citationMap?: Map<string, number> | Record<string, number>
): Array<{
  findingId: string | null;
  citationNumber: number;
  citationText: string;
  source?: any;
  highlightStart: number;
  highlightEnd: number;
  isPlaceholder?: boolean;
}> {
  const citations: Array<any> = [];
  // Match both [30] and [30, 33] formats — same regex as frontend ChatMessage.tsx
  const citationPattern = /\[([0-9,\s]+)\]/g;
  const seenCitations = new Set<number>();
  let match;

  // Convert citationMap to Map if it's a plain object
  const mapAsMap = citationMap instanceof Map
    ? citationMap
    : citationMap
      ? new Map(Object.entries(citationMap))
      : null;

  // Create reverse map: citation number -> finding ID
  const reverseMap = new Map<number, string>();
  if (mapAsMap) {
    for (const [findingId, citationNum] of mapAsMap.entries()) {
      reverseMap.set(citationNum, findingId);
    }
  }

  // Extract all citation numbers from the content first for logging
  const allCitationNumbers: number[] = [];
  const logPattern = /\[([0-9,\s]+)\]/g;
  while ((match = logPattern.exec(content)) !== null) {
    const nums = match[1].split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    allCitationNumbers.push(...nums);
  }

  logger.debug(`[chat.routes] extractCitations: Found ${allCitationNumbers.length} citation refs in content, ${findings.length} findings, map size: ${mapAsMap?.size || 0}`);

  while ((match = citationPattern.exec(content)) !== null) {
    // Split comma-separated numbers: [30, 33] -> [30, 33]
    const nums = match[1].split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));

    for (const citationNum of nums) {
    // Skip if we've already processed this citation number
    if (seenCitations.has(citationNum)) continue;
    seenCitations.add(citationNum);

    let finding = null;
    let findingId: string | null = null;

    if (reverseMap.has(citationNum)) {
      // Use the citation map to find the correct finding
      findingId = reverseMap.get(citationNum)!;
      finding = findings.find(f => f.id === findingId);

      logger.debug(`[chat.routes] extractCitations: Using citation map: [${citationNum}] => ${findingId.substring(0, 8)}...`);
    } else if (!mapAsMap) {
      // Fallback to array index if no map exists (backward compatibility)
      const arrayIndex = citationNum - 1;
      if (arrayIndex >= 0 && arrayIndex < findings.length) {
        finding = findings[arrayIndex];
        findingId = finding.id;
        logger.debug(`[chat.routes] extractCitations: No map available, using array index fallback: [${citationNum}] => index ${arrayIndex}`);
      }
    }

    if (finding && findingId) {
      // Ensure source is an object, not a string
      const sourceObj = typeof finding.source === 'string'
        ? { name: finding.source, type: 'unknown', displayName: finding.source }
        : (finding.source || { name: 'Unknown Source', type: 'unknown', displayName: 'Unknown Source' });

      citations.push({
        findingId: findingId,
        citationNumber: citationNum,
        citationText: finding.title || finding.content?.substring(0, 100) || 'Research Finding',
        source: sourceObj,
        highlightStart: match.index,
        highlightEnd: match.index + match[0].length
      });

      logger.debug(`[chat.routes] extractCitations: Citation [${citationNum}] mapped to finding ${findingId}`);
    } else {
      // Create a placeholder citation for unmapped citations
      logger.warn(`[chat.routes] extractCitations: Citation [${citationNum}] not found in citation map or findings`);

      citations.push({
        findingId: null,
        citationNumber: citationNum,
        citationText: `Citation ${citationNum} (reference not available)`,
        source: { name: 'Reference Not Available', type: 'unavailable', displayName: 'Reference Not Available' },
        highlightStart: match.index,
        highlightEnd: match.index + match[0].length,
        isPlaceholder: true
      });

      logger.debug(`[chat.routes] extractCitations: Created placeholder for unmapped citation [${citationNum}]`);
    }
    } // end for (const citationNum of nums)
  }

  logger.debug(`[chat.routes] extractCitations: Extracted ${citations.length} citations (${citations.filter(c => !c.isPlaceholder).length} valid, ${citations.filter(c => c.isPlaceholder).length} placeholders)`);
  return citations;
}

async function generateSuggestedQuestions(
  topicId: string,
  context: any,
  lastResponse: string
): Promise<string[]> {
  try {
    const prompt = `A caregiver is researching medical information about topic ${topicId}. Based on the conversation so far, suggest 3-5 thoughtful follow-up questions they might want to explore.

The questions should be:
- Practical and actionable (things a caregiver would actually want to know)
- Written in natural, conversational language (not clinical jargon)
- A mix of deeper research questions and practical next-step questions
- Sensitive to the emotional weight of medical research

Context focus: ${context.conversationFocus || 'general inquiry'}
Last response summary: ${lastResponse.substring(0, 200)}

Return only a JSON array of question strings, no other formatting.`;

    const response = await aiService.client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      temperature: 0.7,
      system: 'You are a caring medical research companion helping caregivers and families explore research findings. Suggest questions that are warm, practical, and grounded in the available research.',
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
        'What are the most promising findings from recent research?',
        'Are there any new treatment approaches being explored?',
        'What questions should I bring to my next doctor\'s appointment?'
      ];
    }
  } catch (error) {
    logger.error('[chat.routes] Failed to generate suggestions:', error);
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
    // Check what findings were provided from frontend
    const contextFindings = context.findings || [];
    const currentFindingIds = context.currentFindings || [];

    logger.debug(`[chat.routes] enrichFindingsContext: Received ${contextFindings.length} findings from frontend, topicId: ${topicId}`);

    // If frontend provided findings in the correct format, use them directly
    if (contextFindings.length > 0) {
      logger.debug(`[chat.routes] enrichFindingsContext: Using ${contextFindings.length} findings from frontend`);
      return {
        ...context,
        findings: contextFindings
      };
    }

    // Otherwise, fetch findings from database
    const findingIds = currentFindingIds.filter(Boolean);

    // Always try to fetch findings for the topic, but with a reasonable limit
    if (findingIds.length < 5 || contextFindings.length === 0) {
      // Fetch recent findings for the topic with a limit to prevent API overload
      // 50 findings provides good context without overwhelming the AI and matches frontend limit
      const topicFindings = await FindingModel.getFiltered(userId, {
        topic_id: topicId,
        limit: 50  // CRITICAL: This must match the frontend limit in ChatPanel.tsx
      });

      if (topicFindings.length > 0) {
        logger.info(`[chat.routes] Loaded ${topicFindings.length} recent findings (max 50) for context`);
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

      // If no findings in DB either, use whatever context was provided
      logger.warn(`[chat.routes] No findings found for topic ${topicId}`);
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

    // If we still don't have all topic findings, fetch any missing ones
    // This ensures we have complete context for the user's questions
    if (topicId) {
      const allTopicFindings = await FindingModel.getFiltered(userId, {
        topic_id: topicId
        // No limit - get all findings for complete context
      });

      for (const finding of allTopicFindings) {
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
    logger.error('[chat.routes] Error enriching findings context:', error);
    // Return original context on error
    return context;
  }
}

export default router;