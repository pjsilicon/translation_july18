import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { storageLogger as logger, logPerformance } from '../utils/logger';
import crypto from 'crypto';

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const rename = promisify(fs.rename);
const copyFile = promisify(fs.copyFile);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

export interface StorageFile {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  url: string;
}

export interface StorageOptions {
  preserveOriginalName?: boolean;
  subfolder?: string;
  generateThumbnail?: boolean;
}

export class LocalStorageService {
  private basePath: string;
  private paths: {
    videos: string;
    audio: string;
    thumbnails: string;
    temp: string;
  };

  constructor() {
    this.basePath = process.env.LOCAL_STORAGE_PATH || './storage';
    this.paths = {
      videos: process.env.VIDEO_STORAGE_PATH || path.join(this.basePath, 'videos'),
      audio: process.env.AUDIO_STORAGE_PATH || path.join(this.basePath, 'audio'),
      thumbnails: process.env.THUMBNAIL_STORAGE_PATH || path.join(this.basePath, 'thumbnails'),
      temp: process.env.TEMP_STORAGE_PATH || path.join(this.basePath, 'temp')
    };
    
    logger.info('LocalStorageService initializing', {
      basePath: this.basePath,
      paths: this.paths
    });

    this.initializeDirectories();
  }

  /**
   * Initialize storage directories
   */
  private async initializeDirectories(): Promise<void> {
    const startTime = Date.now();
    try {
      for (const [type, dirPath] of Object.entries(this.paths)) {
        const exists = await this.ensureDirectoryExists(dirPath);
        logger.info('Storage directory initialized', {
          type,
          path: dirPath,
          created: !exists
        });
      }
      
      logger.info('All storage directories initialized', {
        duration: `${Date.now() - startTime}ms`
      });
    } catch (error) {
      logger.error('Failed to initialize storage directories', {
        error: error instanceof Error ? error.message : String(error),
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<boolean> {
    try {
      await stat(dirPath);
      return true; // Directory already exists
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        await mkdir(dirPath, { recursive: true });
        logger.debug('Created directory', { path: dirPath });
        return false; // Directory was created
      } else {
        throw error;
      }
    }
  }

  /**
   * Generate unique filename
   */
  private generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    return `${nameWithoutExt}_${timestamp}_${uniqueId}${ext}`;
  }

  /**
   * Store video file
   */
  async storeVideo(
    filePath: string,
    originalName: string,
    options: StorageOptions = {}
  ): Promise<StorageFile> {
    const startTime = Date.now();
    const sourceStats = await stat(filePath);
    
    logger.info('Storing video file', {
      originalName,
      sourceSize: this.formatBytes(sourceStats.size),
      preserveOriginalName: options.preserveOriginalName || false,
      subfolder: options.subfolder || 'root'
    });
    
    try {
      const filename = options.preserveOriginalName 
        ? originalName 
        : this.generateUniqueFilename(originalName);
      
      const subfolder = options.subfolder 
        ? path.join(this.paths.videos, options.subfolder)
        : this.paths.videos;
      
      await this.ensureDirectoryExists(subfolder);
      
      const destPath = path.join(subfolder, filename);
      await copyFile(filePath, destPath);
      
      const stats = await stat(destPath);
      const fileId = crypto.randomBytes(16).toString('hex');
      
      const storageFile: StorageFile = {
        id: fileId,
        originalName,
        filename,
        path: destPath,
        size: stats.size,
        mimeType: this.getMimeType(filename),
        uploadedAt: new Date(),
        url: `/storage/videos/${filename}`
      };
      
      logPerformance('store_video', startTime, {
        fileId,
        filename,
        size: this.formatBytes(stats.size),
        mimeType: storageFile.mimeType
      });
      
      return storageFile;
    } catch (error) {
      logger.error('Failed to store video', {
        error: error instanceof Error ? error.message : String(error),
        originalName,
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  /**
   * Store audio file
   */
  async storeAudio(
    filePath: string,
    originalName: string,
    metadata?: Record<string, any>
  ): Promise<StorageFile> {
    const startTime = Date.now();
    const sourceStats = await stat(filePath);
    
    logger.info('Storing audio file', {
      originalName,
      sourceSize: this.formatBytes(sourceStats.size),
      hasMetadata: !!metadata
    });
    
    try {
      const filename = this.generateUniqueFilename(originalName);
      const destPath = path.join(this.paths.audio, filename);
      
      await copyFile(filePath, destPath);
      
      const stats = await stat(destPath);
      const fileId = crypto.randomBytes(16).toString('hex');
      
      // Store metadata if provided
      if (metadata) {
        const metadataPath = destPath + '.json';
        await fs.promises.writeFile(
          metadataPath, 
          JSON.stringify(metadata, null, 2)
        );
        const metadataStats = await stat(metadataPath);
        logger.debug('Audio metadata saved', {
          metadataPath,
          metadataSize: this.formatBytes(metadataStats.size),
          metadataKeys: Object.keys(metadata)
        });
      }
      
      const storageFile: StorageFile = {
        id: fileId,
        originalName,
        filename,
        path: destPath,
        size: stats.size,
        mimeType: this.getMimeType(filename),
        uploadedAt: new Date(),
        url: `/storage/audio/${filename}`
      };
      
      logPerformance('store_audio', startTime, {
        fileId,
        filename,
        size: this.formatBytes(stats.size),
        mimeType: storageFile.mimeType,
        hasMetadata: !!metadata
      });
      
      return storageFile;
    } catch (error) {
      logger.error('Failed to store audio', {
        error: error instanceof Error ? error.message : String(error),
        originalName,
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  /**
   * Store thumbnail
   */
  async storeThumbnail(
    filePath: string,
    videoId: string
  ): Promise<StorageFile> {
    const startTime = Date.now();
    const sourceStats = await stat(filePath);
    
    logger.info('Storing thumbnail', {
      videoId,
      sourceSize: this.formatBytes(sourceStats.size)
    });
    
    try {
      const filename = `${videoId}_thumbnail.jpg`;
      const destPath = path.join(this.paths.thumbnails, filename);
      
      await copyFile(filePath, destPath);
      
      const stats = await stat(destPath);
      
      const storageFile: StorageFile = {
        id: videoId + '_thumb',
        originalName: filename,
        filename,
        path: destPath,
        size: stats.size,
        mimeType: 'image/jpeg',
        uploadedAt: new Date(),
        url: `/storage/thumbnails/${filename}`
      };
      
      logPerformance('store_thumbnail', startTime, {
        videoId,
        filename,
        size: this.formatBytes(stats.size)
      });
      
      return storageFile;
    } catch (error) {
      logger.error('Failed to store thumbnail', {
        error: error instanceof Error ? error.message : String(error),
        videoId,
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  /**
   * Move file from temp to permanent storage
   */
  async moveFromTemp(
    tempPath: string,
    destType: 'videos' | 'audio' | 'thumbnails',
    newName?: string
  ): Promise<StorageFile> {
    const startTime = Date.now();
    const sourceStats = await stat(tempPath);
    
    logger.info('Moving file from temp storage', {
      sourcePath: tempPath,
      destType,
      sourceSize: this.formatBytes(sourceStats.size),
      newName: newName || 'preserve original'
    });
    
    try {
      const filename = newName || path.basename(tempPath);
      const destPath = path.join(this.paths[destType], filename);
      
      await rename(tempPath, destPath);
      
      const stats = await stat(destPath);
      const fileId = crypto.randomBytes(16).toString('hex');
      
      const storageFile: StorageFile = {
        id: fileId,
        originalName: filename,
        filename,
        path: destPath,
        size: stats.size,
        mimeType: this.getMimeType(filename),
        uploadedAt: new Date(),
        url: `/storage/${destType}/${filename}`
      };
      
      logPerformance('move_from_temp', startTime, {
        fileId,
        filename,
        destType,
        size: this.formatBytes(stats.size)
      });
      
      return storageFile;
    } catch (error) {
      logger.error('Failed to move file from temp', {
        error: error instanceof Error ? error.message : String(error),
        tempPath,
        destType,
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const fileStats = await stat(filePath);
      logger.info('Deleting file', {
        filePath,
        size: this.formatBytes(fileStats.size),
        type: this.getMimeType(filePath)
      });
      
      await unlink(filePath);
      
      // Also delete metadata if it exists
      const metadataPath = filePath + '.json';
      let metadataDeleted = false;
      try {
        const metadataStats = await stat(metadataPath);
        await unlink(metadataPath);
        metadataDeleted = true;
        logger.debug('Metadata deleted', {
          metadataPath,
          metadataSize: this.formatBytes(metadataStats.size)
        });
      } catch (error) {
        // Ignore if metadata doesn't exist
      }
      
      logger.info('File deleted successfully', {
        filePath,
        sizeReclaimed: this.formatBytes(fileStats.size),
        metadataDeleted,
        duration: `${Date.now() - startTime}ms`
      });
    } catch (error) {
      logger.error('Failed to delete file', {
        error: error instanceof Error ? error.message : String(error),
        filePath,
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  /**
   * Clean up temp directory
   */
  async cleanupTempFiles(olderThanHours: number = 24): Promise<number> {
    const startTime = Date.now();
    
    logger.info('Starting temp file cleanup', {
      olderThanHours,
      tempPath: this.paths.temp
    });
    
    try {
      const files = await readdir(this.paths.temp);
      const now = Date.now();
      const maxAge = olderThanHours * 60 * 60 * 1000;
      let deletedCount = 0;
      let totalSizeReclaimed = 0;
      
      for (const file of files) {
        const filePath = path.join(this.paths.temp, file);
        const stats = await stat(filePath);
        const ageInHours = (now - stats.mtime.getTime()) / (60 * 60 * 1000);
        
        if (now - stats.mtime.getTime() > maxAge) {
          totalSizeReclaimed += stats.size;
          await unlink(filePath);
          deletedCount++;
          logger.debug('Deleted temp file', {
            file,
            size: this.formatBytes(stats.size),
            ageInHours: ageInHours.toFixed(1)
          });
        }
      }
      
      logger.info('Temp file cleanup completed', {
        filesScanned: files.length,
        filesDeleted: deletedCount,
        sizeReclaimed: this.formatBytes(totalSizeReclaimed),
        duration: `${Date.now() - startTime}ms`
      });
      
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup temp files', {
        error: error instanceof Error ? error.message : String(error),
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<Record<string, any>> {
    const startTime = Date.now();
    
    logger.info('Calculating storage statistics');
    
    try {
      const stats: Record<string, any> = {};
      let totalStorageSize = 0;
      let totalFileCount = 0;
      
      for (const [type, dirPath] of Object.entries(this.paths)) {
        const files = await readdir(dirPath);
        let totalSize = 0;
        let fileCount = 0;
        const fileTypes: Record<string, number> = {};
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const fileStat = await stat(filePath);
          if (fileStat.isFile()) {
            totalSize += fileStat.size;
            fileCount++;
            
            const ext = path.extname(file).toLowerCase();
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
          }
        }
        
        totalStorageSize += totalSize;
        totalFileCount += fileCount;
        
        stats[type] = {
          fileCount,
          totalSize,
          totalSizeFormatted: this.formatBytes(totalSize),
          averageFileSize: fileCount > 0 ? this.formatBytes(totalSize / fileCount) : '0 Bytes',
          fileTypes
        };
      }
      
      stats.summary = {
        totalFiles: totalFileCount,
        totalSize: totalStorageSize,
        totalSizeFormatted: this.formatBytes(totalStorageSize)
      };
      
      logger.info('Storage statistics calculated', {
        totalFiles: totalFileCount,
        totalSize: this.formatBytes(totalStorageSize),
        duration: `${Date.now() - startTime}ms`
      });
      
      return stats;
    } catch (error) {
      logger.error('Failed to get storage stats', {
        error: error instanceof Error ? error.message : String(error),
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get mime type from filename
   */
  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.json': 'application/json'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Create storage URL for file
   */
  createFileUrl(type: 'videos' | 'audio' | 'thumbnails', filename: string): string {
    return `/api/storage/${type}/${filename}`;
  }

  /**
   * Get file stream
   */
  getFileStream(filePath: string): fs.ReadStream {
    logger.debug('Creating file stream', {
      filePath,
      type: this.getMimeType(filePath)
    });
    return fs.createReadStream(filePath);
  }
}

export default new LocalStorageService();