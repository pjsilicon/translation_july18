import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import { 
  uploadVideo, 
  transcribeVideo, 
  getTranscription,
  updateSegment,
  getVideoThumbnail,
  deleteVideo
} from '../controllers/video.controller';

const router = Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'application/octet-stream'];
    const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only MP4, MOV, AVI, and MKV are allowed. Received: ${file.mimetype}`));
    }
  }
});

// Video upload
router.post('/upload', upload.single('video'), uploadVideo);

// Transcription
router.post('/:videoId/transcribe', transcribeVideo);
router.get('/:videoId/transcription', getTranscription);
router.put('/:videoId/transcription/segments/:segmentId', updateSegment);

// Thumbnail
router.get('/:videoId/thumbnail', getVideoThumbnail);

// Delete video
router.delete('/:videoId', deleteVideo);

export default router;