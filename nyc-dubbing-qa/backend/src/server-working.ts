import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Log environment status
console.log('🔧 Server Configuration:');
console.log('   PORT:', PORT);
console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Present' : '❌ Missing');

// Essential middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true
}));
app.use(express.json());

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/healthz', (req, res) => {
  res.json({ 
    ok: true, 
    when: new Date().toISOString() 
  });
});

// Simple API test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!',
    env: {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasGoogleAPI: !!process.env.GOOGLE_API_KEY,
      hasElevenLabs: !!process.env.ELEVENLABS_API_KEY
    }
  });
});

// Serve React static files
const frontendPath = path.join(__dirname, '../../frontend/dist');
console.log('📁 Frontend path:', frontendPath);

// Check if frontend build exists
const fs = require('fs');
if (fs.existsSync(frontendPath)) {
  console.log('✅ Frontend build found');
  app.use(express.static(frontendPath));
  
  // Catch-all route for React - MUST be last
  app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Frontend build not found. Run: cd ../frontend && npm run build');
    }
  });
} else {
  console.log('❌ Frontend build NOT found at:', frontendPath);
  app.get('*', (req, res) => {
    res.status(404).json({ 
      error: 'Frontend not built',
      message: 'Please run: cd frontend && npm run build',
      lookedIn: frontendPath
    });
  });
}

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🚀 Server is running!');
  console.log('   Local:    http://localhost:' + PORT);
  console.log('   Network:  http://0.0.0.0:' + PORT);
  console.log('');
  console.log('📍 Test endpoints:');
  console.log('   Health:   http://localhost:' + PORT + '/health');
  console.log('   API Test: http://localhost:' + PORT + '/api/test');
  console.log('   React App: http://localhost:' + PORT);
  console.log('');
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});