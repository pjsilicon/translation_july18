import OpenAI from 'openai';
import { logger } from '../utils/logger';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateTranscription(audioFilePath: string): Promise<string> {
    try {
      const transcription = await this.client.audio.transcriptions.create({
        file: audioFilePath as any, // Will need to convert to fs.ReadStream
        model: 'whisper-1',
      });
      
      return transcription.text;
    } catch (error) {
      logger.error('OpenAI transcription error:', error);
      throw error;
    }
  }

  async generateTranslation(text: string, targetLanguage: string): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text to ${targetLanguage}. Maintain the tone and style of the original text.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      return completion.choices[0].message.content || '';
    } catch (error) {
      logger.error('OpenAI translation error:', error);
      throw error;
    }
  }

  async analyzeContent(text: string): Promise<any> {
    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a content analyzer. Analyze the given text for tone, sentiment, and key themes.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.5,
        max_tokens: 500,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      logger.error('OpenAI content analysis error:', error);
      throw error;
    }
  }
}

export default new OpenAIService();