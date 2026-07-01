import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../xz-content-service/src/app';
import { Post } from '../../xz-content-service/src/models/post.model';
import connectMongoDB from '../../xz-content-service/src/config/mongodb';
jest.setTimeout(30000);

describe('Content Posts API Integration Tests', () => {
  let postId: string;
  const user1 = 'test-content-user-1';
  const user2 = 'test-content-user-2';

  // Valid 1x1 transparent PNG hex code
  const dummyPng = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63606060000000050001a5f3df7f0000000049454e44ae426082',
    'hex'
  );

  beforeAll(async () => {
    console.log('--- STARTING BEFORE ALL ---');
    process.env.MONGODB_URI = 'mongodb://localhost:27017';
    process.env.MONGODB_DB = 'xz_content_db_test';
    
    console.log(`Connecting to Mongo...`);
    try {
      await connectMongoDB();
      console.log('Connected to Mongo successfully!');
      
      console.log('Clearing Post collection...');
      await Post.deleteMany({});
      console.log('Post collection cleared!');
    } catch (err) {
      console.error('Error in beforeAll:', err);
    }
    console.log('--- BEFORE ALL FINISHED ---');
  });

  afterAll(async () => {
    console.log('--- STARTING AFTER ALL ---');
    try {
      console.log('Cleaning up Post collection...');
      await Post.deleteMany({});
      console.log('Closing mongoose connection...');
      await Post.db.close();
      console.log('Mongoose connection closed!');
    } catch (err) {
      console.error('Error in afterAll:', err);
    }
    console.log('--- AFTER ALL FINISHED ---');
  });

  describe('POST /api/content/posts/text', () => {
    it('should create a text post successfully', async () => {
      const res = await request(app)
        .post('/api/content/posts/text')
        .set('x-user-id', user1)
        .set('x-user-role', 'Elder')
        .set('x-user-email', 'user1@example.com')
        .set('x-user-name', 'User One')
        .send({
          content: 'This is a test post for generational wisdom.',
          categories: ['Cultural', 'Traditional'],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.post).toHaveProperty('postId');
      expect(res.body.post.content).toBe('This is a test post for generational wisdom.');
      expect(res.body.post.authorId).toBe(user1);
      expect(res.body.post.type).toBe('text');
      
      postId = res.body.post.postId;
    });

    it('should fail if content is missing', async () => {
      await request(app)
        .post('/api/content/posts/text')
        .set('x-user-id', user1)
        .send({
          categories: ['Cultural'],
        })
        .expect(400);
    });
  });

  describe('POST /api/content/posts/media', () => {
    it('should create a media post with multiple files (multi-upload)', async () => {
      const res = await request(app)
        .post('/api/content/posts/media')
        .set('x-user-id', user1)
        .set('x-user-role', 'Youth')
        .set('x-user-email', 'user1@example.com')
        .set('x-user-name', 'User One')
        .field('content', 'Sharing some photos from the traditional ceremony')
        .field('categories', JSON.stringify(['Traditional']))
        .attach('file', dummyPng, 'photo1.png')
        .attach('file', dummyPng, 'photo2.png')
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.post).toHaveProperty('postId');
      expect(res.body.post.mediaUrls).toHaveLength(2);
      expect(res.body.post.type).toBe('image');
    });
  });

  describe('POST /api/content/posts/:postId/comments', () => {
    it('should add a comment to the post', async () => {
      const res = await request(app)
        .post(`/api/content/posts/${postId}/comments`)
        .set('x-user-id', user2)
        .set('x-user-role', 'Youth')
        .set('x-user-email', 'user2@example.com')
        .set('x-user-name', 'User Two')
        .send({
          text: 'Thank you for sharing this wisdom!',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.comment).toHaveProperty('_id');
      expect(res.body.comment.text).toBe('Thank you for sharing this wisdom!');
      expect(res.body.comment.userId).toBe(user2);
    });

    it('should fail if comment text is missing', async () => {
      await request(app)
        .post(`/api/content/posts/${postId}/comments`)
        .set('x-user-id', user2)
        .send({
          text: '',
        })
        .expect(400);
    });
  });

  describe('POST /api/content/posts/:postId/reactions', () => {
    it('should react to the post (like)', async () => {
      const res = await request(app)
        .post(`/api/content/posts/${postId}/reactions`)
        .set('x-user-id', user2)
        .send({
          type: 'like',
        })
        .expect(200);

      console.log('REACTION BODY IN TEST:', JSON.stringify(res.body));

      expect(res.body.success).toBe(true);
      const likeReaction = res.body.reactions.find((r: any) => r.type === 'like');
      expect(likeReaction).toBeDefined();
      expect(likeReaction.userIds).toContain(user2);
    });
  });

  describe('POST /api/content/posts/:postId/flag', () => {
    it('should flag the post as inappropriate', async () => {
      const res = await request(app)
        .post(`/api/content/posts/${postId}/flag`)
        .set('x-user-id', user2)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Content successfully flagged');

      // Verify isFlagged is true in database
      const dbPost = await Post.findOne({ postId });
      expect(dbPost?.isFlagged).toBe(true);
    });
  });
});
