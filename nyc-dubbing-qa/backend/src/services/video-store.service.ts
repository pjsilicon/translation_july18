// Temporary in-memory video store for development
// In production, this would be a database

interface VideoData {
  id: string;
  title: string;
  originalFilename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate: number;
  thumbnailPath: string;
  context?: string;
  description?: string;
  status: string;
  uploadedAt: Date;
  transcription?: any;
  translations?: any;
}

class VideoStoreService {
  private videos: Map<string, VideoData> = new Map();

  save(videoData: VideoData): void {
    this.videos.set(videoData.id, videoData);
  }

  get(videoId: string): VideoData | undefined {
    return this.videos.get(videoId);
  }

  update(videoId: string, updates: Partial<VideoData>): void {
    const video = this.videos.get(videoId);
    if (video) {
      this.videos.set(videoId, { ...video, ...updates });
    }
  }

  delete(videoId: string): boolean {
    return this.videos.delete(videoId);
  }

  getAll(): VideoData[] {
    return Array.from(this.videos.values());
  }
}

export const videoStore = new VideoStoreService();