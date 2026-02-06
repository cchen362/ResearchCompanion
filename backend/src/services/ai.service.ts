import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { digestJSONSchema, SmartDigestSchema } from '../schemas/digest.schema.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// Initialize API clients with retry configuration
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  maxRetries: 2, // Reduce retries to 2
  timeout: 120000, // Increased to 120 seconds to allow complex digests to complete
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Parse a natural language search query using Claude
 */
export async function parseSearchQuery(query: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929', // Using Claude Sonnet 4.5 for superior quality
      max_tokens: 500,
      temperature: 0.3,
      system: `You are a health research query parser for a personal medical research assistant app.
Your job is to extract structured intent from natural language queries about health topics.
Current date: ${new Date().toISOString().split('T')[0]} (Year ${new Date().getFullYear()})

CRITICAL: Return ONLY valid JSON, no markdown, no code blocks, no explanations - just the raw JSON object.

REQUIRED OUTPUT FORMAT (JSON):
{
  "topic": "string - primary health condition or disease",
  "focus": "treatments | symptoms | trials | overview | diagnosis | prognosis",
  "modifiers": ["array of relevant modifiers: latest, new, children, adults, rare, etc."],
  "needsClarification": boolean,
  "suggestions": ["array of 2-3 clarifying questions if needsClarification=true"]
}

GUIDELINES:
1. Only process queries related to health, medical conditions, treatments, or medical research
2. For vague queries, set needsClarification=true
3. For off-topic queries, set needsClarification=true and suggest health-related alternatives
4. Extract the most specific condition name possible
5. Identify the user's research focus
6. Capture temporal and demographic modifiers
7. Interpret "latest" or "recent" as referring to ${new Date().getFullYear()} and ${new Date().getFullYear() - 1}`,
      messages: [
        {
          role: 'user',
          content: query
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      // Clean up the response - remove markdown code blocks if present
      let jsonText = content.text.trim();
      jsonText = jsonText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

      try {
        return JSON.parse(jsonText);
      } catch (e) {
        console.error('Failed to parse JSON:', jsonText);
        throw new Error('Failed to parse AI response as JSON');
      }
    }
    throw new Error('Unexpected response format');
  } catch (error) {
    console.error('Error parsing search query:', error);
    throw error;
  }
}

/**
 * Summarize search results using Claude
 */
export async function summarizeResults(
  searchResults: any[],
  query: string,
  context?: string
) {
  try {
    // Better error handling for missing fields
    const resultsText = searchResults.map(r => {
      const title = r.title || 'Untitled';
      const url = r.url || r.source?.url || 'No URL';
      const content = r.snippet || r.description || r.summary || r.abstract || 'No content available';

      return `Source: ${title}\nURL: ${url}\nContent: ${content}`;
    }).join('\n\n');

    // Log for debugging
    console.log(`Summarizing ${searchResults.length} results for query: ${query}`);

    const systemPrompt = context
      ? `You are a medical research assistant. Summarize the following search results, focusing on what's NEW or DIFFERENT from the previous context.
Previous context: ${context}`
      : `You are a medical research assistant. Summarize the following search results into clear, organized sections.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3000,  // Increased from 2000 to handle more search results
      temperature: 0.5,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Query: ${query}\n\nSearch Results:\n${resultsText}\n\nProvide a structured summary with:
1. Overview
2. New Research (if any)
3. Treatment Updates (if applicable)
4. Key Considerations
5. Layman Summary (simple language)`
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    throw new Error('Unexpected response format');
  } catch (error) {
    console.error('Error summarizing results:', error);
    console.error('Search results structure:', JSON.stringify(searchResults.slice(0, 1), null, 2));
    throw error;
  }
}

/**
 * Transcribe audio using OpenAI Whisper
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string) {
  try {
    console.log(`Transcribing audio: ${audioBuffer.length} bytes, type: ${mimeType}`);

    // Determine file extension from mime type
    const extMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/m4a': 'm4a',
      'audio/mp4': 'mp4'
    };
    const ext = extMap[mimeType] || 'webm';
    const filename = `audio.${ext}`;

    // Create a File-like object that OpenAI SDK can handle
    const file = new File([audioBuffer], filename, { type: mimeType });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'en'
    });

    console.log(`Transcription successful: ${transcription.text.length} chars`);
    return transcription.text;
  } catch (error: any) {
    console.error('Error transcribing audio:', error?.message || error);
    console.error('Error details:', JSON.stringify(error?.response?.data || error, null, 2));
    throw error;
  }
}

/**
 * Summarize transcribed text using Claude
 */
