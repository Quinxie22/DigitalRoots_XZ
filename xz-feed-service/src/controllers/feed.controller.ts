import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import axios from 'axios';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3006';
const CONTENT_SERVICE_URL = process.env.CONTENT_SERVICE_URL || 'http://localhost:3005';

export const getPersonalizedFeed = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Access denied' });
    return;
  }

  try {
    // 1. Fetch user profile
    const profileRes = await axios.get(`${USER_SERVICE_URL}/api/users/profile`, {
      headers: { Authorization: req.headers.authorization || '' }
    });
    const user = profileRes.data.user;

    // 2. Fetch posts from Content Service
    const postsRes = await axios.get(`${CONTENT_SERVICE_URL}/api/content/posts`, {
      headers: { Authorization: req.headers.authorization || '' }
    });
    const posts: any[] = postsRes.data.posts || [];

    // 3. Score and rank content
    const scoredFeed = posts.map((post) => {
      let score = 0;

      // Check category preference matches (+50)
      if (user.contentPreferences && user.contentPreferences.includes(post.category)) {
        score += 50;
      }

      // Check language match (+30)
      // Note: post might not have explicit language, check fileMetadata or assume matches user's language
      if (user.languages && post.language && user.languages.includes(post.language)) {
        score += 30;
      }

      // Check community origin match (+25)
      // Fetch author profile or check community on post if present
      if (user.community && post.authorCommunity && user.community === post.authorCommunity) {
        score += 25;
      }

      return { ...post, feedScore: score };
    }).sort((a, b) => b.feedScore - a.feedScore);

    res.status(200).json({ success: true, posts: scoredFeed });
  } catch (error: any) {
    console.error('[Feed Service] getPersonalizedFeed error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
