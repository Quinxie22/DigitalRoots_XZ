import { Router } from 'express';
import { ModerationController } from '../controllers/moderation.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Secure all endpoints under this router as Admin only
router.use(verifyToken, requireRole(['Admin']));

router.get('/flagged', ModerationController.getFlaggedPosts);
router.put('/posts/:postId/hide', ModerationController.hidePost);
router.get('/analytics', ModerationController.getContentAnalytics);
router.get('/audit-log', ModerationController.getAuditLog);
router.post('/ban', ModerationController.banUser);

export default router;
