import { Router, Response } from 'express';
import prisma from '../config/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/history - List import batches for user
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const batches = await prisma.importBatch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, batches });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch import history.' });
  }
});

// GET /api/history/:id - Single batch details
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const batchId = req.params.id as string;
    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, userId: req.user!.id },
    });

    if (!batch) {
      res.status(404).json({ success: false, message: 'Import batch not found.' });
      return;
    }

    res.json({ success: true, batch });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch batch details.' });
  }
});

export default router;
