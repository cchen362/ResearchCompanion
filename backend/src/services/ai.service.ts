import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// Initialize API clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
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
      model: 'claude-3-haiku-20240307', // Using Haiku for cost efficiency
      max_tokens: 500,
      temperature: 0.3,
      system: `You are a health research query parser for a personal medical research assistant app.
Your job is to extract structured intent from natural language queries about health topics.

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
6. Capture temporal and demographic modifiers`,
      messages: [
        {
          role: 'user',
          content: query
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return JSON.parse(content.text);
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
    const resultsText = searchResults.map(r =>
      `Source: ${r.title}\nURL: ${r.url}\nContent: ${r.snippet || r.description}`
    ).join('\n\n');

    const systemPrompt = context
      ? `You are a medical research assistant. Summarize the following search results, focusing on what's NEW or DIFFERENT from the previous context.
Previous context: ${context}`
      : `You are a medical research assistant. Summarize the following search results into clear, organized sections.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
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
    throw error;
  }
}

/**
 * Transcribe audio using OpenAI Whisper
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string) {
  try {
    // Convert buffer to File object for OpenAI API
    const file = new File([audioBuffer], 'audio.webm', { type: mimeType });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'en'
    });

    return transcription.text;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}

/**
 * Summarize transcribed text using Claude
 */
export async function summarizeTranscription(transcript: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      temperature: 0.3,
      system: `You are a medical documentation assistant. Summarize doctor visit transcripts into structured, actionable information.`,
      messages: [
        {
          role: 'user',
          content: `Summarize this medical visit transcript:

${transcript}

Provide:
1. Visit Summary (main topics discussed)
2. Next Steps (action items, follow-ups)
3. Important Mentions (medications, symptoms, concerns)
4. Overall Sentiment (positive, neutral, concerned)`
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