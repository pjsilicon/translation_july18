# NYC Dubbing QA Platform - Project Status

## Last Updated: 2025-07-18

## Overview
The NYC Dubbing QA Platform is a web application that enables video translation and dubbing with quality assurance features. It uses OpenAI Whisper for transcription, dual OpenAI models for translation quality assurance, and ElevenLabs for text-to-speech generation.

## Current Status: Partially Working with Issues

### Working Features
1. **Video Upload**: Files upload successfully with proper extension preservation
2. **Transcription**: OpenAI Whisper transcription works correctly
3. **Translation**: Dual-model translation using GPT-4 and GPT-4-turbo works
4. **Voice Selection UI**: Added dropdown for selecting ElevenLabs voices
5. **Frontend UI**: React app displays all steps properly

### Issues Fixed in This Session
1. **FFmpeg Path Resolution**: Added proper path resolution using `path.resolve()` for all file operations
2. **Mock Data Removal**: Removed all mock data from getTranscription endpoint - now uses real video store data
3. **Voice Selection**: Added UI dropdown to select from available ElevenLabs voices
4. **File Extension Preservation**: Fixed multer to save files with original extensions

### Known Issues Requiring Attention
1. **FFmpeg Error Code 234**: The error "Error opening output file uploads/video-xxx_audio.wav. Error opening output files: Invalid argument" still occurs intermittently. This appears to be related to:
   - Directory permissions
   - Path resolution on macOS
   - FFmpeg configuration

2. **ElevenLabs Voice ID**: The default voice selection needs proper initialization - ensure a valid voice ID is selected by default

3. **Frontend Stability**: The frontend has an ErrorBoundary component but may still crash on certain errors

### Environment Setup
- **Backend**: Express.js with TypeScript, Prisma ORM
- **Frontend**: React with Vite and TypeScript
- **Database**: PostgreSQL (via Docker)
- **Cache**: Redis (via Docker)
- **APIs**: OpenAI (Whisper + GPT-4), ElevenLabs

### Required Environment Variables
```env
# Backend .env
OPENAI_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
DATABASE_URL=postgresql://user:password@localhost:5432/nyc_dubbing
REDIS_URL=redis://localhost:6379
UPLOAD_DIR=./uploads

# Frontend .env
VITE_API_URL=http://localhost:3000/api
```

### Running the Application
1. Start Docker services:
   ```bash
   docker-compose up -d
   ```

2. Start backend:
   ```bash
   cd backend
   npm run dev
   ```

3. Start frontend:
   ```bash
   cd frontend
   npm run dev
   ```

### Recent Changes Made
1. **Voice Selection Feature**:
   - Added `getVoices()` method to audioAPI in frontend
   - Added useEffect hook to fetch voices on component mount
   - Added voice selection dropdown in TranslationQAView
   - Updated handleGenerateAudio to use selected voice

2. **FFmpeg Service Updates**:
   - Added directory existence checks
   - Added path resolution for all file operations
   - Improved error handling and logging

3. **Video Controller**:
   - Uses real video store data instead of mock data
   - Proper error handling for missing videos/transcriptions

### Next Steps Recommended
1. **Fix FFmpeg Path Issues**:
   - Test with absolute paths
   - Check directory permissions
   - Consider using a dedicated temp directory with proper permissions

2. **Improve Error Handling**:
   - Add more specific error messages
   - Implement retry logic for transient failures
   - Better user feedback for errors

3. **Add Missing Features**:
   - Implement actual audio file generation and storage
   - Add download functionality for generated audio
   - Implement video/audio merging for final output

4. **Testing**:
   - Add unit tests for critical services
   - Add integration tests for the full pipeline
   - Test with various video formats and sizes

### Architecture Notes
- Uses in-memory video store for development (should be replaced with database in production)
- Translation uses dual-model approach for quality assurance
- Audio processing uses FFmpeg for format conversion
- All temporary files are cleaned up after processing

### Troubleshooting Tips
1. If FFmpeg errors occur, check:
   - FFmpeg is installed (`ffmpeg -version`)
   - Upload directory exists and has write permissions
   - Path separators are correct for the OS

2. If API errors occur, verify:
   - All API keys are set correctly
   - API rate limits aren't exceeded
   - Network connectivity to external services

3. If frontend crashes:
   - Check browser console for errors
   - Verify API responses match expected format
   - Check for null/undefined data handling