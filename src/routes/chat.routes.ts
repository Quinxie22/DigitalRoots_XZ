import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { upload } from '../config/multer.config';

const router = Router();

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

export default router;