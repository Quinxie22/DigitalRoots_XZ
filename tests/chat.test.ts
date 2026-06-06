import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app';
import { Message } from '../src/models/message.model';
import { Thread } from '../src/models/thread.model';

// Mock Redis to prevent real connection attempts during tests
jest.mock('../src/config/redis', () => {
  return {
    __esModule: true,
    default: {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      on: jest.fn(),
    },
  };
});

describe('Chat API Integration Tests', () => {
  let threadId: string;
  const user1 = 'test-user-1';
  const user2 = 'test-user-2';

  beforeAll(async () => {
    // Connect to test MongoDB database
    const uri = process.env.mongodb_uri || 'mongodb://localhost:27017';
    const dbName = 'xz_chat_db_test';
    
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(`${uri}/${dbName}`);
    }
    
    // Clear test database collections
    await Message.deleteMany({});
    await Thread.deleteMany({});
  });

  afterAll(async () => {
    // Cleanup and close database connection
    await Message.deleteMany({});
    await Thread.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/chat/threads/:targetUserId', () => {
    it('should create or retrieve a chat thread between two users', async () => {
      const res = await request(app)
        .post(`/api/chat/threads/${user2}`)
        .set('Authorization', `Bearer ${user1}`)
        .expect(200);

      expect(res.body).toHaveProperty('threadId');
      expect(res.body.participants).toContain(user1);
      expect(res.body.participants).toContain(user2);
      threadId = res.body.threadId;
    });
  });

  describe('POST /api/chat/threads/:threadId/messages', () => {
    it('should send a text message to the thread', async () => {
      const res = await request(app)
        .post(`/api/chat/threads/${threadId}/messages`)
        .set('Authorization', `Bearer ${user1}`)
        .send({ content: 'Hello user 2!' })
        .expect(201);

      expect(res.body).toHaveProperty('messageId');
      expect(res.body.content).toBe('Hello user 2!');
      expect(res.body.senderId).toBe(user1);
      expect(res.body.readBy).toContain(user1);
      expect(res.body.deliveredTo).toContain(user1);
    });
  });

  describe('GET /api/chat/threads/:threadId/messages', () => {
    it('should fetch messages and mark them as delivered to the other user', async () => {
      const res = await request(app)
        .get(`/api/chat/threads/${threadId}/messages`)
        .set('Authorization', `Bearer ${user2}`)
        .expect(200);

      expect(res.body).toHaveProperty('messages');
      expect(res.body.messages.length).toBeGreaterThan(0);
      
      // Verify message was marked as delivered to user2
      const updatedMsg = await Message.findOne({ threadId });
      expect(updatedMsg?.deliveredTo).toContain(user2);
    });
  });

  describe('POST /api/chat/threads/:threadId/read', () => {
    it('should mark messages in the thread as read by the recipient', async () => {
      const res = await request(app)
        .post(`/api/chat/threads/${threadId}/read`)
        .set('Authorization', `Bearer ${user2}`)
        .expect(200);

      expect(res.body).toHaveProperty('updated');
      expect(res.body.updated).toBeGreaterThan(0);

      // Verify readBy contains user2 in DB
      const updatedMsg = await Message.findOne({ threadId });
      expect(updatedMsg?.readBy).toContain(user2);
    });
  });
});
