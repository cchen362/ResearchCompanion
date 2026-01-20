import { z } from 'zod';

// Citation schema matching frontend expectations
export const CitationSchema = z.object({
  citationNumber: z.number().int().positive(),
  findingId: z.string().nullable(), // Can be null if finding not available
  citationText: z.string(),
  source: z.union([
    z.string(),
    z.object({
      name: z.string(),
      displayName: z.string().optional(),
      type: z.string().optional(),
      url: z.string().optional(),
      journal: z.string().optional(),
      publishDate: z.string().optional()
    })
  ]),
  highlightStart: z.number().int().nonnegative().optional(),
  highlightEnd: z.number().int().positive().optional(),
  isPlaceholder: z.boolean().optional() // True if citation reference not available
});

export type Citation = z.infer<typeof CitationSchema>;

// Chat message schema with citations
export const ChatMessageSchema = z.object({
  id: z.string(),
  chatId: z.string().optional(),
  chat_id: z.string().optional(), // Backend uses snake_case
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  citations: z.array(CitationSchema).nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  timestamp: z.string().optional(),
  created_at: z.string().optional() // Backend uses snake_case
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/**
 * Validate and clean citations array
 * @param citations Raw citations data from any source
 * @returns Validated citations array or null
 */
export function validateCitations(citations: unknown): Citation[] | null {
  if (!citations) return null;

  // Handle string citations (from PostgreSQL JSONB)
  let parsedCitations = citations;
  if (typeof citations === 'string') {
    try {
      parsedCitations = JSON.parse(citations);
    } catch (error) {
      console.error('[validateCitations] Failed to parse citations string:', error);
      return null;
    }
  }

  // Validate array structure
  if (!Array.isArray(parsedCitations)) {
    console.warn('[validateCitations] Citations is not an array:', typeof parsedCitations);
    return null;
  }

  // Validate each citation
  const validCitations: Citation[] = [];
  const invalidIndices: number[] = [];

  parsedCitations.forEach((citation, index) => {
    try {
      const validated = CitationSchema.parse(citation);
      validCitations.push(validated);
    } catch (error) {
      console.warn(`[validateCitations] Citation ${index} failed validation:`, error);
      invalidIndices.push(index);
    }
  });

  if (invalidIndices.length > 0) {
    console.warn(`[validateCitations] ${invalidIndices.length} invalid citations filtered out at indices: [${invalidIndices.join(', ')}]`);
  }

  console.log(`[validateCitations] Validated ${validCitations.length} citations out of ${parsedCitations.length}`);

  return validCitations.length > 0 ? validCitations : null;
}

/**
 * Check if all mentioned citations in content have corresponding citation objects
 * @param content The text content with citation references like [1], [2]
 * @param citations The array of citation objects
 * @returns Object with validation results
 */
export function validateCitationReferences(
  content: string,
  citations: Citation[] | null
): {
  isValid: boolean;
  mentionedNumbers: number[];
  availableNumbers: number[];
  missingNumbers: number[];
} {
  // Extract all citation numbers mentioned in content
  const mentionedNumbers = new Set<number>();
  const citationPattern = /\[(\d+)\]/g;
  let match;

  while ((match = citationPattern.exec(content)) !== null) {
    mentionedNumbers.add(parseInt(match[1]));
  }

  // Get available citation numbers
  const availableNumbers = citations
    ? citations.map(c => c.citationNumber).filter(Boolean)
    : [];

  // Find missing citations
  const missingNumbers = Array.from(mentionedNumbers).filter(
    num => !availableNumbers.includes(num)
  );

  const result = {
    isValid: missingNumbers.length === 0,
    mentionedNumbers: Array.from(mentionedNumbers).sort((a, b) => a - b),
    availableNumbers: availableNumbers.sort((a, b) => a - b),
    missingNumbers: missingNumbers.sort((a, b) => a - b)
  };

  if (!result.isValid) {
    console.warn(`[validateCitationReferences] Missing citations for references: [${result.missingNumbers.join(', ')}]`);
  }

  return result;
}

/**
 * Create placeholder citations for missing references
 * @param missingNumbers Array of citation numbers that are missing
 * @returns Array of placeholder citations
 */
export function createPlaceholderCitations(missingNumbers: number[]): Citation[] {
  return missingNumbers.map(num => ({
    citationNumber: num,
    findingId: null,
    citationText: `Citation ${num} (reference not available)`,
    source: {
      name: 'Reference Not Available',
      displayName: 'Reference Not Available',
      type: 'unavailable'
    },
    isPlaceholder: true
  }));
}

/**
 * Merge citations with placeholders for missing references
 * @param content The text content with citation references
 * @param citations Existing citations array
 * @returns Complete citations array with placeholders for missing references
 */
export function ensureCompleteCitations(
  content: string,
  citations: Citation[] | null
): Citation[] {
  const validation = validateCitationReferences(content, citations);

  if (validation.isValid && citations) {
    return citations;
  }

  // Create placeholders for missing citations
  const placeholders = createPlaceholderCitations(validation.missingNumbers);

  // Merge existing citations with placeholders
  const merged = [...(citations || []), ...placeholders];

  // Sort by citation number for consistency
  merged.sort((a, b) => a.citationNumber - b.citationNumber);

  console.log(`[ensureCompleteCitations] Added ${placeholders.length} placeholder citations`);

  return merged;
}