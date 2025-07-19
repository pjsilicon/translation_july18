import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import projectRoutes from './project.routes';
import videoRoutes from './video.routes';
import translationRoutes from './translation.routes';
import dubbingRoutes from './dubbing.routes';
import qaRoutes from './qa.routes';

const router = Router();

// Health check endpoint
router.get('/healthz', (_req, res) => res.json({ ok: true, when: new Date().toISOString() }));

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/videos', videoRoutes);
router.use('/translation', translationRoutes);
router.use('/dubbing', dubbingRoutes);
router.use('/qa', qaRoutes);

// API documentation endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'NYC Dubbing QA Platform API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      projects: '/api/projects',
      videos: '/api/videos',
      dubbing: '/api/dubbing',
      qa: '/api/qa',
      health: '/health'
    }
  });
});

export default router;