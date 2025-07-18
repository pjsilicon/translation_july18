const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function uploadVideo() {
  console.log('Testing video upload...\n');
  
  const videoPath = path.join(__dirname, '..', 'test_data', 'testvid.mp4');
  
  if (!fs.existsSync(videoPath)) {
    console.error('Test video not found at:', videoPath);
    return;
  }
  
  console.log('Video file found:', videoPath);
  console.log('File size:', fs.statSync(videoPath).size, 'bytes\n');
  
  const form = new FormData();
  form.append('video', fs.createReadStream(videoPath));
  form.append('title', 'Test Upload');
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/videos/upload',
    method: 'POST',
    headers: form.getHeaders()
  };
  
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
    
    form.pipe(req);
  });
}

uploadVideo().then(result => {
  console.log('\nFinal result:', JSON.stringify(result, null, 2));
}).catch(error => {
  console.error('Upload failed:', error);
});