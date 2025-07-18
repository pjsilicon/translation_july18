const http = require('http');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api';

// First, let's manually upload and check each step
async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
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

async function testTranscription() {
  console.log('Testing transcription with already uploaded video...\n');
  
  // Use the video ID from our previous successful upload
  const videoId = '083abd36-05f9-407c-9fa0-2506ba1725ee';
  
  try {
    // Test transcription
    console.log('Testing transcription endpoint...');
    const result = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/videos/${videoId}/transcribe`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({
      prompt: 'Test transcription'
    }));
    
    console.log('Transcription result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testTranscription();