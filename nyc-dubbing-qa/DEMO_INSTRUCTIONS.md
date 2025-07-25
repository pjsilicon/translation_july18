# NYC AI Video Dubbing QA Platform - Demo Instructions

## Quick Start Demo

### 1. Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

### 2. Set Up Environment Variables

Create `.env` file in the backend directory:

```env
# API Keys (Required for full functionality)
OPENAI_API_KEY=your_openai_api_key
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Database (for demo, can use SQLite)
DATABASE_URL=file:./dev.db

# Server Config
PORT=3000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_here

# File Upload
UPLOAD_DIR=./uploads

# Redis (optional for demo)
REDIS_URL=redis://localhost:6379
```

### 3. Start the Servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 4. Access the Application

Open your browser to: http://localhost:5173

## Demo Walkthrough

### Step 1: Video Upload
1. Click "Choose Video File" button
2. Select a sample government video (MP4, MOV, AVI, or MKV)
3. The system will simulate processing with Whisper AI

### Step 2: Transcription & Context
1. Add context about the video (e.g., "Mayor's public safety announcement")
2. Select target language from NYC Local Law 30 languages:
   - Spanish, Chinese, Russian, Bengali, Haitian Creole
   - Korean, Arabic, Urdu, French, Polish

### Step 3: Translation & QA Review
1. Review side-by-side English/Translation segments
2. Click on any translation to edit it
3. Check confidence scores (green = high, yellow = medium, red = low)
4. Approve each segment by clicking "Approve Translation"
5. Note: The system uses both GPT-4 and Gemini Pro for accuracy

### Step 4: Audio Generation
1. Once all segments are approved, click "Generate Audio"
2. View the audio generation summary
3. Preview or download the dubbed audio file

## Key Features Demonstrated

### 1. **Dual-Model Translation**
- Translations are generated by both GPT-4 and Gemini Pro
- System automatically merges and selects best translation
- Confidence scoring based on model agreement

### 2. **Quality Assurance**
- Color-coded confidence indicators
- Inline editing capability
- Approval workflow for each segment
- AI re-translation option

### 3. **Context-Aware Translation**
- Considers speaker, tone, and subject matter
- Maintains government formality
- Preserves timing for dubbing synchronization

### 4. **NYC Local Law 30 Compliance**
- All 10 mandated languages available
- Cultural appropriateness for NYC's diverse population
- Professional government tone maintained

## Sample Test Script

For testing, you can use this sample script:

```
"Hello, I'm Mayor Johnson. Today, we're announcing a new public safety initiative 
that will benefit all New Yorkers. Starting January 15th, 2025, we will implement 
enhanced community policing in all five boroughs. This $50 million investment 
will create 500 new jobs and improve response times by 25 percent."
```

## API Testing

You can also test the API directly:

### Upload Video
```bash
curl -X POST http://localhost:3000/api/videos/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "video=@sample_video.mp4" \
  -F "title=Mayor Safety Announcement"
```

### Start Transcription
```bash
curl -X POST http://localhost:3000/api/videos/{videoId}/transcribe \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language": "en"}'
```

### Translate Segments
```bash
curl -X POST http://localhost:3000/api/videos/{videoId}/translate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetLanguage": "es",
    "context": {
      "speaker": "Mayor Johnson",
      "tone": "formal",
      "description": "Public safety announcement"
    }
  }'
```

## Troubleshooting

1. **API Keys Not Working**: Ensure all API keys are valid and have proper permissions
2. **Upload Fails**: Check that upload directory exists and has write permissions
3. **Translation Errors**: Verify both OpenAI and Google AI API keys are configured
4. **No Audio Generation**: ElevenLabs API key required for audio synthesis

## Next Steps

1. Connect to a real PostgreSQL database for persistence
2. Set up Redis for job queuing
3. Configure cloud storage (S3/Azure) for video files
4. Add user authentication system
5. Deploy to production environment

## Architecture Overview

```
Frontend (React + TypeScript)
    ↓
Backend API (Express + TypeScript)
    ↓
Services Layer:
- Whisper (Transcription)
- GPT-4 + Gemini (Translation)
- ElevenLabs (Voice Synthesis)
    ↓
Database (PostgreSQL)
Queue (Redis + Bull)
```