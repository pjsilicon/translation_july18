import { Router } from 'express';
import {
  translateVideo,
  retranslateSegment,
  getSupportedLanguages,
  approveTranslation,
  rejectTranslation,
  batchTranslate
} from '../controllers/translation.controller';

const router = Router();

// Translation endpoints
router.post('/translate', translateVideo);
router.post('/retranslate', retranslateSegment);
router.get('/languages', getSupportedLanguages);

// QA endpoints
router.post('/:videoId/segments/:segmentId/approve', approveTranslation);
router.post('/:videoId/segments/:segmentId/reject', rejectTranslation);

// Batch operations
router.post('/batch', batchTranslate);

export default router;