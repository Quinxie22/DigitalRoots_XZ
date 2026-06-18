import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { upload } from '../config/multer.config';

const router = Router();

// Internal endpoint for microservices to dispatch real-time notifications via WebSocket
router.post('/internal/notifications', (req, res) => {
  const { userId, notification } = req.body;
  const io = req.app.get('io');
  if (io && userId) {
    io.to(`user:${userId}`).emit('new-notification', notification);
    res.status(200).json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Socket server (io) or userId not found' });
  }
});

router.use(verifyToken);

router.get('/threads', ChatController.getThreads);
router.post('/threads/:targetUserId', ChatController.getOrCreateThread);
router.get('/threads/:threadId/messages', ChatController.getMessages);
router.post('/threads/:threadId/messages', ChatController.sendTextMessage);

// File archives, discussion topic, and file upload routes
router.get('/threads/:threadId/archives', ChatController.getArchives);
router.put('/threads/:threadId/topic', ChatController.updateTopic);
router.post('/threads/:threadId/upload', upload.single('file'), ChatController.uploadFile);
router.post('/threads/:threadId/voice', upload.single('file'), ChatController.sendVoiceMessage);
router.post('/threads/:threadId/read', ChatController.markRead);
router.delete('/threads/:threadId/messages/:messageId', ChatController.deleteMessage);
router.post('/threads/:threadId/report', ChatController.reportConnection);

// Generic file upload (profile picture, etc.) — returns URL only
router.post('/upload', upload.single('file'), ChatController.uploadGenericFile);

export default router;