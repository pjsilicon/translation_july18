import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import whisperService from '../services/whisper.service';
import ffmpegService from '../services/ffmpeg.service';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { videoStore } from '../services/video-store.service';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export const uploadVideo = asyncHandler(async (req: MulterRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No video file provided'
    });
  }

  const { title, context, description } = req.body;
  const videoId = uuidv4();

  try {
    // Get video info with error handling
    let videoInfo = { duration: 0, width: 0, height: 0, fps: 0, codec: 'unknown', bitrate: 0 };
    let thumbnailPath = '';
    
    try {
      videoInfo = await ffmpegService.getVideoInfo(req.file.path);
      logger.info('Video info retrieved', videoInfo);
    } catch (ffmpegError: any) {
      logger.error('FFmpeg getVideoInfo failed:', ffmpegError);
      // Continue without video info
    }
    
    try {
      thumbnailPath = path.join(
        path.dirname(req.file.path),
        `${videoId}_thumbnail.jpg`
      );
      await ffmpegService.generateThumbnail(req.file.path, thumbnailPath);
      logger.info('Thumbnail generated', { thumbnailPath });
    } catch (thumbError: any) {
      logger.error('Thumbnail generation failed:', thumbError);
      // Continue without thumbnail
    }

    // Save to store
    const videoData = {
      id: videoId,
      title: title || path.basename(req.file.originalname, path.extname(req.file.originalname)),
      originalFilename: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      duration: videoInfo.duration,
      width: videoInfo.width,
      height: videoInfo.height,
      fps: videoInfo.fps,
      codec: videoInfo.codec,
      bitrate: videoInfo.bitrate,
      thumbnailPath,
      context,
      description,
      status: 'uploaded',
      uploadedAt: new Date()
    };
    
    // Save to video store
    videoStore.save(videoData);
    logger.info('Video saved to store', { videoId });

    return res.status(201).json({
      success: true,
      data: {
        videoId,
        title: videoData.title,
        duration: videoData.duration,
        thumbnailUrl: `/api/videos/${videoId}/thumbnail`,
        status: videoData.status
      }
    });
  } catch (error: any) {
    logger.error('Video upload error:', error);
    console.error('Detailed error:', error.message, error.stack);
    // Clean up uploaded file on error
    try {
      await fs.promises.unlink(req.file.path);
    } catch {}
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process video upload'
    });
  }
});

export const transcribeVideo = asyncHandler(async (req: Request, res: Response) => {
  const { videoId } = req.params;
  const { language, prompt } = req.body;
  let video: any;

  try {
    // Get video from store
    video = videoStore.get(videoId);
    
    if (!video || !fs.existsSync(video.filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    const videoPath = path.resolve(video.filePath);

    // Start transcription
    logger.info(`Starting transcription for video ${videoId}`);
    
    // TODO: Queue this as a background job
    const transcriptionResult = await whisperService.transcribeFile(videoPath, {
      language,
      prompt,
      timestamp_granularities: ['segment', 'word']
    });

    // Format segments for UI
    const formattedSegments = whisperService.formatSegmentsForUI(
      transcriptionResult.segments
    );

    // Save to store
    const transcriptionData = {
      videoId,
      language: transcriptionResult.language,
      duration: transcriptionResult.duration,
      fullText: transcriptionResult.text,
      segments: formattedSegments,
      createdAt: new Date()
    };
    
    // Update video with transcription
    videoStore.update(videoId, { transcription: transcriptionData });

    // Clean up temporary audio files
    await whisperService.cleanupTempFiles(videoPath);

    return res.json({
      success: true,
      data: {
        videoId,
        language: transcriptionData.language,
        duration: transcriptionData.duration,
        segmentCount: formattedSegments.length,
        segments: formattedSegments
      }
    });
  } catch (error: any) {
    logger.error('Transcription error:', error);
    console.error('Detailed transcription error:', {
      message: error.message,
      stack: error.stack,
      videoId,
      videoPath: (video as any)?.filePath
    });
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to transcribe video'
    });
  }
});

export const getTranscription = asyncHandler(async (req: Request, res: Response) => {
  const { videoId } = req.params;

  try {
    // Get video from store
    const video = videoStore.get(videoId);
    
    if (!video || !video.transcription) {
      return res.status(404).json({
        success: false,
        error: 'Transcription not found'
      });
    }

    return res.json({
      success: true,
      data: {
        videoId: video.transcription.videoId,
        language: video.transcription.language,
        segments: video.transcription.segments
      }
    });
  } catch (error) {
    logger.error('Get transcription error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get transcription'
    });
  }
});

export const updateSegment = asyncHandler(async (req: Request, res: Response) => {
  const { videoId, segmentId } = req.params;
  const { text } = req.body;

  try {
    // TODO: Update in database
    logger.info(`Updating segment ${segmentId} for video ${videoId}`);

    return res.json({
      success: true,
      data: {
        segmentId,
        text,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('Update segment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update segment'
    });
  }
});

export const getVideoThumbnail = asyncHandler(async (req: Request, res: Response) => {
  const { videoId } = req.params;

  try {
    // TODO: Get thumbnail path from database
    const thumbnailPath = path.join(
      process.env.UPLOAD_DIR || './uploads',
      `${videoId}_thumbnail.jpg`
    );

    if (!fs.existsSync(thumbnailPath)) {
      return res.status(404).json({
        success: false,
        error: 'Thumbnail not found'
      });
    }

    return res.sendFile(thumbnailPath);
  } catch (error) {
    logger.error('Get thumbnail error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get thumbnail'
    });
  }
});

export const deleteVideo = asyncHandler(async (req: Request, res: Response) => {
  const { videoId } = req.params;

  try {
    // TODO: Get video info from database
    // TODO: Delete video file, thumbnail, and all related data
    
    logger.info(`Deleted video ${videoId}`);

    return res.json({
      success: true,
      message: 'Video deleted successfully'
    });
  } catch (error) {
    logger.error('Delete video error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete video'
    });
  }
});