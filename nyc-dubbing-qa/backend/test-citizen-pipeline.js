const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_BASE = 'http://localhost:3001';
const VIDEO_FILE = '../test_data/Citizen.mp4';
const OUTPUT_DIR = '../test_data/';

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          resolve({ error: 'Invalid JSON response', body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

async function uploadVideo() {
  console.log('🎬 TESTING FULL PIPELINE FOR CITIZEN.MP4');
  console.log('=' .repeat(50));
  console.log('');
  
  console.log('1️⃣ UPLOADING VIDEO...');
  
  const videoPath = path.join(__dirname, VIDEO_FILE);
  
  if (!fs.existsSync(videoPath)) {
    console.error('❌ Video file not found:', videoPath);
    return null;
  }
  
  const stats = fs.statSync(videoPath);
  console.log(`📁 File: ${path.basename(videoPath)}`);
  console.log(`📏 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log('');
  
  const form = new FormData();
  form.append('video', fs.createReadStream(videoPath));
  form.append('title', 'Citizen Video Test');
  form.append('context', 'Government announcement or citizen-related content');
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/videos/upload',
    method: 'POST',
    headers: form.getHeaders()
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.success) {
            console.log('✅ Video uploaded successfully!');
            console.log(`📹 Video ID: ${result.data.videoId}`);
            console.log(`⏱️  Duration: ${result.data.duration} seconds`);
            console.log('');
            
            // Save upload response
            fs.writeFileSync(path.join(__dirname, OUTPUT_DIR, 'citizen-upload-response.json'), 
              JSON.stringify(result, null, 2));
            
            resolve(result.data.videoId);
          } else {
            console.error('❌ Upload failed:', result);
            reject(result);
          }
        } catch (e) {
          console.error('❌ Failed to parse upload response:', body);
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    form.pipe(req);
  });
}

async function transcribeVideo(videoId) {
  console.log('2️⃣ TRANSCRIBING VIDEO...');
  
  const result = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/videos/${videoId}/transcribe`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({
    prompt: 'This is a citizen-related or government announcement video. Please transcribe accurately.'
  }));
  
  if (result.success) {
    console.log('✅ Transcription successful!');
    console.log(`📝 Language: ${result.data.language}`);
    console.log(`📊 Segments: ${result.data.segmentCount}`);
    console.log(`⏱️  Duration: ${result.data.duration} seconds`);
    console.log('');
    
    console.log('📄 TRANSCRIPTION:');
    result.data.segments.forEach((seg, i) => {
      console.log(`${i + 1}. [${seg.startTime.toFixed(1)}s - ${seg.endTime.toFixed(1)}s] ${seg.text}`);
    });
    console.log('');
    
    // Save transcription
    fs.writeFileSync(path.join(__dirname, OUTPUT_DIR, 'citizen-transcription.json'), 
      JSON.stringify(result, null, 2));
    
    return result.data.segments;
  } else {
    console.error('❌ Transcription failed:', result);
    throw new Error('Transcription failed');
  }
}

async function translateVideo(segments) {
  console.log('3️⃣ TRANSLATING TO SPANISH...');
  
  const result = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/translation/translate',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({
    targetLanguage: 'spanish',
    segments: segments,
    context: {
      speaker: 'Government official or citizen',
      tone: 'formal',
      description: 'Citizen-related or government announcement content'
    }
  }));
  
  if (result.success) {
    console.log('✅ Translation successful!');
    console.log(`🌍 Target Language: ${result.data.targetLanguage}`);
    console.log(`📊 Segments: ${result.data.segmentCount}`);
    console.log(`🎯 Overall Confidence: ${(result.data.overallConfidence * 100).toFixed(1)}%`);
    console.log('');
    
    console.log('🔄 TRANSLATIONS:');
    result.data.translations.forEach((trans, i) => {
      console.log(`${i + 1}. 🟢 Original: "${trans.originalText}"`);
      console.log(`   🔄 Spanish: "${trans.translatedText}"`);
      console.log(`   📊 Confidence: ${(trans.confidence * 100).toFixed(1)}% | Status: ${trans.qaStatus}`);
      console.log(`   🤖 Models: GPT-4: "${trans.metadata.models.gpt4}" | Gemini: "${trans.metadata.models.gemini}"`);
      console.log('');
    });
    
    // Save translation
    fs.writeFileSync(path.join(__dirname, OUTPUT_DIR, 'citizen-translation.json'), 
      JSON.stringify(result, null, 2));
    
    return result.data.translations;
  } else {
    console.error('❌ Translation failed:', result);
    throw new Error('Translation failed');
  }
}

