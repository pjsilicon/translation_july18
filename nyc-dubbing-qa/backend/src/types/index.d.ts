import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
      file?: Express.Multer.File;
      files?: Express.Multer.File[];
    }
  }
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
}

export interface VideoProcessingJob {
  videoId: string;
  projectId: string;
  operations: string[];
}

export interface DubbingJob {
  videoId: string;
  targetLanguage: string;
  voiceId?: string;
  options?: {
    preserveEmotion?: boolean;
    syncLipMovements?: boolean;
  };
}

export interface QAReport {
  projectId: string;
  videoId?: string;
  dubbingId?: string;
  issues: QAIssue[];
  overallRating: number;
  recommendations: string[];
}

export interface QAIssue {
  type: 'audio_sync' | 'translation' | 'quality' | 'timing' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp?: number;
  description: string;
  suggestedFix?: string;
}