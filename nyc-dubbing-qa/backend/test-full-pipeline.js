require('dotenv').config();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000/api';
const VIDEO_PATH = path.join(__dirname, 'uploads', 'testvid.mp4');

async function testPipeline() {
  console.log('🎬 Testing full video processing pipeline...\n');
  
  try {
    // 1. Upload video
    console.log('1️⃣ UPLOADING VIDEO...');
    const formData = new FormData();
    formData.append('video', fs.createReadStream(VIDEO_PATH));
    formData.append('title', 'Test Video');
    formData.append('context', 'Test video for NYC dubbing QA platform');
    
    const uploadResponse = await fetch(`${API_URL}/videos/upload`, {
      method: 'POST',
      body: formData
    });
    
    const uploadResult = await uploadResponse.json();
    console.log('Upload response:', JSON.stringify(uploadResult, null, 2));
    
    if (!uploadResult.success) {
      throw new Error(`Upload failed: ${uploadResult.error}`);
    }
    
    const videoId = uploadResult.data.videoId;
    console.log(`✅ Video uploaded! ID: ${videoId}\n`);
    
    // 2. Transcribe video
    console.log('2️⃣ TRANSCRIBING VIDEO...');
    const transcribeResponse = await fetch(`${API_URL}/videos/${videoId}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Government announcement about public safety'
      })
    });
    
    const transcribeResult = await transcribeResponse.json();
    console.log('Transcribe response:', JSON.stringify(transcribeResult, null, 2));
    
    if (!transcribeResult.success) {
      // Let's check what's in the video store
      console.log('\n🔍 Debugging: Checking server state...');
      
      // Try to get the video directly
      const getVideoResponse = await fetch(`${API_URL}/videos/${videoId}/transcription`);
      const getVideoResult = await getVideoResponse.json();
      console.log('Get transcription response:', JSON.stringify(getVideoResult, null, 2));
      
      throw new Error(`Transcription failed: ${transcribeResult.error}`);
    }
    
    console.log(`✅ Transcription completed!\n`);
    
    // 3. Get transcription details
    console.log('3️⃣ GETTING TRANSCRIPTION...');
    const transcriptionResponse = await fetch(`${API_URL}/videos/${videoId}/transcription`);
    const transcriptionResult = await transcriptionResponse.json();
    
    if (!transcriptionResult.success) {
      throw new Error(`Failed to get transcription: ${transcriptionResult.error}`);
    }
    
    const segments = transcriptionResult.data.segments;
    console.log(`Found ${segments.length} segments`);
    console.log('First 3 segments:');
    segments.slice(0, 3).forEach((seg, i) => {
      console.log(`  [${seg.startTime}s - ${seg.endTime}s]: "${seg.text}"`);
    });
    console.log('');
    
    // 4. Translate to Spanish
    console.log('4️⃣ TRANSLATING TO SPANISH...');
    const translateResponse = await fetch(`${API_URL}/translation/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        targetLanguage: 'es',
        segments: segments.map(seg => ({
          id: seg.id || Math.random().toString(),
          text: seg.text,
          startTime: seg.startTime,
          endTime: seg.endTime
        })),
        context: 'Government announcement'
      })
    });
    
    const translateResult = await translateResponse.json();
    console.log('Translate response:', JSON.stringify(translateResult, null, 2));
    
    if (!translateResult.success) {
      throw new Error(`Translation failed: ${translateResult.error}`);
    }
    
    console.log(`✅ Translation completed!\n`);
    
    // 5. Generate audio
    console.log('5️⃣ GENERATING AUDIO...');
    const audioResponse = await fetch(`${API_URL}/dubbing/generate-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        segments: translateResult.data.translations.slice(0, 2), // Just first 2 segments to save API calls
        language: 'es'
      })
    });
    
    const audioResult = await audioResponse.json();
    console.log('Audio response:', JSON.stringify(audioResult, null, 2));
    
    if (!audioResult.success) {
      throw new Error(`Audio generation failed: ${audioResult.error}`);
    }
    
    console.log(`✅ Audio generation completed!\n`);
    console.log('🎉 PIPELINE TEST COMPLETED SUCCESSFULLY!');
    
  } catch (error) {
    console.error('❌ Pipeline test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
  console.log('Installing node-fetch...');
  const { execSync } = require('child_process');
  execSync('npm install node-fetch@2 form-data', { stdio: 'inherit' });
  console.log('Please run the script again.');
} else {
  testPipeline();
}