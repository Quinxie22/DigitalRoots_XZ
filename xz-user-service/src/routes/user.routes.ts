import { Router } from 'express';
import { 
  register, login, getProfile, verify, getAllUsers, updateProfile, 
  updatePointsAndBadges, createAdmin, firebaseLogin, updateUserStatus, updateUserRole 
} from '../controllers/user.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/firebase-login', firebaseLogin);          // Firebase Auth (Email/Password + Google)
router.post('/admins', verifyToken as any, requireRole(['Admin']) as any, createAdmin as any);
router.get('/', verifyToken as any, getAllUsers as any);
router.get('/profile', verifyToken as any, getProfile as any);
router.put('/profile', verifyToken as any, updateProfile as any);
router.put('/:userId/rewards', updatePointsAndBadges as any);
router.get('/verify', verifyToken as any, verify as any);

router.put('/:userId/status', verifyToken as any, requireRole(['Admin']) as any, updateUserStatus as any);
router.put('/:userId/role', verifyToken as any, requireRole(['Admin']) as any, updateUserRole as any);

export default router;

