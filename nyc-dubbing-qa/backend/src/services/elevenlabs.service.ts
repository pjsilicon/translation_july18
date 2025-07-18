import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { logger } from '../utils/logger';

export class ElevenLabsService {
  private client: ElevenLabsClient;

  constructor() {
    this.client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY!,
    });
  }

  async getVoices() {
    try {
      const voices = await this.client.voices.getAll();
      return voices;
    } catch (error) {
      logger.error('ElevenLabs get voices error:', error);
      throw error;
    }
  }

  async generateSpeech(text: string, voiceId: string): Promise<Buffer> {
    try {
      const response = await this.client.textToSpeech.convert(
        voiceId,
        {
          text: text,
          modelId: 'eleven_monolingual_v1',
        }
      );

      // The response is a ReadableStream<Uint8Array>
      const chunks: Uint8Array[] = [];
      const reader = response.getReader();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      
      return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
    } catch (error) {
      logger.error('ElevenLabs speech generation error:', error);
      throw error;
    }
  }

  async cloneVoice(name: string, description: string, files: Buffer[]): Promise<string> {
    try {
      // Note: This is a placeholder - actual implementation would need proper file handling
      // The actual implementation would use the voice cloning API
      // For now, returning a placeholder voice ID
      logger.warn('Voice cloning not fully implemented - returning placeholder');
      return 'cloned-voice-placeholder';
    } catch (error) {
      logger.error('ElevenLabs voice cloning error:', error);
      throw error;
    }
  }

  async generateDubbing(
    videoPath: string, 
    targetLanguage: string, 
    voiceId?: string
  ): Promise<any> {
    try {
      // This would involve:
      // 1. Extract audio from video
      // 2. Transcribe audio
      // 3. Translate transcript
      // 4. Generate speech in target language
      // 5. Sync with video
      
      // Placeholder for actual implementation
      return {
        dubbedVideoUrl: '',
        dubbedAudioUrl: '',
        transcript: '',
        translation: ''
      };
    } catch (error) {
      logger.error('ElevenLabs dubbing error:', error);
      throw error;
    }
  }
}

export default new ElevenLabsService();