import { Router } from 'express';
import { awardPoints, getHistory } from '../controllers/point.controller';

const router = Router();

router.post('/award', awardPoints);
router.get('/:userId/history', getHistory);

export default router;
