const http = require('http');

const videoId = 'cmd99n24m0001orh7cq673klq'; // From our successful upload

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log('Response status:', res.statusCode);
      console.log('Response headers:', res.headers);
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Response body:', body);
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          console.log('Failed to parse JSON, raw response:', body);
          resolve({ error: 'Invalid JSON response', body });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

async function testTranscription() {
  console.log('Testing transcription for video ID:', videoId, '\n');
  
  try {
    // Test transcription
    console.log('Calling transcription endpoint...');
    const result = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/videos/${videoId}/transcribe`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({
      prompt: 'Transcribe this government announcement video'
    }));
    
    console.log('\nTranscription result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testTranscription();