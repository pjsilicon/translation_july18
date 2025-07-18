import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import whisperService from '../services/whisper.service';
import ffmpegService from '../services/ffmpeg.service';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';
import prisma from '../config/database';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const getOrCreateDefaultProject = async () => {
  let project = await prisma.project.findFirst({
    where: { name: 'Default Project' },
  });

  if (!project) {
    const user = await getOrCreateDefaultUser();
    project = await prisma.project.create({
      data: {
        name: 'Default Project',
        description: 'A default project for all uploaded videos.',
        ownerId: user.id,
      },
    });
  }

  return project;
};

const getOrCreateDefaultUser = async () => {
  let user = await prisma.user.findFirst({
    where: { email: 'default-user@example.com' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'default-user@example.com',
        password: 'password', // This should be hashed in a real application
        name: 'Default User',
      },
    });
  }

  return user;
};

export const uploadVideo = asyncHandler(async (req: MulterRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No video file provided'
    });
  }

  const { title, context, description } = req.body;
  
  try {
    const project = await getOrCreateDefaultProject();
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
        `${path.basename(req.file.path, path.extname(req.file.path))}_thumbnail.jpg`
      );
      await ffmpegService.generateThumbnail(req.file.path, thumbnailPath);
      logger.info('Thumbnail generated', { thumbnailPath });
    } catch (thumbError: any) {
      logger.error('Thumbnail generation failed:', thumbError);
      // Continue without thumbnail
    }

    // Save to database
    const video = await prisma.video.create({
      data: {
        originalUrl: req.file.path,
        thumbnailUrl: thumbnailPath,
        duration: videoInfo.duration,
        metadata: {
          title: title || path.basename(req.file.originalname, path.extname(req.file.originalname)),
          originalFilename: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          width: videoInfo.width,
          height: videoInfo.height,
          fps: videoInfo.fps,
          codec: videoInfo.codec,
          bitrate: videoInfo.bitrate,
          context,
          description,
        },
        projectId: project.id,
      }
    });
    
    logger.info('Video saved to database', { videoId: video.id });

    return res.status(201).json({
      success: true,
      data: {
        videoId: video.id,
        title: (video.metadata as any)?.title,
        duration: video.duration,
        thumbnailUrl: `/api/videos/${video.id}/thumbnail`,
        status: video.status
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
    // Get video from database
    video = await prisma.video.findUnique({ where: { id: videoId } });
    
    if (!video || !fs.existsSync(video.originalUrl)) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    const videoPath = path.resolve(video.originalUrl);

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

    // Save to database
    await prisma.video.update({
      where: { id: videoId },
      data: {
        metadata: {
          ...(video.metadata as any),
          transcription: {
            language: transcriptionResult.language,
            duration: transcriptionResult.duration,
            fullText: transcriptionResult.text,
            segments: formattedSegments,
            createdAt: new Date()
          }
        }
      }
    });

    // Clean up temporary audio files
    await whisperService.cleanupTempFiles(videoPath);

    return res.json({
      success: true,
      data: {
        videoId,
        language: transcriptionResult.language,
        duration: transcriptionResult.duration,
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
      videoPath: video?.originalUrl
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
    // Get video from database
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    
    const transcription = (video?.metadata as any)?.transcription;

    if (!video || !transcription) {
      return res.status(404).json({
        success: false,
        error: 'Transcription not found'
      });
    }

    return res.json({
      success: true,
      data: {
        videoId: video.id,
        language: transcription.language,
        segments: transcription.segments
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
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    const transcription = (video?.metadata as any)?.transcription;

    if (!video || !transcription) {
      return res.status(404).json({
        success: false,
        error: 'Transcription not found'
      });
    }

    const segmentIndex = transcription.segments.findIndex((s: any) => s.id === segmentId);

    if (segmentIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Segment not found'
      });
    }

    transcription.segments[segmentIndex].text = text;

    await prisma.video.update({
      where: { id: videoId },
      data: {
        metadata: {
          ...(video.metadata as any),
          transcription
        }
      }
    });

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
    const video = await prisma.video.findUnique({ where: { id: videoId } });

    if (!video || !video.thumbnailUrl || !fs.existsSync(video.thumbnailUrl)) {
      return res.status(404).json({
        success: false,
        error: 'Thumbnail not found'
      });
    }

    return res.sendFile(path.resolve(video.thumbnailUrl));
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
    const video = await prisma.video.findUnique({ where: { id: videoId } });

    if (video) {
      if (fs.existsSync(video.originalUrl)) {
        await fs.promises.unlink(video.originalUrl);
      }
      if (video.thumbnailUrl && fs.existsSync(video.thumbnailUrl)) {
        await fs.promises.unlink(video.thumbnailUrl);
      }
      await prisma.video.delete({ where: { id: videoId } });
    }
    
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