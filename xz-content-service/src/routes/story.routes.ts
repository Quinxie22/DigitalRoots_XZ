import { Router } from 'express';
import { StoryController } from '../controllers/story.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { handleSingleUpload } from '../middleware/upload.middleware';
import { cacheMiddleware } from '../middleware/cache.middleware';
import { validateStoryUpload } from '../validators/story.validator';

const router = Router();

// Stories list cache - 5 minutes
router.get('/', verifyToken, cacheMiddleware(300, 'stories'), StoryController.getStories);

router.post('/upload', verifyToken, requireRole(['Elder', 'Youth', 'Admin']), handleSingleUpload('file'), validateStoryUpload, StoryController.uploadStory);
router.get('/:storyId', verifyToken, StoryController.getStory);
router.get('/:storyId/transcription', verifyToken, StoryController.getTranscriptionStatus);
router.post('/:storyId/translate', verifyToken, StoryController.translateTranscript);
router.get('/:storyId/transcript/download', verifyToken, StoryController.downloadTranscript);

router.post('/:storyId/like', verifyToken, StoryController.likeStory);
router.delete('/:storyId/like', verifyToken, StoryController.unlikeStory);

// Admin-only endpoints
router.put('/:storyId/approve', verifyToken, requireRole(['Admin']), StoryController.approveStory);
router.put('/:storyId/reject', verifyToken, requireRole(['Admin']), StoryController.rejectStory);
router.post('/bulk-approve', verifyToken, requireRole(['Admin']), StoryController.bulkApproveStories);
router.delete('/:storyId', verifyToken, requireRole(['Admin']), StoryController.deleteStory);

export default router;
