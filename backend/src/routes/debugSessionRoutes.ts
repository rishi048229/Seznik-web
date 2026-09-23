import express from 'express';
import { protect } from '../middlewares/authMiddleware';
import { debugFa19Log } from '../utils/debugFa19Log';

const router = express.Router();

router.post('/log', protect, (req, res) => {
  const body = req.body as Record<string, unknown>;
  debugFa19Log({
    location: String(body.location || 'client'),
    message: String(body.message || 'client-log'),
    hypothesisId: body.hypothesisId ? String(body.hypothesisId) : undefined,
    runId: body.runId ? String(body.runId) : undefined,
    data: {
      ...(typeof body.data === 'object' && body.data ? (body.data as Record<string, unknown>) : {}),
      actorId: (req as any).user?.id,
      role: (req as any).user?.role,
    },
  });
  res.json({ ok: true });
});

export default router;
