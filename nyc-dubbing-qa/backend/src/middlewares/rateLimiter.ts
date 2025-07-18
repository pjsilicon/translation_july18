import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { AppError } from './errorHandler';

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  enableOfflineQueue: false,
});

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'middleware',
  points: parseInt(process.env.RATE_LIMIT_MAX || '100'), // Number of requests
  duration: parseInt(process.env.RATE_LIMIT_WINDOW || '900000') / 1000, // Per 15 minutes by default
});

export const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await rateLimiter.consume(req.ip || 'unknown');
    next();
  } catch (rejRes: any) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.set('X-RateLimit-Limit', String(rateLimiter.points));
    res.set('X-RateLimit-Remaining', String(rejRes.remainingPoints));
    res.set('X-RateLimit-Reset', new Date(Date.now() + rejRes.msBeforeNext).toISOString());
    
    next(new AppError('Too many requests', 429));
  }
};