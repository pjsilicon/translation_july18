import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import translationService from '../services/translation.service';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middlewares/auth';

export const translateVideo = asyncHandler(async (req: Request, res: Response) => {
  const { videoId } = req.params;
  const { targetLanguage, context, segments } = req.body;

  try {
    if (!targetLanguage || !segments || !Array.isArray(segments)) {
      return res.status(400).json({
        success: false,
        error: 'Target language and segments are required'
      });
    }

    logger.info(`Starting translation for video ${videoId} to ${targetLanguage}`);

    // Prepare segments for translation
    const translationSegments = segments.map((seg: any) => ({
      id: seg.id,
      text: seg.text,
      startTime: seg.startTime,
      endTime: seg.endTime
    }));

    // Translate with dual models
    const translations = await translationService.translateWithContext(
      translationSegments,
      targetLanguage,
      context || {}
    );

    // Format response
    const formattedTranslations = translations.map((trans, index) => ({
      id: segments[index].id,
      originalText: segments[index].text,
      translatedText: trans.text,
      confidence: trans.confidence,
      primaryModel: trans.primaryModel,
      comparisonScore: trans.comparisonScore,
      qaStatus: trans.confidence > 0.9 ? 'approved' : 
                trans.confidence > 0.8 ? 'needs-review' : 'flagged',
      metadata: {
        models: {
          gpt4: trans.metadata.gpt4Result.translatedText,
          gemini: trans.metadata.geminiResult.translatedText
        },
        mergeStrategy: trans.metadata.mergeStrategy,
        estimatedDuration: trans.metadata.gpt4Result.metadata?.estimatedDuration
      }
    }));

    // TODO: Save translations to database

    return res.json({
      success: true,
      data: {
        videoId,
        targetLanguage,
        segmentCount: formattedTranslations.length,
        translations: formattedTranslations,
        overallConfidence: 
          formattedTranslations.reduce((acc, t) => acc + t.confidence, 0) / 
          formattedTranslations.length
      }
    });
  } catch (error) {
    logger.error('Translation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to translate video segments'
    });
  }
});

export const retranslateSegment = asyncHandler(async (req: Request, res: Response) => {
  const { videoId, segmentId } = req.params;
  const { targetLanguage, context, originalText } = req.body;

  try {
    if (!targetLanguage || !originalText) {
      return res.status(400).json({
        success: false,
        error: 'Target language and original text are required'
      });
    }

    logger.info(`Retranslating segment ${segmentId} for video ${videoId}`);

    // Retranslate single segment
    const [translation] = await translationService.translateWithContext(
      [{
        id: parseInt(segmentId),
        text: originalText,
        startTime: 0,
        endTime: 5 // Default, should come from DB
      }],
      targetLanguage,
      context || {}
    );

    return res.json({
      success: true,
      data: {
        segmentId,
        translatedText: translation.text,
        confidence: translation.confidence,
        primaryModel: translation.primaryModel,
        models: {
          gpt4: translation.metadata.gpt4Result.translatedText,
          gemini: translation.metadata.geminiResult.translatedText
        }
      }
    });
  } catch (error) {
    logger.error('Retranslation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retranslate segment'
    });
  }
});

export const getSupportedLanguages = asyncHandler(async (req: Request, res: Response) => {
  const languages = translationService.getSupportedLanguages();
  
  return res.json({
    success: true,
    data: languages
  });
});

export const approveTranslation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { videoId, segmentId } = req.params;
  const { approvedText, reviewerNotes } = req.body;

  try {
    // TODO: Update translation in database
    logger.info(`Translation approved for segment ${segmentId} of video ${videoId}`);

    return res.json({
      success: true,
      data: {
        segmentId,
        status: 'approved',
        approvedText,
        approvedAt: new Date(),
        approvedBy: req.user?.id // From auth middleware
      }
    });
  } catch (error) {
    logger.error('Approval error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to approve translation'
    });
  }
});

export const rejectTranslation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { videoId, segmentId } = req.params;
  const { reason, suggestedText } = req.body;

  try {
    // TODO: Update translation in database
    logger.info(`Translation rejected for segment ${segmentId} of video ${videoId}`);

    return res.json({
      success: true,
      data: {
        segmentId,
        status: 'rejected',
        reason,
        suggestedText,
        rejectedAt: new Date(),
        rejectedBy: req.user?.id
      }
    });
  } catch (error) {
    logger.error('Rejection error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reject translation'
    });
  }
});

export const batchTranslate = asyncHandler(async (req: Request, res: Response) => {
  const { videoIds, targetLanguages } = req.body;

  try {
    if (!Array.isArray(videoIds) || !Array.isArray(targetLanguages)) {
      return res.status(400).json({
        success: false,
        error: 'Video IDs and target languages must be arrays'
      });
    }

    // TODO: Implement batch translation logic
    // This would queue translation jobs for multiple videos and languages

    return res.json({
      success: true,
      data: {
        jobId: 'batch_' + Date.now(),
        videoCount: videoIds.length,
        languageCount: targetLanguages.length,
        status: 'queued',
        estimatedCompletion: new Date(Date.now() + 3600000) // 1 hour estimate
      }
    });
  } catch (error) {
    logger.error('Batch translation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start batch translation'
    });
  }
});