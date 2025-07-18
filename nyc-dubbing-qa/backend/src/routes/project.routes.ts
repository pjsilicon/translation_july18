import { Router } from 'express';

const router = Router();

// GET /api/projects
router.get('/', (req, res) => {
  res.json({ message: 'List projects endpoint - to be implemented' });
});

// POST /api/projects
router.post('/', (req, res) => {
  res.json({ message: 'Create project endpoint - to be implemented' });
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  res.json({ message: 'Get project endpoint - to be implemented' });
});

// PUT /api/projects/:id
router.put('/:id', (req, res) => {
  res.json({ message: 'Update project endpoint - to be implemented' });
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  res.json({ message: 'Delete project endpoint - to be implemented' });
});

export default router;