import { Router } from 'express';
import { CommunityController } from '../controllers/community.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.use(verifyToken);

router.post('/', CommunityController.createCommunity);
router.get('/', CommunityController.getCommunities);
router.get('/my', CommunityController.getMyCommunities);

router.get('/:communityId', CommunityController.getCommunity);
router.post('/:communityId/join', CommunityController.joinCommunity);
router.post('/:communityId/leave', CommunityController.leaveCommunity);

router.get('/:communityId/posts', CommunityController.getCommunityPosts);
router.post('/:communityId/posts', CommunityController.createCommunityPost);

export default router;
