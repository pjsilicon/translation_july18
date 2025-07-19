require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// File upload setup
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Test FFmpeg installation
app.get('/api/ffmpeg-test', async (req, res) => {
  try {
    const { stdout } = await execAsync('ffmpeg -version');
    res.json({ 
      success: true, 
      ffmpegVersion: stdout.split('\n')[0],
      message: 'FFmpeg is working!' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasGoogle: !!process.env.GOOGLE_API_KEY,
      hasElevenLabs: !!process.env.ELEVENLABS_API_KEY,
      nodeVersion: process.version
    }
  });
});

// Video upload endpoint
app.post('/api/videos/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const videoPath = req.file.path;
    const videoId = Date.now().toString();
    
    // Get video info using FFmpeg
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to process video' });
      }
      
      res.json({
        success: true,
        videoId: videoId,
        filename: req.file.originalname,
        size: req.file.size,
        duration: metadata.format.duration,
        format: metadata.format.format_name
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transcription endpoint (mock for now)
app.post('/api/videos/:videoId/transcribe', async (req, res) => {
  const { videoId } = req.params;
  
  // In a real implementation, you'd:
  // 1. Extract audio using FFmpeg
  // 2. Send to OpenAI Whisper
  // For now, return mock data
  
  res.json({
    success: true,
    message: 'Transcription started',
    videoId: videoId,
    segments: [
      {
        id: '1',
        text: 'This is a test transcription.',
        startTime: 0,
        endTime: 5
      }
    ]
  });
});

// Translation endpoint (mock for now)
app.post('/api/translation/translate', async (req, res) => {
  const { segments, targetLanguage } = req.body;
  
  res.json({
    success: true,
    translations: segments.map(seg => ({
      id: seg.id,
      originalText: seg.text,
      translatedText: `[${targetLanguage}] ${seg.text}`,
      confidence: 0.95,
      qaStatus: 'approved'
    }))
  });
});

// Serve React app
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>NYC Translation QA</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: #f5f5f5;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #333; }
        .status { 
          padding: 20px; 
          background: #e8f5e9; 
          border-radius: 5px;
          margin: 20px 0;
        }
        .endpoint {
          background: #f5f5f5;
          padding: 10px;
          margin: 5px 0;
          border-radius: 5px;
          font-family: monospace;
        }
        button {
          background: #4CAF50;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          margin: 5px;
        }
        button:hover { background: #45a049; }
        #results {
          margin-top: 20px;
          padding: 15px;
          background: #f9f9f9;
          border-radius: 5px;
          white-space: pre-wrap;
          font-family: monospace;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🗽 NYC Translation QA Platform</h1>
        <div class="status">
          <h3>✅ Server is running on Replit!</h3>
          <p>Your API is ready at: <strong>${req.get('host')}</strong></p>
        </div>
        
        <h3>Test Endpoints:</h3>
        <div class="endpoint">GET /api/health</div>
        <div class="endpoint">GET /api/ffmpeg-test</div>
        <div class="endpoint">POST /api/videos/upload</div>
        
        <h3>Quick Tests:</h3>
        <button onclick="testHealth()">Test Health</button>
        <button onclick="testFFmpeg()">Test FFmpeg</button>
        <button onclick="testUpload()">Test Upload</button>
        
        <div id="results"></div>
      </div>
      
      <script>
        const baseUrl = window.location.origin;
        const results = document.getElementById('results');
        
        async function testHealth() {
          try {
            const res = await fetch(baseUrl + '/api/health');
            const data = await res.json();
            results.textContent = 'Health Check:\\n' + JSON.stringify(data, null, 2);
          } catch (err) {
            results.textContent = 'Error: ' + err.message;
          }
        }
        
        async function testFFmpeg() {
          try {
            const res = await fetch(baseUrl + '/api/ffmpeg-test');
            const data = await res.json();
            results.textContent = 'FFmpeg Test:\\n' + JSON.stringify(data, null, 2);
          } catch (err) {
            results.textContent = 'Error: ' + err.message;
          }
        }
        
        async function testUpload() {
          results.textContent = 'To test upload, use:\\ncurl -X POST -F "video=@yourfile.mp4" ' + baseUrl + '/api/videos/upload';
        }
      </script>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 NYC Translation QA Server Running!
📍 Port: ${PORT}
🌐 URL: Will be provided by Replit
✅ FFmpeg: Pre-installed on Replit
📁 Uploads: ./uploads directory

Test endpoints:
- Health: /api/health
- FFmpeg: /api/ffmpeg-test
- Upload: POST /api/videos/upload
  `);
});