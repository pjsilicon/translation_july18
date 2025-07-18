const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api';
const VIDEO_PATH = path.join(__dirname, 'uploads', 'testvid.mp4');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPipeline() {
  try {
    console.log('🎬 Starting video processing pipeline test...\n');
    
    // 1. Upload video
    console.log('1️⃣ Uploading video...');
    const formData = new FormData();
    formData.append('video', fs.createReadStream(VIDEO_PATH));
    formData.append('title', 'Test Video');
    formData.append('context', 'Test video for NYC dubbing QA platform development');
    
    const uploadResponse = await axios.post(`${API_URL}/videos/upload`, formData, {
      headers: formData.getHeaders()
    });
    
    const { videoId } = uploadResponse.data.data;
    console.log(`✅ Video uploaded successfully! Video ID: ${videoId}\n`);
    
    // 2. Transcribe video
    console.log('2️⃣ Transcribing video with Whisper...');
    const transcribeResponse = await axios.post(`${API_URL}/videos/${videoId}/transcribe`, {
      prompt: 'Government announcement about public safety'
    });
    
    console.log(`✅ Transcription completed!`);
    console.log(`   Language: ${transcribeResponse.data.data.language}`);
    console.log(`   Duration: ${transcribeResponse.data.data.duration}s`);
    console.log(`   Segments: ${transcribeResponse.data.data.segmentCount}\n`);
    
    // 3. Get transcription
    const transcriptionResponse = await axios.get(`${API_URL}/videos/${videoId}/transcription`);
    const segments = transcriptionResponse.data.data.segments;
    
    console.log('📝 Transcription preview:');
    segments.slice(0, 3).forEach((seg, i) => {
      console.log(`   [${seg.startTime}s - ${seg.endTime}s]: "${seg.text.substring(0, 60)}..."`);
    });
    console.log('');
    
    // 4. Translate to Spanish
    console.log('3️⃣ Translating to Spanish...');
    const translateResponse = await axios.post(`${API_URL}/translation/translate`, {
      videoId,
      targetLanguage: 'es',
      segments: segments.map(seg => ({
        id: seg.id,
        text: seg.text,
        startTime: seg.startTime,
        endTime: seg.endTime
      })),
      context: 'Government announcement'
    });
    
    console.log(`✅ Translation completed!`);
    const translations = translateResponse.data.data.translations;
    console.log('🌐 Translation preview:');
    translations.slice(0, 3).forEach((trans, i) => {
      console.log(`   Spanish: "${trans.translation.substring(0, 60)}..."`);
    });
    console.log('');
    
    // 5. Generate audio
    console.log('4️⃣ Generating audio with ElevenLabs...');
    const audioResponse = await axios.post(`${API_URL}/dubbing/generate-audio`, {
      videoId,
      segments: translations.map(trans => ({
        id: trans.id,
        text: trans.translation,
        startTime: trans.startTime,
        endTime: trans.endTime
      })),
      language: 'es'
    });
    
    console.log(`✅ Audio generation completed!`);
    console.log(`   Generated ${audioResponse.data.data.segments.length} audio segments\n`);
    
    console.log('🎉 Pipeline test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      console.error('   Make sure the backend server is running on port 3000');
    }
  }
}

// Run the test
testPipeline();