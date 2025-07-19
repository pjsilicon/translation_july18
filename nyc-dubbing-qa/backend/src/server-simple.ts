import 'dotenv/config';
import express from 'express';
import path from 'path';

const PORT = Number(process.env.PORT) || 3001;
console.log('🔑  OPENAI_API_KEY present =', !!process.env.OPENAI_API_KEY);

const app = express();

// Basic health check
app.get('/api/healthz', (_req, res) => {
  res.json({ ok: true, when: new Date().toISOString() });
});

// Serve React build
const rootDir = path.resolve(__dirname, process.env.NODE_ENV === 'production' ? '..' : '../..');
const frontendDist = path.join(rootDir, 'frontend', 'dist');
console.log('🌐  React build folder =', frontendDist);

app.use(express.static(frontendDist));

// Catch-all for React routes - using middleware instead of route
app.use((req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Start server with explicit host binding
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀  Server listening on ALL interfaces`);
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Network:  http://0.0.0.0:${PORT}`);
});

// Keep server alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
  });
});