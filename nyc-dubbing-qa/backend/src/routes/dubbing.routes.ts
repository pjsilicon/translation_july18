import { Router } from 'express';
import audioService from '../services/elevenlabs.service';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/dubbing/generate-audio
router.post('/generate-audio', async (req, res) => {
  try {
    const { videoId, segments, voice, language } = req.body;
    
    logger.info('Generating audio for video', { videoId, language, segmentCount: segments.length });
    
    const audioResults = await Promise.all(
      segments.map(async (segment: any) => {
        const audio = await audioService.generateSpeech(segment.text, voice || 'default');
        return {
          segmentId: segment.id,
          audio: audio.toString('base64'),
          startTime: segment.startTime,
          endTime: segment.endTime
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        videoId,
        language,
        segments: audioResults
      }
    });
  } catch (error: any) {
    logger.error('Audio generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate audio'
    });
  }
});

// GET /api/dubbing/:videoId/status
router.get('/:videoId/status', (req, res) => {
  // For now, return a simple status
  res.json({
    success: true,
    data: {
      videoId: req.params.videoId,
      status: 'completed',
      progress: 100
    }
  });
});

// GET /api/dubbing/:videoId/download/:language
router.get('/:videoId/download/:language', (req, res) => {
  // This would normally fetch the generated audio file
  res.json({
    success: true,
    message: 'Download endpoint - audio would be served here'
  });
});

// GET /api/dubbing/voices
router.get('/voices', async (req, res) => {
  try {
    const voices = await audioService.getVoices();
    res.json({
      success: true,
      data: voices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch voices'
    });
  }
});

export default router;