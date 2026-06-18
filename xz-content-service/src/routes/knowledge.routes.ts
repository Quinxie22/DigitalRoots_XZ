import { Router } from 'express';
import { KnowledgeController } from '../controllers/knowledge.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { handleSingleUpload } from '../middleware/upload.middleware';
import { cacheMiddleware } from '../middleware/cache.middleware';
import { validateArticleCreate } from '../validators/knowledge.validator';

const router = Router();

router.get('/', verifyToken, cacheMiddleware(300, 'knowledge-list'), KnowledgeController.getArticles);
router.get('/search', verifyToken, cacheMiddleware(600, 'knowledge-search'), KnowledgeController.searchArticles);
router.get('/bookmarks', verifyToken, KnowledgeController.getBookmarks);

// Single article cached for 1 hour
router.get('/:knowledgeId', verifyToken, cacheMiddleware(3600, 'knowledge-single'), KnowledgeController.getArticle);

router.post('/', verifyToken, handleSingleUpload('file'), validateArticleCreate, KnowledgeController.createArticle);
router.put('/:knowledgeId', verifyToken, handleSingleUpload('file'), validateArticleCreate, KnowledgeController.editArticle);
router.delete('/:knowledgeId', verifyToken, KnowledgeController.deleteArticle);

router.post('/:knowledgeId/like', verifyToken, KnowledgeController.likeArticle);
router.delete('/:knowledgeId/like', verifyToken, KnowledgeController.unlikeArticle);

router.post('/:knowledgeId/bookmark', verifyToken, KnowledgeController.bookmarkArticle);
router.delete('/:knowledgeId/bookmark', verifyToken, KnowledgeController.unbookmarkArticle);

// Admin-only endpoints
router.put('/:knowledgeId/publish', verifyToken, requireRole(['Admin']), KnowledgeController.publishArticle);
router.put('/:knowledgeId/feature', verifyToken, requireRole(['Admin']), KnowledgeController.featureArticle);

export default router;
