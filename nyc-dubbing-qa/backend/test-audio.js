const http = require('http');

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log('Response status:', res.statusCode);
      console.log('Response headers:', res.headers);
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Response body length:', body.length);
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          console.log('Failed to parse JSON, raw response:', body.substring(0, 500));
          resolve({ error: 'Invalid JSON response', body: body.substring(0, 500) });
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

async function testAudioGeneration() {
  console.log('Testing audio generation...\n');
  
  try {
    // First, let's get available voices
    console.log('Getting available voices...');
    const voicesResult = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/dubbing/voices',
      method: 'GET'
    });
    
    console.log('Voices result:', JSON.stringify(voicesResult, null, 2));
    
    // Test audio generation with a simple translated segment
    console.log('\nTesting audio generation with translated text...');
    const audioResult = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/dubbing/generate-audio',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({
      videoId: 'cmd99n24m0001orh7cq673klq',
      language: 'spanish',
      voice: 'EXAVITQu4vr4xnSDxMaL', // Sarah - supports Spanish
      segments: [
        {
          id: 1,
          text: "No basta con traducir su video.",
          startTime: 4.619999885559082,
          endTime: 6
        }
      ]
    }));
    
    console.log('\nAudio generation result:', JSON.stringify(audioResult, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAudioGeneration();