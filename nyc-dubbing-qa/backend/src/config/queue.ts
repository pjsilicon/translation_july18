import Bull from 'bull';
import { logger } from '../utils/logger';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

// Create queues
export const videoProcessingQueue = new Bull('video-processing', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const dubbingQueue = new Bull('dubbing', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const reportGenerationQueue = new Bull('report-generation', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Queue event handlers
videoProcessingQueue.on('completed', (job) => {
  logger.info(`Video processing job ${job.id} completed`);
});

videoProcessingQueue.on('failed', (job, err) => {
  logger.error(`Video processing job ${job.id} failed:`, err);
});

dubbingQueue.on('completed', (job) => {
  logger.info(`Dubbing job ${job.id} completed`);
});

dubbingQueue.on('failed', (job, err) => {
  logger.error(`Dubbing job ${job.id} failed:`, err);
});

reportGenerationQueue.on('completed', (job) => {
  logger.info(`Report generation job ${job.id} completed`);
});

reportGenerationQueue.on('failed', (job, err) => {
  logger.error(`Report generation job ${job.id} failed:`, err);
});