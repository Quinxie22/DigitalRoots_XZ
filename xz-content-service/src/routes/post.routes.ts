import { Router } from 'express';
import { PostController } from '../controllers/post.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { handleSingleUpload, handleMultipleUpload } from '../middleware/upload.middleware';
import { cacheMiddleware } from '../middleware/cache.middleware';
import { validatePostCreate, validateCommentCreate } from '../validators/post.validator';

const router = Router();

// Feed caching - 5 minutes
router.get('/feed', verifyToken, cacheMiddleware(300, 'feed'), PostController.getFeed);

router.post('/text', verifyToken, validatePostCreate, PostController.createTextPost);
router.post('/media', verifyToken, handleMultipleUpload('file', 10), validatePostCreate, PostController.createMediaPost);

router.get('/:postId', verifyToken, PostController.getPost);
router.put('/:postId', verifyToken, handleSingleUpload('file'), validatePostCreate, PostController.editPost);
router.delete('/:postId', verifyToken, PostController.deletePost);

router.post('/:postId/comments', verifyToken, validateCommentCreate, PostController.addComment);
router.delete('/:postId/comments/:commentId', verifyToken, PostController.deleteComment);
router.post('/:postId/comments/:commentId/like', verifyToken, PostController.likeComment);

router.post('/:postId/reactions', verifyToken, PostController.addReaction);
router.delete('/:postId/reactions', verifyToken, PostController.removeReaction);

router.post('/:postId/share', verifyToken, PostController.sharePost);
router.post('/:postId/flag', verifyToken, PostController.flagPost);

export default router;
