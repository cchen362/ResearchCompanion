import { Router } from 'express';
import { transcribeAudio, summarizeTranscription } from '../services/ai.service.js';

const router = Router();

/**
 * Transcribe audio and generate summary
 */
router.post('/transcribe', async (req, res) => {
  try {
    const { audio, mimeType } = req.body;

    if (!audio) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Transcribe audio using Whisper
    const transcript = await transcribeAudio(audioBuffer, mimeType || 'audio/webm');

    // Generate summary using Claude
    const summary = await summarizeTranscription(transcript);

    // Helper function to strip markdown formatting
    const stripMarkdown = (text: string): string => {
      return text
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold **text**
        .replace(/__(.*?)__/g, '$1')      // Remove bold __text__
        .replace(/\*(.*?)\*/g, '$1')      // Remove italic *text*
        .replace(/_(.*?)_/g, '$1')        // Remove italic _text_
        .replace(/`(.*?)`/g, '$1')        // Remove code `text`
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links [text](url)
        .replace(/#+\s/g, '')             // Remove headers
        .replace(/\*/g, '')               // Remove any remaining lone asterisks
        .replace(/\s+/g, ' ')             // Normalize whitespace
        .trim();
    };

    // Parse the enhanced medical summary into structured format
    const summaryLines = summary.split('\n');
    const structuredSummary = {
      visitSummary: '',
      nextSteps: [] as string[],
      importantMentions: [] as string[],
      sentiment: 'neutral' as 'positive' | 'neutral' | 'concerned'
    };

    let currentSection = '';
    let collectingContent = false;
    let visitSummaryParagraphs: string[] = [];

    for (const line of summaryLines) {
      const trimmedLine = line.trim();
      const cleanLine = stripMarkdown(trimmedLine);
      const upperLine = trimmedLine.toUpperCase();

      // Check for section headers (more robust matching)
      if (upperLine.includes('VISIT SUMMARY') ||
          (upperLine.startsWith('1.') && upperLine.includes('SUMMARY'))) {
        currentSection = 'visitSummary';
        collectingContent = true;
        continue;
      } else if (upperLine.includes('NEXT STEPS') ||
                 (upperLine.startsWith('2.') && upperLine.includes('STEPS'))) {
        currentSection = 'nextSteps';
        collectingContent = true;
        continue;
      } else if (upperLine.includes('IMPORTANT MENTIONS') ||
                 upperLine.includes('IMPORTANT POINTS') ||
                 (upperLine.startsWith('3.') && upperLine.includes('IMPORTANT'))) {
        currentSection = 'importantMentions';
        collectingContent = true;
        continue;
      } else if (upperLine.includes('OVERALL SENTIMENT') ||
                 upperLine.includes('SENTIMENT') ||
                 (upperLine.startsWith('4.') && upperLine.includes('SENTIMENT'))) {
        currentSection = 'sentiment';
        collectingContent = true;
        continue;
      }

      // Skip empty lines
      if (!trimmedLine) continue;

      // Process content based on current section
      if (collectingContent && currentSection) {
        switch (currentSection) {
          case 'visitSummary':
            // Check if we've reached the next section
            if (trimmedLine.match(/^(2\.|NEXT STEPS)/i)) {
              currentSection = 'nextSteps';
            } else if (cleanLine && !cleanLine.match(/^[A-Z][A-Z\s]+:?$/)) {
              // Collect paragraphs for better formatting
              if (cleanLine.length > 0) {
                visitSummaryParagraphs.push(cleanLine);
              }
            }
            break;

          case 'nextSteps':
            // Check if we've reached the next section
            if (trimmedLine.match(/^(3\.|IMPORTANT)/i)) {
              currentSection = 'importantMentions';
            } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*')) {
              const item = stripMarkdown(trimmedLine.replace(/^[-•*]\s*/, '').trim());
              if (item) structuredSummary.nextSteps.push(item);
            } else if (trimmedLine.match(/^\d+\.\s/)) {
              // Handle numbered lists
              const item = stripMarkdown(trimmedLine.replace(/^\d+\.\s*/, '').trim());
              if (item) structuredSummary.nextSteps.push(item);
            } else if (cleanLine && !trimmedLine.match(/^[A-Z][A-Z\s]+:?$/)) {
              // Sometimes items are not bulleted, add them if they look like action items
              if (cleanLine.length > 10 && !cleanLine.includes(':')) {
                structuredSummary.nextSteps.push(cleanLine);
              }
            }
            break;

          case 'importantMentions':
            // Check if we've reached the next section
            if (trimmedLine.match(/^(4\.|SENTIMENT)/i)) {
              currentSection = 'sentiment';
            } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*')) {
              const item = stripMarkdown(trimmedLine.replace(/^[-•*]\s*/, '').trim());
              if (item) structuredSummary.importantMentions.push(item);
            } else if (trimmedLine.match(/^\d+\.\s/)) {
              // Handle numbered lists
              const item = stripMarkdown(trimmedLine.replace(/^\d+\.\s*/, '').trim());
              if (item) structuredSummary.importantMentions.push(item);
            } else if (cleanLine && !trimmedLine.match(/^[A-Z][A-Z\s]+:?$/)) {
              // Sometimes items are not bulleted
              if (cleanLine.length > 10 && !cleanLine.includes(':')) {
                structuredSummary.importantMentions.push(cleanLine);
              }
            }
            break;

          case 'sentiment':
            const lowerLine = trimmedLine.toLowerCase();
            if (lowerLine.includes('positive') || lowerLine.includes('improvement')) {
              structuredSummary.sentiment = 'positive';
            } else if (lowerLine.includes('concerned') || lowerLine.includes('concern') || lowerLine.includes('urgent')) {
              structuredSummary.sentiment = 'concerned';
            } else if (lowerLine.includes('neutral') || lowerLine.includes('stable') || lowerLine.includes('routine')) {
              structuredSummary.sentiment = 'neutral';
            }
            break;
        }
      }
    }

    // Join the visit summary paragraphs
    structuredSummary.visitSummary = visitSummaryParagraphs.join(' ').trim();

    // Ensure we have at least basic content
    if (!structuredSummary.visitSummary) {
      structuredSummary.visitSummary = 'Visit summary processing in progress. Full transcript available below.';
    }

    // Clean up any remaining markdown in all fields
    structuredSummary.visitSummary = stripMarkdown(structuredSummary.visitSummary);
    structuredSummary.nextSteps = structuredSummary.nextSteps.map(step => stripMarkdown(step));
    structuredSummary.importantMentions = structuredSummary.importantMentions.map(mention => stripMarkdown(mention));

    res.json({
      transcript,
      summary: structuredSummary
    });
  } catch (error) {
    console.error('Error in transcribe:', error);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

export default router;