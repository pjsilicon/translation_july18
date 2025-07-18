import winston from 'winston';
import path from 'path';
import fs from 'fs';
import DailyRotateFile from 'winston-daily-rotate-file';

// Create logs directory if it doesn't exist
const logDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for detailed logging
const detailedFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}] : ${message}`;
  
  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    // Exclude service metadata from individual logs
    const { service, ...rest } = metadata;
    if (Object.keys(rest).length > 0) {
      msg += ` | ${JSON.stringify(rest)}`;
    }
  }
  
  return msg;
});

// Define log format for files
const fileLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  detailedFormat
);

// Define log format for console
const consoleLogFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    if (stack) {
      return `${timestamp} ${level}: ${message}\n${stack}`;
    }
    return `${timestamp} ${level}: ${message}`;
  })
);

// Create transport array
const transports: winston.transport[] = [];

// Console transport
if (process.env.ENABLE_CONSOLE_LOG !== 'false') {
  transports.push(
    new winston.transports.Console({
      format: consoleLogFormat
    })
  );
}

// File transports
if (process.env.ENABLE_FILE_LOG !== 'false') {
  // Daily rotate file for all logs
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: process.env.LOG_MAX_SIZE || '10m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: fileLogFormat
    })
  );

  // Daily rotate file for errors only
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: process.env.LOG_MAX_SIZE || '10m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      level: 'error',
      format: fileLogFormat
    })
  );

  // Separate logs for different components
  const componentLogs = ['api', 'transcription', 'translation', 'audio', 'storage'];
  componentLogs.forEach(component => {
    transports.push(
      new DailyRotateFile({
        filename: path.join(logDir, `${component}-%DATE%.log`),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '5m',
        maxFiles: '7d',
        format: winston.format.combine(
          winston.format((info) => {
            return info.component === component ? info : false;
          })(),
          fileLogFormat
        )
      })
    );
  });
}

// Create the logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'nyc-dubbing-qa' },
  transports
});

// Create specialized loggers for different components
export const apiLogger = logger.child({ component: 'api' });
export const transcriptionLogger = logger.child({ component: 'transcription' });
export const translationLogger = logger.child({ component: 'translation' });
export const audioLogger = logger.child({ component: 'audio' });
export const storageLogger = logger.child({ component: 'storage' });

// Log unhandled errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Utility function for logging API requests
export const logRequest = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  // Log request
  apiLogger.info({
    message: 'Incoming request',
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    apiLogger.info({
      message: 'Request completed',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
};

// Utility function for logging errors with context
export const logError = (error: Error, context: Record<string, any> = {}) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context
  });
};

// Utility function for logging performance metrics
export const logPerformance = (operation: string, startTime: number, metadata: Record<string, any> = {}) => {
  const duration = Date.now() - startTime;
  logger.info({
    message: `Performance: ${operation}`,
    duration: `${duration}ms`,
    ...metadata
  });
};

// Export log levels for reference
export const LogLevels = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  VERBOSE: 'verbose',
  DEBUG: 'debug',
  SILLY: 'silly'
};