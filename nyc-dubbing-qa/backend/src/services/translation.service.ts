import OpenAI from 'openai';
import { translationLogger as logger, logPerformance } from '../utils/logger';

interface TranslationContext {
  speaker?: string;
  tone?: string;
  domain?: string;
  description?: string;
  previousSegments?: string[];
}

interface TranslationSegment {
  id: number;
  text: string;
  startTime: number;
  endTime: number;
}

interface TranslationResult {
  translatedText: string;
  confidence: number;
  model: string;
  metadata?: {
    wordCount: number;
    estimatedDuration?: number;
    warnings?: string[];
  };
}

interface MergedTranslation {
  text: string;
  confidence: number;
  primaryModel: string;
  comparisonScore: number;
  metadata: {
    gpt4Result: TranslationResult;
    geminiResult: TranslationResult;
    mergeStrategy: string;
  };
}

export class TranslationService {
  private openai: OpenAI;
  private languageMap: Record<string, string> = {
    es: 'Spanish',
    zh: 'Chinese (Mandarin)',
    ru: 'Russian',
    bn: 'Bengali',
    ht: 'Haitian Creole',
    ko: 'Korean',
    ar: 'Arabic',
    ur: 'Urdu',
    fr: 'French',
    pl: 'Polish'
  };

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    logger.info('TranslationService initialized', {
      openAIConfigured: !!process.env.OPENAI_API_KEY,
      supportedLanguages: Object.keys(this.languageMap).length
    });
  }

  /**
   * Translate with context using two OpenAI models for comparison
   */
  async translateWithContext(
    segments: TranslationSegment[],
    targetLanguageCode: string,
    context: TranslationContext
  ): Promise<MergedTranslation[]> {
    const startTime = Date.now();
    const targetLanguage = this.languageMap[targetLanguageCode] || targetLanguageCode;
    const contextPrompt = this.buildContextPrompt(context, targetLanguage);

    logger.info('Starting dual-model translation', {
      targetLanguageCode,
      targetLanguage,
      segmentCount: segments.length,
      totalDuration: segments.reduce((acc, seg) => acc + (seg.endTime - seg.startTime), 0).toFixed(2),
      context: {
        speaker: context.speaker || 'Not specified',
        tone: context.tone || 'Default',
        domain: context.domain || 'General'
      }
    });

    const results: MergedTranslation[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const segment of segments) {
      const segmentStartTime = Date.now();
      try {
        logger.debug('Translating segment', {
          segmentId: segment.id,
          originalText: segment.text.substring(0, 100) + (segment.text.length > 100 ? '...' : ''),
          duration: (segment.endTime - segment.startTime).toFixed(2)
        });
        
        // Translate with both models in parallel
        const [gpt4Result, gpt4TurboResult] = await Promise.all([
          this.translateWithGPT4(segment, targetLanguage, contextPrompt),
          this.translateWithGPT4Turbo(segment, targetLanguage, contextPrompt)
        ]);

        // Merge and evaluate translations
        const merged = await this.mergeTranslations(
          segment,
          gpt4Result,
          gpt4TurboResult,
          targetLanguage
        );

        results.push(merged);
        successCount++;
        
        logger.debug('Segment translation completed', {
          segmentId: segment.id,
          confidence: merged.confidence,
          primaryModel: merged.primaryModel,
          mergeStrategy: merged.metadata.mergeStrategy,
          duration: `${Date.now() - segmentStartTime}ms`
        });
      } catch (error) {
        errorCount++;
        logger.error('Translation failed for segment', {
          segmentId: segment.id,
          error: error instanceof Error ? error.message : String(error),
          originalText: segment.text.substring(0, 50) + '...',
          duration: `${Date.now() - segmentStartTime}ms`
        });
        throw error;
      }
    }

    logPerformance('translate_with_context', startTime, {
      targetLanguage,
      totalSegments: segments.length,
      successCount,
      errorCount,
      averageConfidence: (results.reduce((acc, r) => acc + r.confidence, 0) / results.length).toFixed(3)
    });

    return results;
  }

  /**
   * Build context prompt for translation
   */
  private buildContextPrompt(context: TranslationContext, targetLanguage: string): string {
    return `You are translating official NYC government communications.

Context:
- Speaker: ${context.speaker || 'NYC Government Official'}
- Tone: ${context.tone || 'Formal, professional, authoritative'}
- Domain: ${context.domain || 'Government/Public Service'}
- Description: ${context.description || 'Official NYC government video content'}

Requirements for ${targetLanguage} translation:
1. Maintain formal government communication tone
2. Preserve all technical terms, numbers, dates, and proper nouns accurately
3. Ensure cultural appropriateness for NYC's diverse ${targetLanguage}-speaking population
4. Keep translation length similar to original (±10%) for dubbing synchronization
5. Use standard ${targetLanguage} dialect commonly understood in NYC
6. Maintain the speaker's authority and professionalism
7. Do not add explanations or clarifications not present in the original

Special considerations:
- NYC-specific terms (borough names, department names) should be kept in English or use official translations
- Legal and technical terminology must be precisely translated
- Emergency or safety information must be clear and unambiguous`;
  }

  /**
   * Translate with GPT-4
   */
  private async translateWithGPT4(
    segment: TranslationSegment,
    targetLanguage: string,
    contextPrompt: string
  ): Promise<TranslationResult> {
    const startTime = Date.now();
    try {
      logger.debug('Sending segment to GPT-4', {
        segmentId: segment.id,
        targetLanguage,
        originalLength: segment.text.length,
        originalWords: segment.text.split(/\s+/).length
      });
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: contextPrompt
          },
          {
            role: 'user',
            content: `Translate the following segment to ${targetLanguage}. The segment duration is ${(segment.endTime - segment.startTime).toFixed(1)} seconds.

Original text: "${segment.text}"

Provide only the translation, no explanations.`
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const translatedText = completion.choices[0].message.content?.trim() || '';
      const wordCount = translatedText.split(/\s+/).length;
      const estimatedDuration = this.estimateDuration(translatedText, targetLanguage);
      
      logger.debug('GPT-4 translation completed', {
        segmentId: segment.id,
        translatedLength: translatedText.length,
        translatedWords: wordCount,
        estimatedDuration: estimatedDuration.toFixed(2),
        apiDuration: `${Date.now() - startTime}ms`,
        usageTokens: completion.usage?.total_tokens
      });

      return {
        translatedText,
        confidence: 0.9, // Base confidence for GPT-4
        model: 'gpt-4',
        metadata: {
          wordCount,
          estimatedDuration
        }
      };
    } catch (error) {
      logger.error('GPT-4 translation failed', {
        segmentId: segment.id,
        error: error instanceof Error ? error.message : String(error),
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  /**
   * Translate with GPT-4-turbo
   */
  private async translateWithGPT4Turbo(
    segment: TranslationSegment,
    targetLanguage: string,
    contextPrompt: string
  ): Promise<TranslationResult> {
    const startTime = Date.now();
    try {
      logger.debug('Sending segment to GPT-4-turbo', {
        segmentId: segment.id,
        targetLanguage,
        originalLength: segment.text.length,
        originalWords: segment.text.split(/\s+/).length
      });
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: contextPrompt
          },
          {
            role: 'user',
            content: `Translate the following segment to ${targetLanguage}. The segment duration is ${(segment.endTime - segment.startTime).toFixed(1)} seconds.

Original text: "${segment.text}"

Provide only the translation, no explanations.`
          }
        ],
        temperature: 0.5, // Slightly higher temperature for variation
        max_tokens: 500,
      });

      const translatedText = completion.choices[0].message.content?.trim() || '';
      const wordCount = translatedText.split(/\s+/).length;
      const estimatedDuration = this.estimateDuration(translatedText, targetLanguage);
      
      logger.debug('GPT-4-turbo translation completed', {
        segmentId: segment.id,
        translatedLength: translatedText.length,
        translatedWords: wordCount,
        estimatedDuration: estimatedDuration.toFixed(2),
        apiDuration: `${Date.now() - startTime}ms`,
        usageTokens: completion.usage?.total_tokens
      });

      return {
        translatedText,
        confidence: 0.85, // Base confidence for GPT-4-turbo
        model: 'gpt-4-turbo',
        metadata: {
          wordCount,
          estimatedDuration
        }
      };
    } catch (error) {
      logger.error('GPT-4-turbo translation failed', {
        segmentId: segment.id,
        error: error instanceof Error ? error.message : String(error),
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  /**
   * Merge translations from both models
   */
  private async mergeTranslations(
    segment: TranslationSegment,
    gpt4Result: TranslationResult,
    gpt4TurboResult: TranslationResult,
    targetLanguage: string
  ): Promise<MergedTranslation> {
    const startTime = Date.now();
    
    // Calculate similarity between translations
    const similarity = this.calculateSimilarity(
      gpt4Result.translatedText,
      gpt4TurboResult.translatedText
    );
    
    logger.debug('Comparing translations', {
      segmentId: segment.id,
      similarity: similarity.toFixed(3),
      gpt4Words: gpt4Result.metadata?.wordCount,
      gpt4TurboWords: gpt4TurboResult.metadata?.wordCount,
      lengthDifference: Math.abs(gpt4Result.translatedText.length - gpt4TurboResult.translatedText.length)
    });

    // Determine which translation to use
    let finalTranslation: string;
    let primaryModel: string;
    let confidence: number;
    let mergeStrategy: string;

    if (similarity > 0.9) {
      // Very similar - use GPT-4 as primary
      finalTranslation = gpt4Result.translatedText;
      primaryModel = 'gpt-4';
      confidence = 0.95;
      mergeStrategy = 'high_agreement';
      
      logger.debug('High agreement between models', {
        segmentId: segment.id,
        similarity: similarity.toFixed(3)
      });
    } else if (similarity > 0.7) {
      // Moderate similarity - verify and potentially merge
      logger.debug('Moderate agreement, verifying translation', {
        segmentId: segment.id,
        similarity: similarity.toFixed(3)
      });
      
      const verification = await this.verifyTranslation(
        segment.text,
        gpt4Result.translatedText,
        gpt4TurboResult.translatedText,
        targetLanguage
      );
      
      finalTranslation = verification.preferredTranslation;
      primaryModel = verification.preferredModel;
      confidence = verification.confidence;
      mergeStrategy = 'verified_selection';
    } else {
      // Low similarity - needs human review
      // Default to GPT-4 but flag for review
      finalTranslation = gpt4Result.translatedText;
      primaryModel = 'gpt-4';
      confidence = 0.7;
      mergeStrategy = 'low_agreement_flagged';
      
      logger.warn('Low agreement between models, flagged for review', {
        segmentId: segment.id,
        similarity: similarity.toFixed(3),
        originalText: segment.text.substring(0, 100) + '...',
        gpt4Translation: gpt4Result.translatedText.substring(0, 100) + '...',
        gpt4TurboTranslation: gpt4TurboResult.translatedText.substring(0, 100) + '...'
      });
    }
    
    logger.debug('Translation merge completed', {
      segmentId: segment.id,
      primaryModel,
      confidence: confidence.toFixed(3),
      mergeStrategy,
      duration: `${Date.now() - startTime}ms`
    });

    return {
      text: finalTranslation,
      confidence,
      primaryModel,
      comparisonScore: similarity,
      metadata: {
        gpt4Result,
        geminiResult: gpt4TurboResult, // Keep the same property name for compatibility
        mergeStrategy
      }
    };
  }

  /**
   * Verify translation when models disagree
   */
  private async verifyTranslation(
    originalText: string,
    gpt4Translation: string,
    gpt4TurboTranslation: string,
    targetLanguage: string
  ): Promise<{
    preferredTranslation: string;
    preferredModel: string;
    confidence: number;
  }> {
    const startTime = Date.now();
    try {
      logger.debug('Verifying translation quality', {
        targetLanguage,
        originalLength: originalText.length,
        gpt4Length: gpt4Translation.length,
        gpt4TurboLength: gpt4TurboTranslation.length
      });
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are a professional translation quality assessor for NYC government content. Compare two translations and select the better one.`
          },
          {
            role: 'user',
            content: `Original English: "${originalText}"
            
Translation A: "${gpt4Translation}"
Translation B: "${gpt4TurboTranslation}"

Target language: ${targetLanguage}

Which translation better preserves meaning, tone, and timing for video dubbing? Consider:
1. Accuracy of meaning
2. Natural flow in ${targetLanguage}
3. Appropriate formality for government communication
4. Similar length to original for dubbing

Respond with only "A" or "B".`
          }
        ],
        temperature: 0,
        max_tokens: 10,
      });

      const choice = completion.choices[0].message.content?.trim().toUpperCase();
      
      logger.debug('Verification completed', {
        choice,
        duration: `${Date.now() - startTime}ms`
      });
      
      if (choice === 'A') {
        return {
          preferredTranslation: gpt4Translation,
          preferredModel: 'gpt-4',
          confidence: 0.85
        };
      } else {
        return {
          preferredTranslation: gpt4TurboTranslation,
          preferredModel: 'gpt-4-turbo',
          confidence: 0.85
        };
      }
    } catch (error) {
      logger.error('Translation verification failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: `${Date.now() - startTime}ms`
      });
      // Default to GPT-4 on error
      return {
        preferredTranslation: gpt4Translation,
        preferredModel: 'gpt-4',
        confidence: 0.75
      };
    }
  }

  /**
   * Calculate similarity between two translations
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // Simple word-based similarity (can be improved with better algorithms)
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Estimate duration for translated text
   */
  private estimateDuration(text: string, language: string): number {
    // Average speaking rates (words per minute) by language
    const speechRates: Record<string, number> = {
      Spanish: 180,
      Chinese: 160,
      Russian: 184,
      Bengali: 170,
      'Haitian Creole': 175,
      Korean: 170,
      Arabic: 165,
      Urdu: 170,
      French: 195,
      Polish: 190
    };

    const wordsPerMinute = speechRates[language] || 175;
    const wordCount = text.split(/\s+/).length;
    
    return (wordCount / wordsPerMinute) * 60; // Return in seconds
  }

  /**
   * Batch translate multiple segments
   */
  async batchTranslate(
    segments: TranslationSegment[],
    targetLanguageCode: string,
    context: TranslationContext
  ): Promise<MergedTranslation[]> {
    const startTime = Date.now();
    const batchSize = 5; // Process 5 segments at a time
    const results: MergedTranslation[] = [];
    const totalBatches = Math.ceil(segments.length / batchSize);
    
    logger.info('Starting batch translation', {
      totalSegments: segments.length,
      batchSize,
      totalBatches,
      targetLanguageCode,
      targetLanguage: this.languageMap[targetLanguageCode] || targetLanguageCode
    });

    for (let i = 0; i < segments.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batch = segments.slice(i, i + batchSize);
      
      logger.debug(`Processing batch ${batchNumber}/${totalBatches}`, {
        batchSize: batch.length,
        startSegmentId: batch[0].id,
        endSegmentId: batch[batch.length - 1].id
      });
      
      const batchResults = await this.translateWithContext(
        batch,
        targetLanguageCode,
        context
      );
      results.push(...batchResults);
      
      logger.debug(`Batch ${batchNumber}/${totalBatches} completed`, {
        segmentsTranslated: batchResults.length,
        averageConfidence: (batchResults.reduce((acc, r) => acc + r.confidence, 0) / batchResults.length).toFixed(3)
      });
    }
    
    logPerformance('batch_translate', startTime, {
      totalSegments: segments.length,
      totalBatches,
      averageConfidence: (results.reduce((acc, r) => acc + r.confidence, 0) / results.length).toFixed(3),
      lowConfidenceCount: results.filter(r => r.confidence < 0.8).length
    });

    return results;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): Array<{ code: string; name: string }> {
    return Object.entries(this.languageMap).map(([code, name]) => ({
      code,
      name
    }));
  }
}

export default new TranslationService();