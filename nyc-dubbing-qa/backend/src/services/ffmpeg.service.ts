import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

interface AudioOptions {
  codec?: string;
  bitrate?: string;
  sampleRate?: number;
  channels?: number;
}

export class FFmpegService {
  constructor() {
    // Set FFmpeg path if provided in environment
    if (process.env.FFMPEG_PATH) {
      ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
    }
  }

  async extractAudio(
    videoPath: string, 
    outputPath: string,
    options: AudioOptions = {}
  ): Promise<string> {
    // Ensure the input file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Input file not found: ${videoPath}`);
    }
    
    // Ensure the output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    return new Promise((resolve, reject) => {
      let command = ffmpeg(videoPath)
        .output(outputPath)
        .noVideo();

      // Apply audio options
      if (options.codec) {
        command.audioCodec(options.codec);
      } else {
        command.audioCodec('mp3');
      }

      if (options.bitrate) {
        command.audioBitrate(options.bitrate);
      }

      if (options.sampleRate) {
        command.audioFrequency(options.sampleRate);
      }

      if (options.channels) {
        command.audioChannels(options.channels);
      }

      // Check if input has audio stream first
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to probe video file: ${err.message}`));
          return;
        }
        
        const hasAudio = metadata.streams.some(stream => stream.codec_type === 'audio');
        if (!hasAudio) {
          reject(new Error('Video file does not contain an audio stream'));
          return;
        }
        
        command
          .on('end', () => {
            logger.info('Audio extraction completed');
            resolve(outputPath);
          })
          .on('error', (err) => {
            logger.error('Audio extraction error:', err);
            reject(err);
          })
          .run();
      });
    });
  }

  async convertAudio(
    inputPath: string,
    outputPath: string,
    options: AudioOptions = {}
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .output(outputPath);

      // Apply audio options
      if (options.codec) command.audioCodec(options.codec);
      if (options.bitrate) command.audioBitrate(options.bitrate);
      if (options.sampleRate) command.audioFrequency(options.sampleRate);
      if (options.channels) command.audioChannels(options.channels);

      command
        .on('end', () => {
          logger.info('Audio conversion completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Audio conversion error:', err);
          reject(err);
        })
        .run();
    });
  }

  async getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          logger.error('Audio probe error:', err);
          reject(err);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }

  async extractAudioSegment(
    inputPath: string,
    outputPath: string,
    startTime: number,
    duration: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .output(outputPath)
        .audioCodec('mp3')
        .audioBitrate('128k')
        .on('end', () => {
          logger.info(`Audio segment extracted: ${startTime}s - ${startTime + duration}s`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Audio segment extraction error:', err);
          reject(err);
        })
        .run();
    });
  }

  async getVideoInfo(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          logger.error('Video info error:', err);
          reject(err);
        } else {
          resolve({
            duration: metadata.format.duration,
            size: metadata.format.size,
            bitrate: metadata.format.bit_rate,
            width: metadata.streams[0]?.width,
            height: metadata.streams[0]?.height,
            fps: eval(metadata.streams[0]?.r_frame_rate || '0'),
            codec: metadata.streams[0]?.codec_name,
          });
        }
      });
    });
  }

  async generateThumbnail(videoPath: string, outputPath: string, timestamp = '00:00:05'): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '320x240'
        })
        .on('end', () => {
          logger.info('Thumbnail generated');
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Thumbnail generation error:', err);
          reject(err);
        });
    });
  }

  async mergeAudioVideo(videoPath: string, audioPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          '-c:v copy',
          '-c:a aac',
          '-map 0:v:0',
          '-map 1:a:0',
          '-shortest'
        ])
        .output(outputPath)
        .on('end', () => {
          logger.info('Audio-video merge completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Merge error:', err);
          reject(err);
        })
        .run();
    });
  }

  async convertVideo(inputPath: string, outputPath: string, options: any = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      // Apply options
      if (options.format) command.format(options.format);
      if (options.videoCodec) command.videoCodec(options.videoCodec);
      if (options.audioCodec) command.audioCodec(options.audioCodec);
      if (options.size) command.size(options.size);
      if (options.fps) command.fps(options.fps);
      if (options.bitrate) command.videoBitrate(options.bitrate);

      command
        .output(outputPath)
        .on('end', () => {
          logger.info('Video conversion completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Conversion error:', err);
          reject(err);
        })
        .run();
    });
  }
}

export default new FFmpegService();