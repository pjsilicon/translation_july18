import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { transcriptionLogger as logger, logPerformance } from '../utils/logger';
import ffmpegService from './ffmpeg.service';

interface WhisperSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

interface TranscriptionOptions {
  language?: string;
  prompt?: string;
  temperature?: number;
  timestamp_granularities?: ('segment' | 'word')[];
}

interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  segments: WhisperSegment[];
  words?: WhisperWord[];
}

export class WhisperService {
  private client: OpenAI;
  private MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    logger.info('WhisperService initialized', {
      maxFileSize: this.formatBytes(this.MAX_FILE_SIZE),
      apiKeyProvided: !!process.env.OPENAI_API_KEY
    });
  }

  /**
   * Transcribe video/audio file with Whisper API
   */
  async transcribeFile(
    filePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    const fileStats = await fs.promises.stat(filePath);
    
    try {
      logger.info('Starting transcription process', {
        filePath,
        fileSize: this.formatBytes(fileStats.size),
        language: options.language || 'auto',
        timestampGranularities: options.timestamp_granularities || ['segment']
      });

      // Extract audio if video file
      const audioPath = await this.prepareAudioFile(filePath);

      // Check file size and split if necessary
      const audioStats = await fs.promises.stat(audioPath);
      
      if (audioStats.size > this.MAX_FILE_SIZE) {
        logger.info('File size exceeds limit, using chunked transcription', {
          audioSize: this.formatBytes(audioStats.size),
          maxSize: this.formatBytes(this.MAX_FILE_SIZE),
          chunksRequired: Math.ceil(audioStats.size / this.MAX_FILE_SIZE)
        });
        const result = await this.transcribeLargeFile(audioPath, options);
        logPerformance('transcribe_large_file', startTime, {
          fileSize: this.formatBytes(fileStats.size),
          audioSize: this.formatBytes(audioStats.size),
          segments: result.segments.length,
          duration: result.duration
        });
        return result;
      }

      // Transcribe single file
      const result = await this.transcribeSingleFile(audioPath, options);
      logPerformance('transcribe_single_file', startTime, {
        fileSize: this.formatBytes(fileStats.size),
        audioSize: this.formatBytes(audioStats.size),
        segments: result.segments.length,
        duration: result.duration
      });
      return result;
    } catch (error) {
      logger.error('Whisper transcription failed', {
        error: error instanceof Error ? error.message : String(error),
        filePath,
        language: options.language,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Prepare audio file for transcription
   */
  private async prepareAudioFile(inputPath: string): Promise<string> {
    const startTime = Date.now();
    const ext = path.extname(inputPath).toLowerCase();
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const inputStats = await fs.promises.stat(inputPath);

    if (videoExtensions.includes(ext)) {
      logger.info('Extracting audio from video file', {
        inputFormat: ext,
        inputSize: this.formatBytes(inputStats.size)
      });
      const outputPath = path.resolve(inputPath.replace(ext, '_audio.wav'));
      await ffmpegService.extractAudio(path.resolve(inputPath), outputPath, {
        codec: 'pcm_s16le',
        bitrate: '128k',
        sampleRate: 16000, // Optimal for Whisper
        channels: 1 // Mono
      });
      
      const outputStats = await fs.promises.stat(outputPath);
      logger.info('Audio extraction completed', {
        outputPath,
        outputSize: this.formatBytes(outputStats.size),
        compressionRatio: (inputStats.size / outputStats.size).toFixed(2),
        duration: `${Date.now() - startTime}ms`
      });
      return outputPath;
    }

    // Convert audio to optimal format if needed
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac'];
    if (!audioExtensions.includes(ext)) {
      logger.info('Converting audio to optimal format', {
        inputFormat: ext,
        inputSize: this.formatBytes(inputStats.size)
      });
      const outputPath = inputPath.replace(ext, '_converted.wav');
      await ffmpegService.convertAudio(inputPath, outputPath, {
        codec: 'pcm_s16le',
        bitrate: '128k',
        sampleRate: 16000,
        channels: 1
      });
      
      const outputStats = await fs.promises.stat(outputPath);
      logger.info('Audio conversion completed', {
        outputPath,
        outputSize: this.formatBytes(outputStats.size),
        duration: `${Date.now() - startTime}ms`
      });
      return outputPath;
    }

    logger.info('Audio file already in optimal format', {
      format: ext,
      size: this.formatBytes(inputStats.size)
    });
    return inputPath;
  }

  /**
   * Transcribe a single audio file
   */
  private async transcribeSingleFile(
    audioPath: string,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    const audioStats = await fs.promises.stat(audioPath);
    
    logger.info('Sending audio to Whisper API', {
      audioPath,
      audioSize: this.formatBytes(audioStats.size),
      requestedLanguage: options.language || 'auto',
      temperature: options.temperature || 0
    });
    
    const fileStream = fs.createReadStream(audioPath);

    // Use verbose_json to get segments and timestamps
    const transcription = await this.client.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      response_format: 'verbose_json',
      language: options.language || 'en',
      prompt: options.prompt,
      temperature: options.temperature || 0,
      timestamp_granularities: options.timestamp_granularities || ['segment']
    });

    // Parse the response
    const result = transcription as any;
    
    logger.info('Whisper API transcription completed', {
      detectedLanguage: result.language,
      duration: result.duration,
      segmentCount: result.segments?.length || 0,
      wordCount: result.words?.length || 0,
      textLength: result.text?.length || 0,
      apiDuration: `${Date.now() - startTime}ms`
    });
    
    return {
      text: result.text,
      language: result.language || 'en',
      duration: result.duration || 0,
      segments: result.segments || [],
      words: result.words
    };
  }

  /**
   * Transcribe large files by splitting into chunks
   */
  private async transcribeLargeFile(
    audioPath: string,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    const audioStats = await fs.promises.stat(audioPath);
    
    // Get audio duration
    const duration = await ffmpegService.getAudioDuration(audioPath);
    const chunkDuration = 300; // 5 minutes per chunk
    const chunks = Math.ceil(duration / chunkDuration);
    
    logger.info('Splitting large audio file into chunks', {
      audioPath,
      audioSize: this.formatBytes(audioStats.size),
      totalDuration: `${duration.toFixed(1)}s`,
      chunkDuration: `${chunkDuration}s`,
      totalChunks: chunks
    });
    
    const segments: WhisperSegment[] = [];
    let fullText = '';
    let segmentIdCounter = 0;

    for (let i = 0; i < chunks; i++) {
      const startTime = i * chunkDuration;
      const chunkPath = audioPath.replace('.mp3', `_chunk_${i}.mp3`);
      
      // Extract chunk
      await ffmpegService.extractAudioSegment(
        audioPath,
        chunkPath,
        startTime,
        chunkDuration
      );

      try {
        const chunkStats = await fs.promises.stat(chunkPath);
        logger.info(`Processing chunk ${i + 1}/${chunks}`, {
          chunkPath,
          chunkSize: this.formatBytes(chunkStats.size),
          timeRange: `${startTime}s - ${Math.min(startTime + chunkDuration, duration)}s`
        });
        
        // Transcribe chunk
        const chunkResult = await this.transcribeSingleFile(chunkPath, options);
        
        // Adjust timestamps for segments
        const adjustedSegments = chunkResult.segments.map(seg => ({
          ...seg,
          id: segmentIdCounter++,
          start: seg.start + startTime,
          end: seg.end + startTime,
          seek: seg.seek + startTime
        }));

        segments.push(...adjustedSegments);
        fullText += (i > 0 ? ' ' : '') + chunkResult.text;
        
        logger.info(`Chunk ${i + 1}/${chunks} processed successfully`, {
          segmentsAdded: adjustedSegments.length,
          textLength: chunkResult.text.length
        });

        // Clean up chunk file
        await fs.promises.unlink(chunkPath);
      } catch (error) {
        logger.error(`Failed to transcribe chunk ${i + 1}/${chunks}`, {
          error: error instanceof Error ? error.message : String(error),
          chunkPath,
          timeRange: `${startTime}s - ${Math.min(startTime + chunkDuration, duration)}s`
        });
        // Clean up chunk file on error
        try {
          await fs.promises.unlink(chunkPath);
        } catch {}
        throw error;
      }
    }

    logPerformance('transcribe_large_file_chunks', startTime, {
      totalChunks: chunks,
      totalSegments: segments.length,
      totalDuration: duration,
      finalTextLength: fullText.length
    });
    
    return {
      text: fullText,
      language: options.language || 'en',
      duration,
      segments
    };
  }

  /**
   * Transcribe with word-level timestamps
   */
  async transcribeWithWords(
    filePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    return this.transcribeFile(filePath, {
      ...options,
      timestamp_granularities: ['segment', 'word']
    });
  }

  /**
   * Get confidence scores for transcription segments
   */
  calculateSegmentConfidence(segment: WhisperSegment): number {
    // Calculate confidence based on various factors
    const logprobScore = Math.exp(segment.avg_logprob);
    const compressionScore = 1 / (1 + Math.abs(segment.compression_ratio - 2.4));
    const speechScore = 1 - segment.no_speech_prob;
    
    // Weighted average
    const confidence = (
      logprobScore * 0.4 +
      compressionScore * 0.3 +
      speechScore * 0.3
    );
    
    const finalConfidence = Math.min(Math.max(confidence, 0), 1); // Clamp between 0 and 1
    
    // Log low confidence segments for review
    if (finalConfidence < 0.7) {
      logger.warn('Low confidence segment detected', {
        segmentId: segment.id,
        confidence: finalConfidence.toFixed(3),
        text: segment.text.substring(0, 50) + '...',
        avgLogProb: segment.avg_logprob,
        compressionRatio: segment.compression_ratio,
        noSpeechProb: segment.no_speech_prob
      });
    }

    return finalConfidence;
  }

  /**
   * Format segments for frontend display
   */
  formatSegmentsForUI(segments: WhisperSegment[]): any[] {
    return segments.map((segment, index) => ({
      id: index + 1,
      startTime: segment.start,
      endTime: segment.end,
      text: segment.text.trim(),
      confidence: this.calculateSegmentConfidence(segment),
      tokens: segment.tokens?.length || 0,
      avgLogProb: segment.avg_logprob,
      noSpeechProb: segment.no_speech_prob
    }));
  }

  /**
   * Clean up temporary audio files
   */
  async cleanupTempFiles(originalPath: string): Promise<void> {
    const startTime = Date.now();
    const dir = path.dirname(originalPath);
    const basename = path.basename(originalPath, path.extname(originalPath));
    
    const patterns = [
      `${basename}_audio.wav`,
      `${basename}_audio.mp3`,
      `${basename}_converted.wav`,
      `${basename}_converted.mp3`,
      `${basename}_chunk_*.mp3`
    ];
    
    logger.info('Starting cleanup of temporary files', {
      directory: dir,
      basename,
      patterns
    });
    
    let cleanedCount = 0;
    let totalSize = 0;

    for (const pattern of patterns) {
      const files = await fs.promises.readdir(dir);
      const matchingFiles = files.filter(f => 
        f.includes(basename) && (
          f.endsWith('_audio.wav') ||
          f.endsWith('_audio.mp3') ||
          f.endsWith('_converted.wav') ||
          f.endsWith('_converted.mp3') ||
          f.includes('_chunk_')
        )
      );

      for (const file of matchingFiles) {
        try {
          const filePath = path.join(dir, file);
          const stats = await fs.promises.stat(filePath);
          totalSize += stats.size;
          
          await fs.promises.unlink(filePath);
          cleanedCount++;
          logger.debug('Temp file removed', {
            file,
            size: this.formatBytes(stats.size)
          });
        } catch (error) {
          logger.warn('Failed to clean up temp file', {
            file,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    logger.info('Cleanup completed', {
      filesRemoved: cleanedCount,
      totalSizeReclaimed: this.formatBytes(totalSize),
      duration: `${Date.now() - startTime}ms`
    });
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
}

export default new WhisperService();