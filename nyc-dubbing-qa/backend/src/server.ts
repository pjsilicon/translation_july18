import 'dotenv/config';
import express from 'express';
import path from 'path';

process.on('uncaughtException', (err) => {
  console.error('💥  UNCAUGHT EXCEPTION:\n', err);
  process.exit(1);
});
process.on('unhandledRejection', (err: any) => {
  console.error('💥  UNHANDLED PROMISE:\n', err);
  process.exit(1);
});

const PORT = Number(process.env.PORT) || 3001;
console.log('🔑  OPENAI_API_KEY present =', !!process.env.OPENAI_API_KEY);

const app = express();

/* ----  API ROUTES  ---- */
import routes from './routes';
app.use('/api', routes);

/* ----  React build  ---- */
const rootDir = path.resolve(
  __dirname,
  process.env.NODE_ENV === 'production' ? '..' : '../..'
);
const frontendDist = path.join(rootDir, 'frontend', 'dist');
console.log('🌐  React build folder =', frontendDist);

app.use(express.static(frontendDist));
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.includes('.')) return next();
  res.sendFile(path.join(frontendDist, 'index.html'));
});

/* ----  Start server  ---- */
app.listen(PORT, () => {
  console.log(`🚀  API + React listening ➜  http://localhost:${PORT}`);
});