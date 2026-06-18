import { Router } from 'express';
import {
  proposeInterview,
  confirmInterview,
  completeInterview,
  requestMentoring,
  acceptMentoring,
  getMentoringMatches,
  getInterviews,
  getMentoringPairs,
  cancelMentoring
} from '../controllers/session.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/interviews', verifyToken as any, proposeInterview);
router.put('/interviews/:interviewId/confirm', verifyToken as any, confirmInterview);
router.put('/interviews/:interviewId/complete', verifyToken as any, completeInterview);
router.get('/interviews', verifyToken as any, getInterviews);

router.post('/mentoring', verifyToken as any, requestMentoring);
router.put('/mentoring/:pairingId/accept', verifyToken as any, acceptMentoring);
router.get('/mentoring/matches', verifyToken as any, getMentoringMatches);
router.get('/mentoring/pairs', verifyToken as any, getMentoringPairs);
router.delete('/mentoring/:pairingId', verifyToken as any, cancelMentoring);

export default router;
