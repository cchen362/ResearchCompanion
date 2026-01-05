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

    // Parse the summary into structured format
    const summaryLines = summary.split('\n');
    const structuredSummary = {
      visitSummary: '',
      nextSteps: [] as string[],
      importantMentions: [] as string[],
      sentiment: 'neutral' as string
    };

    let currentSection = '';
    for (const line of summaryLines) {
      if (line.includes('Visit Summary')) {
        currentSection = 'visitSummary';
      } else if (line.includes('Next Steps')) {
        currentSection = 'nextSteps';
      } else if (line.includes('Important Mentions')) {
        currentSection = 'importantMentions';
      } else if (line.includes('Sentiment')) {
        currentSection = 'sentiment';
      } else if (line.trim()) {
        if (currentSection === 'visitSummary') {
          structuredSummary.visitSummary += line.trim() + ' ';
        } else if (currentSection === 'nextSteps') {
          if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
            structuredSummary.nextSteps.push(line.trim().replace(/^[-•]\s*/, ''));
          }
        } else if (currentSection === 'importantMentions') {
          if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
            structuredSummary.importantMentions.push(line.trim().replace(/^[-•]\s*/, ''));
          }
        } else if (currentSection === 'sentiment' && line.trim()) {
          const sentiment = line.toLowerCase();
          if (sentiment.includes('positive')) {
            structuredSummary.sentiment = 'positive';
          } else if (sentiment.includes('concerned')) {
            structuredSummary.sentiment = 'concerned';
          } else {
            structuredSummary.sentiment = 'neutral';
          }
        }
      }
    }

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