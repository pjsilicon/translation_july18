import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for auth token if needed
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Video APIs
export const videoAPI = {
  upload: async (file: File, metadata: { title: string; description?: string; context?: string }) => {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', metadata.title);
    if (metadata.description) formData.append('description', metadata.description);
    if (metadata.context) formData.append('context', metadata.context);

    const response = await api.post('/videos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  transcribe: async (videoId: string, options: { language?: string; prompt?: string }) => {
    const response = await api.post(`/videos/${videoId}/transcribe`, options);
    return response.data;
  },

  getTranscription: async (videoId: string) => {
    const response = await api.get(`/videos/${videoId}/transcription`);
    return response.data;
  },

  updateSegment: async (videoId: string, segmentId: string, data: { text: string }) => {
    const response = await api.put(`/videos/${videoId}/transcription/segments/${segmentId}`, data);
    return response.data;
  },
};

// Translation APIs
export const translationAPI = {
  translate: async (data: {
    videoId: string;
    targetLanguage: string;
    segments: Array<{ id: string; text: string; startTime: number; endTime: number }>;
    context?: string;
  }) => {
    const response = await api.post('/translation/translate', data);
    return response.data;
  },

  retranslateSegment: async (data: {
    segmentId: string;
    text: string;
    targetLanguage: string;
    context?: string;
  }) => {
    const response = await api.post('/translation/retranslate', data);
    return response.data;
  },

  getSupportedLanguages: async () => {
    const response = await api.get('/translation/languages');
    return response.data;
  },
};

// Audio Generation APIs
export const audioAPI = {
  getVoices: async () => {
    const response = await api.get('/dubbing/voices');
    return response.data;
  },

  generateAudio: async (data: {
    videoId: string;
    segments: Array<{
      id: string;
      text: string;
      startTime: number;
      endTime: number;
    }>;
    voice?: string;
    language: string;
  }) => {
    const response = await api.post('/dubbing/generate-audio', data);
    return response.data;
  },

  getAudioStatus: async (videoId: string) => {
    const response = await api.get(`/dubbing/${videoId}/status`);
    return response.data;
  },

  downloadAudio: async (videoId: string, language: string) => {
    const response = await api.get(`/dubbing/${videoId}/download/${language}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

// QA APIs
export const qaAPI = {
  approveSegment: async (videoId: string, segmentId: string) => {
    const response = await api.post(`/qa/${videoId}/segments/${segmentId}/approve`);
    return response.data;
  },

  rejectSegment: async (videoId: string, segmentId: string, reason: string) => {
    const response = await api.post(`/qa/${videoId}/segments/${segmentId}/reject`, { reason });
    return response.data;
  },

  getQAStatus: async (videoId: string) => {
    const response = await api.get(`/qa/${videoId}/status`);
    return response.data;
  },
};

export default api;