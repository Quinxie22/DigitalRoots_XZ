import { Router } from 'express';
import { getPersonalizedFeed } from '../controllers/feed.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/personalized', verifyToken as any, getPersonalizedFeed);

export default router;