export async function summarizeTranscription(transcript: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      temperature: 0.3,
      system: `You are a medical documentation assistant specialized in helping caregivers of patients with rare diseases. You understand the importance of capturing every detail from doctor visits, as these details may be crucial for ongoing care, research participation, and treatment decisions.

Your role is to:
- Extract all medically relevant information with precision
- Identify medication changes (names, dosages, frequencies)
- Note any symptoms or side effects mentioned
- Capture all follow-up actions and appointments
- Highlight research opportunities or clinical trials mentioned
- Flag any concerns that need immediate attention
- Create clear, hybrid summaries that blend prose and bullet points effectively

Remember: Caregivers rely on accurate documentation to advocate for their loved ones. Be thorough and factual.`,
      messages: [
        {
          role: 'user',
          content: `Analyze this medical visit transcript and provide a structured summary for a caregiver managing a rare disease patient:

${transcript}

Provide the following sections:

1. VISIT SUMMARY
Start with a 2-3 sentence executive overview that captures the essence of the visit - the main purpose, key outcome, and overall status. Then provide a more detailed paragraph covering:
- Chief complaint or reason for visit
- Physical examination findings
- Doctor's assessment and clinical impression
- Main decisions or changes made
- Overall prognosis or outlook discussed

Make this section comprehensive but readable, using complete sentences that flow naturally.

2. NEXT STEPS
Format as categorized action items. Group related items together:

MEDICATIONS:
• [Specific prescriptions to pick up, including medication name, dosage, frequency]
• [When to start/stop medications]

APPOINTMENTS:
• [What type of appointment, with whom, timeframe for scheduling]
• [Any prep needed for appointments]

MONITORING:
• [Specific symptoms to watch for]
• [When to call doctor or seek emergency care]
• [How to track progress]

LIFESTYLE:
• [Daily care changes]
• [Dietary or activity modifications]
• [Rest or therapy recommendations]

ADMINISTRATIVE:
• [Insurance authorizations needed]
• [Paperwork to complete]
• [Medical records to obtain]

3. IMPORTANT MENTIONS
Present as highlighted medical points with context:

DIAGNOSIS & ASSESSMENT:
• [Current condition status with brief explanation]
• [Any new diagnoses or rule-outs]

SYMPTOMS DISCUSSED:
• [Patient-reported symptoms and doctor's interpretation]
• [New vs ongoing symptoms]

TEST RESULTS:
• [What was reviewed and key findings]
• [Pending results to follow up on]

TREATMENT CONSIDERATIONS:
• [Options discussed with pros/cons mentioned]
• [Why certain approaches were chosen or rejected]

CLINICAL OBSERVATIONS:
• [Physical exam findings of note]
• [Vital signs or measurements mentioned]
• [Doctor's clinical impressions]

4. OVERALL SENTIMENT
Assess the tone as:
- "positive" if improvements noted, positive test results, or encouraging prognosis discussed
- "concerned" if new problems identified, worsening symptoms, urgent issues, or serious diagnoses mentioned
- "neutral" for routine follow-ups with stable condition, expected post-treatment recovery, or standard monitoring visits

Format your response to clearly separate these sections with the exact headers shown above.`
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    throw new Error('Unexpected response format');
  } catch (error) {
    console.error('Error summarizing transcription:', error);
    throw error;
  }
}

/**
 * Generate a Smart Digest from research findings
 */
// Fallback function for when tools approach fails
async function generateSimpleDigest(
  findings: any[],
  topic: any,
  timeframe: string,
  findingsText: string
) {
  console.log('Falling back to simple digest generation without tools...');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3000,
      temperature: 0.3,
      system: `You are a medical research analyst. Create a structured digest in valid JSON format.

CRITICAL: Return ONLY valid JSON, no markdown, no explanations, just the JSON object.

Required JSON structure:
{
  "executiveSummary": "2-3 sentences with the most critical finding",
  "laymanSummary": "Plain English explanation",
  "themes": [],
  "keyTakeaways": ["array of specific insights"],
  "trends": {
    "emerging": [],
    "declining": [],
    "stable": []
  }
}`,
      messages: [
        {
          role: 'user',
          content: `Analyze these ${findings.length} findings about ${topic.diseaseProfile.name} and return a JSON digest:

${findingsText.substring(0, 8000)}

Remember: Return ONLY valid JSON, nothing else.`
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      // Try to parse the JSON, with multiple attempts to clean it
      let jsonText = content.text.trim();

      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

      // Try to parse
      try {
        const parsed = JSON.parse(jsonText);
        console.log('✓ Simple digest parsed successfully');
        return parsed;
      } catch (e) {
        console.error('Simple digest parse failed:', e);
        // Last resort: return minimal valid structure
        return {
          executiveSummary: 'Analysis completed. See findings for details.',
          laymanSummary: 'Medical research findings have been compiled for your review.',
          themes: [],
          keyTakeaways: [`${findings.length} findings analyzed from ${timeframe} timeframe`],
          trends: { emerging: [], declining: [], stable: [] }
        };
      }
    }
  } catch (error) {
    console.error('Simple digest generation failed:', error);
    throw error;
  }
}

export async function generateSmartDigest(
  findings: any[],
  topic: any,
  timeframe: 'daily' | 'weekly' | 'monthly' | 'all-time'
) {
  console.log(`[AI Service] Starting digest generation with ${findings.length} findings`);
  const startTime = Date.now();

  try {
    // Use smart formatting: first 15 findings with full detail, remaining as compact summaries
    // This uses only ~1.2% of Claude's token capacity (2,400 of 200,000 tokens)
    const fullDetailCount = 15;
    const fullDetailFindings = findings.slice(0, fullDetailCount);
    const compactFindings = findings.slice(fullDetailCount);

    console.log(`[AI Service] Using ALL ${findings.length} findings for digest (${fullDetailFindings.length} full + ${compactFindings.length} compact)`);

    // Prepare findings text with smart formatting — include real UUIDs so AI can reference them
    const fullDetailText = fullDetailFindings.map((f, idx) =>
      `[Finding ${idx + 1}] ID: ${f.id}
Type: ${f.type}
Title: ${f.title}
Summary: ${f.summary?.substring(0, 400) || 'No summary'}
Source: ${f.source?.name || 'Unknown'} (${f.source?.type || 'unknown'})`
    ).join('\n\n');

    const compactText = compactFindings.length > 0
      ? '\n\n[Additional Findings - Compact Format]\n' +
        compactFindings.map((f, idx) =>
          `${fullDetailCount + idx + 1}. ID: ${f.id} — ${f.title} (${f.source?.name || 'Unknown'})`
        ).join('\n')
      : '';

    const findingsText = fullDetailText + compactText;

    console.log(`[AI Service] Calling Anthropic API...`);

    // Using tools to encourage structured output (without beta header for compatibility)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',  // Using Claude Sonnet 4.5 for superior quality
      max_tokens: 8000,
      temperature: 0.3,
      tools: [
        {
          name: 'generate_digest',
          description: 'Generate a structured smart digest from research findings',
          input_schema: digestJSONSchema
        }
      ],
      tool_choice: { type: 'tool', name: 'generate_digest' },
      system: `You are an expert medical research analyst creating ACTIONABLE digests for patients/caregivers managing ${topic.diseaseProfile.name}.

CRITICAL CONTEXT:
- User is actively managing this condition (not just curious)
- They need practical, decision-relevant insights
- They're reading 10+ studies - help them prioritize
- Focus on: What changed? What matters? What's actionable?

YOUR ANALYSIS MUST:
1. Identify the SINGLE most important finding for immediate consideration
2. Extract SPECIFIC actionable insights (dosages, timelines, biomarkers)
3. Flag any safety concerns or contradictions prominently
4. Group findings by practical relevance (not just topic)
5. Provide confidence levels based on study quality, not generic ratings

AVOID:
- Generic summaries like "Research shows promise"
- Vague takeaways like "More research needed"
- Academic language without practical translation
- Missing critical details (sample sizes, effect sizes, patient populations)

Remember: Users trust this digest to make real healthcare decisions. Be specific, be practical, be honest about limitations.

## MAGAZINE EDITORIAL FORMAT (NEW REQUIREMENTS)

You are creating a curated medical research newsletter. Generate content that feels professionally edited.

### FEATURED DISCOVERY
Select the SINGLE most impactful finding as the "hero" content. Prioritize:
1. FDA approvals or major regulatory news
2. Phase 3 trial results
3. Major meta-analyses
4. Breakthrough treatments

For the featured discovery, generate TWO versions:

TECHNICAL VERSION:
- Use proper medical terminology
- Include specific drug names, mechanisms
- Reference trial names and phases
- Use clinical metrics (IGF-1, etc.)

EXPLAINED VERSION:
- Use analogies and metaphors
- Compare to everyday experiences
- Explain medical terms in parentheses
- Make it accessible to non-medical readers

### TOP FINDINGS
Select up to 12 additional notable findings. For EACH:
- Generate both technical and explained versions
- Include the finding ID for traceability
- Create a metadata string: "PubMed • Jan 2026 • Meta-analysis (n=2,847)"

### SOURCE BREAKDOWN
Count findings by type:
- pubmed: Count of academic/research sources
- clinicalTrials: Count of trial registry sources
- fda: Count of FDA sources
- web: Count of news/web sources

### CRITICAL GROUNDING RULES
1. Every findingId MUST be the exact UUID from the "ID:" field in the finding data (e.g., "5c00622b-2343-40d3-ba50-e9d1dc39d865"). NEVER use sequential numbers like "1", "2", "3".
2. NEVER invent statistics, percentages, or study results
3. The EXPLAINED version must contain the SAME FACTS as TECHNICAL
4. If no suitable finding exists for featured discovery, omit the field
5. Include finding IDs in your response for validation`,
      messages: [
        {
          role: 'user',
          content: `Analyze these ${findings.length} research findings from the ${timeframe} timeframe and generate a comprehensive digest.

Disease Context: ${topic.diseaseProfile.name}
Patient Stage: ${topic.patientContext?.currentStage || 'monitoring'}

Research Findings:
${findingsText}

Create a structured digest with:
- Executive summary highlighting the most critical finding with immediate action items
- Layman summary in plain English
- Key takeaways with specific numbers (effect sizes, dosages, patient counts)
- Identify any breakthroughs or paradigm shifts
- Flag any contradictions between findings

MAGAZINE EDITORIAL SECTIONS (REQUIRED):
- featuredDiscovery: The SINGLE most impactful finding as hero content. The findingId MUST be the exact UUID string from the "ID:" field (e.g. "5c00622b-2343-40d3-ba50-e9d1dc39d865"), NOT a number. Include sourceType, technical version (medical terminology), explained version (analogies/metaphors), and sourceMetadata
- topFindings: Up to 12 additional notable findings. Each findingId MUST be the exact UUID from the "ID:" field. Include sourceType, technical version, explained version, and a metadata display string like "PubMed • Jan 2026 • Meta-analysis (n=2,847)"
- sourceBreakdown: Count ALL findings by source type (pubmed, clinicalTrials, fda, web)

Focus on practical, actionable information that helps with treatment decisions.`
        }
      ]
    });

    const responseTime = Date.now() - startTime;
    console.log(`[AI Service] Anthropic API responded in ${responseTime}ms`);

    // When using tools, the response format is different
    console.log('Claude response type:', response.content.map(c => c.type));
    const toolUse = response.content.find(c => c.type === 'tool_use');

    if (!toolUse || toolUse.type !== 'tool_use') {
      console.error('No tool use in response. Full response:', JSON.stringify(response.content, null, 2));
      throw new Error('Expected tool use response from Claude');
    }

    // The tool input already contains our structured data
    let digestData = toolUse.input as any;
    console.log('Tool input keys:', Object.keys(digestData));
    console.log('Raw digest data sample:', JSON.stringify({
      hasExecutiveSummary: !!digestData.executiveSummary,
      hasLaymanSummary: !!digestData.laymanSummary,
      keyTakeawaysCount: digestData.keyTakeaways?.length || 0,
      hasFeaturedDiscovery: !!digestData.featuredDiscovery,
      topFindingsCount: digestData.topFindings?.length || 0,
      hasSourceBreakdown: !!digestData.sourceBreakdown
    }));

    // Validate with Zod schema for type safety
    try {
      const validated = SmartDigestSchema.parse(digestData);
      digestData = validated;
      console.log('✓ Zod validation successful');
    } catch (zodError: any) {
      console.error('Zod validation failed. Error details:', {
        issues: zodError.issues,
        rawDataKeys: Object.keys(digestData),
        sampleTheme: digestData.themes?.[0],
        sampleTrends: digestData.trends
      });

      // Attempt graceful recovery with partial data
      console.log('Attempting graceful recovery with partial data...');

      // Try to use what we have, with defaults for missing fields
      try {
        // Ensure all required fields have at least default values
        const recoveredData = {
          executiveSummary: digestData.executiveSummary || 'Analysis completed. See findings for details.',
          laymanSummary: digestData.laymanSummary || 'Medical research findings have been compiled for your review.',
          keyTakeaways: Array.isArray(digestData.keyTakeaways) ? digestData.keyTakeaways : [],
          breakthroughs: Array.isArray(digestData.breakthroughs) ? digestData.breakthroughs : [],
          contradictions: Array.isArray(digestData.contradictions) ? digestData.contradictions : [],
          // Magazine editorial fields
          featuredDiscovery: digestData.featuredDiscovery || undefined,
          topFindings: Array.isArray(digestData.topFindings) ? digestData.topFindings : [],
          sourceBreakdown: digestData.sourceBreakdown || undefined,
          // Legacy fields (optional, for backward compat)
          themes: Array.isArray(digestData.themes) ? digestData.themes : [],
          trends: { emerging: [], declining: [], stable: [] }
        };

        // Try to validate the recovered data with defaults
        const validated = SmartDigestSchema.parse(recoveredData);
        digestData = validated;
        console.log('✓ Graceful recovery successful with partial data and defaults');
      } catch (recoveryError) {
        console.error('Recovery failed:', recoveryError);
        // Don't throw - continue with minimal data
        digestData = {
          executiveSummary: digestData.executiveSummary || 'Analysis completed.',
          laymanSummary: digestData.laymanSummary || 'Research findings compiled.',
          keyTakeaways: [],
          breakthroughs: [],
          contradictions: [],
          featuredDiscovery: null,
          topFindings: [],
          sourceBreakdown: null,
          themes: [],
          trends: { emerging: [], declining: [], stable: [] }
        };
        console.log('✓ Using minimal fallback data');
      }
    }

    // Generate unique ID for the digest
    const digestId = `digest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Map finding indices back to IDs and calculate statistics
    const allFindingIds = findings.map(f => f.id);
    const totalFindings = findings.length;
    const newFindings = findings.filter(f => f.isNew).length;

    // Calculate unique studies count properly
    const uniqueStudies = new Set();
    findings.forEach(f => {
      // Try to extract unique study identifiers
      if (f.metadata?.doi) {
        uniqueStudies.add(`doi:${f.metadata.doi}`);
      } else if (f.metadata?.pubmedId) {
        uniqueStudies.add(`pmid:${f.metadata.pubmedId}`);
      } else if (f.metadata?.studyId) {
        uniqueStudies.add(`study:${f.metadata.studyId}`);
      } else if (f.metadata?.trialId) {
        uniqueStudies.add(`trial:${f.metadata.trialId}`);
      } else {
        // Fallback: use URL or title+source combo as unique identifier
        uniqueStudies.add(f.url || `${f.source.name}:${f.title.substring(0, 50)}`);
      }
    });

    // Transform breakthroughs and contradictions
    const breakthroughs = digestData.breakthroughs?.map((b: any) => ({
      ...b,
      findingIds: b.findingIndices.map((idx: number) => findings[idx]?.id).filter(Boolean),
      date: Date.now()
    })) || [];

    const contradictions = digestData.contradictions?.map((c: any) => ({
      ...c,
      findingA: {
        id: findings[c.findingA.index]?.id,
        claim: c.findingA.claim,
        source: c.findingA.source
      },
      findingB: {
        id: findings[c.findingB.index]?.id,
        claim: c.findingB.claim,
        source: c.findingB.source
      }
    })) || [];

    // Construct final digest
    return {
      id: digestId,
      topicId: topic.id,
      generatedAt: Date.now(),
      timeframe,
      executiveSummary: digestData.executiveSummary,
      laymanSummary: digestData.laymanSummary,
      keyTakeaways: digestData.keyTakeaways,
      breakthroughs,
      contradictions,
      statistics: {
        totalFindings,
        newFindings,
        sourceCount: uniqueStudies.size
      },
      allFindingIds,
      // Magazine editorial fields
      featuredDiscovery: digestData.featuredDiscovery || null,
      topFindings: digestData.topFindings || [],
      sourceBreakdown: digestData.sourceBreakdown || null,
      // Legacy fields (empty - AI no longer generates these)
      themes: digestData.themes || [],
      trends: digestData.trends || { emerging: [], declining: [], stable: [] }
    };
  } catch (error: any) {
    const errorTime = Date.now() - startTime;
    console.error(`[AI Service] Error after ${errorTime}ms:`, error.message);

    // Check for timeout specifically
    if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT') || errorTime > 30000) {
      console.error('[AI Service] Request timed out - using minimal fallback');
      // Return a minimal valid digest to avoid 504
      return {
        executiveSummary: `Analysis of ${findings.length} recent findings about ${topic.diseaseProfile.name}.`,
        laymanSummary: 'Research findings have been compiled for your review.',
        themes: [{
          name: 'Recent Research',
          keyInsights: [`${findings.length} findings analyzed`],
          findingIds: findings.slice(0, 5).map(f => f.id)
        }],
        keyTakeaways: ['Review individual findings for details'],
        trends: { emerging: [], declining: [], stable: ['Research ongoing'] },
        // NEW magazine editorial fields (null for timeout fallback)
        featuredDiscovery: null,
        topFindings: [],
        sourceBreakdown: null
      };
    }

    // If tools approach fails for other reasons, try the simple approach
    try {
      console.log('Attempting fallback to simple digest...');
      // Re-create findingsText for fallback
      const fallbackFindingsText = findings.slice(0, 5).map((f, idx) =>
        `[Finding ${idx + 1}]
Type: ${f.type}
Title: ${f.title}
Summary: ${f.summary}
Source: ${f.source.name} (${f.source.type})`
      ).join('\n\n───────────\n\n');

      const simpleDigest = await generateSimpleDigest(findings, topic, timeframe, fallbackFindingsText);

      // Generate ID and stats for the simple digest
      const digestId = `digest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const allFindingIds = findings.map(f => f.id);

      return {
        id: digestId,
        topicId: topic.id,
        generatedAt: Date.now(),
        timeframe,
        executiveSummary: simpleDigest.executiveSummary,
        laymanSummary: simpleDigest.laymanSummary,
        themes: simpleDigest.themes || [],
        keyTakeaways: simpleDigest.keyTakeaways || [],
        breakthroughs: simpleDigest.breakthroughs || [],
        contradictions: simpleDigest.contradictions || [],
        trends: simpleDigest.trends || { emerging: [], declining: [], stable: [] },
        statistics: {
          totalFindings: findings.length,
          newFindings: findings.filter(f => f.isNew).length,
          highRelevanceCount: findings.filter(f => f.priority === 'critical' || f.priority === 'high').length,
          sourceCount: new Set(findings.map(f => f.source?.name)).size,
          avgConfidence: 0.5  // Legacy field, no longer based on deprecated confidenceLevel
        },
        topSources: [],
        allFindingIds,
        fallbackUsed: true,  // Flag to indicate fallback was used
        // NEW magazine editorial fields (null for simple digest fallback)
        featuredDiscovery: null,
        topFindings: [],
        sourceBreakdown: null
      };
    } catch (fallbackError) {
      console.error('Both tools and simple approaches failed:', fallbackError);
      throw new Error(`Failed to generate digest: ${error.message}`);
    }
  }
}

// Helper functions for theme categorization
function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    treatment: 'pill',
    mechanism: 'dna',
    trial: 'flask',
    outcome: 'chart',
    diagnostic: 'search',
    prevention: 'shield'
  };
  return icons[category] || 'file';
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    treatment: 'blue',
    mechanism: 'purple',
    trial: 'green',
    outcome: 'orange',
    diagnostic: 'teal',
    prevention: 'indigo'
  };
  return colors[category] || 'gray';
}

// Export aiService object for use in other modules
export const aiService = {
  client: anthropic,
  openai: openai,
  parseSearchQuery,
  summarizeResults,
  transcribeAudio,
  summarizeTranscription,
  generateSmartDigest
};