async function generateAudio(translations) {
  console.log('4️⃣ GENERATING SPANISH AUDIO...');
  
  // Use approved translations or high confidence ones
  const audioSegments = translations
    .filter(t => t.qaStatus === 'approved' || t.confidence > 0.8)
    .map(t => ({
      id: t.id,
      text: t.translatedText,
      startTime: translations.find(orig => orig.id === t.id)?.startTime || 0,
      endTime: translations.find(orig => orig.id === t.id)?.endTime || 5
    }));
  
  if (audioSegments.length === 0) {
    console.log('⚠️  No segments with sufficient confidence for audio generation');
    return;
  }
  
  console.log(`🎵 Generating audio for ${audioSegments.length} segments...`);
  
  const result = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/dubbing/generate-audio',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({
    videoId: 'citizen-test',
    language: 'spanish',
    voice: 'EXAVITQu4vr4xnSDxMaL', // Sarah - supports Spanish
    segments: audioSegments
  }));
  
  if (result.success) {
    console.log('✅ Audio generation successful!');
    console.log(`🎵 Generated ${result.data.segments.length} audio segments`);
    console.log('');
    
    // Save audio results
    fs.writeFileSync(path.join(__dirname, OUTPUT_DIR, 'citizen-audio.json'), 
      JSON.stringify(result, null, 2));
    
    // Create a summary report
    const summary = {
      videoFile: 'Citizen.mp4',
      processedAt: new Date().toISOString(),
      transcription: {
        language: 'english',
        segments: audioSegments.length,
        totalDuration: audioSegments.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0)
      },
      translation: {
        targetLanguage: 'spanish',
        overallConfidence: translations.reduce((sum, t) => sum + t.confidence, 0) / translations.length,
        qualityBreakdown: {
          approved: translations.filter(t => t.qaStatus === 'approved').length,
          needsReview: translations.filter(t => t.qaStatus === 'needs-review').length,
          flagged: translations.filter(t => t.qaStatus === 'flagged').length
        }
      },
      audio: {
        voice: 'Sarah (EXAVITQu4vr4xnSDxMaL)',
        segmentsGenerated: result.data.segments.length,
        totalAudioFiles: result.data.segments.length
      }
    };
    
    fs.writeFileSync(path.join(__dirname, OUTPUT_DIR, 'citizen-pipeline-summary.json'), 
      JSON.stringify(summary, null, 2));
    
    console.log('📋 PIPELINE SUMMARY:');
    console.log(`📹 Video: ${summary.videoFile}`);
    console.log(`🎯 Translation Confidence: ${(summary.translation.overallConfidence * 100).toFixed(1)}%`);
    console.log(`✅ Approved: ${summary.translation.qualityBreakdown.approved}`);
    console.log(`⚠️  Needs Review: ${summary.translation.qualityBreakdown.needsReview}`);
    console.log(`🚩 Flagged: ${summary.translation.qualityBreakdown.flagged}`);
    console.log(`🎵 Audio Files: ${summary.audio.segmentsGenerated}`);
    console.log('');
    
    return result;
  } else {
    console.error('❌ Audio generation failed:', result);
    throw new Error('Audio generation failed');
  }
}

async function runFullPipeline() {
  try {
    const videoId = await uploadVideo();
    if (!videoId) return;
    
    const segments = await transcribeVideo(videoId);
    const translations = await translateVideo(segments);
    await generateAudio(translations);
    
    console.log('🎉 PIPELINE COMPLETED SUCCESSFULLY!');
    console.log('📁 Output files saved to test_data/:');
    console.log('   - citizen-upload-response.json');
    console.log('   - citizen-transcription.json');
    console.log('   - citizen-translation.json');
    console.log('   - citizen-audio.json');
    console.log('   - citizen-pipeline-summary.json');
    console.log('');
    
  } catch (error) {
    console.error('❌ Pipeline failed:', error.message);
    process.exit(1);
  }
}

runFullPipeline();