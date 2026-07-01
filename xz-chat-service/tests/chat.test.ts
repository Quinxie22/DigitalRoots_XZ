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

  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'xz_jwt_secret_shared_2026_key';
  const token1 = jwt.sign({ id: user1, email: 'user1@example.com', role: 'Elder', name: 'User One' }, secret);
  const token2 = jwt.sign({ id: user2, email: 'user2@example.com', role: 'Youth', name: 'User Two' }, secret);

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
    try {
      const { Report } = await import('../src/models/report.model');
      await Report.deleteMany({});
    } catch (e) {}
  });

  afterAll(async () => {
    // Cleanup and close database connection
    await Message.deleteMany({});
    await Thread.deleteMany({});
    try {
      const { Report } = await import('../src/models/report.model');
      await Report.deleteMany({});
    } catch (e) {}
    await mongoose.connection.close();
  });

  describe('POST /api/chat/threads/:targetUserId', () => {
    it('should create or retrieve a chat thread between two users', async () => {
      const res = await request(app)
        .post(`/api/chat/threads/${user2}`)
        .set('Authorization', `Bearer ${token1}`)
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
        .set('Authorization', `Bearer ${token1}`)
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
        .set('Authorization', `Bearer ${token2}`)
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
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(res.body).toHaveProperty('updated');
      expect(res.body.updated).toBeGreaterThan(0);

      // Verify readBy contains user2 in DB
      const updatedMsg = await Message.findOne({ threadId });
      expect(updatedMsg?.readBy).toContain(user2);
    });
  });

  describe('POST /api/chat/threads/:threadId/report', () => {
    it('should save a report of the connection between the users', async () => {
      const res = await request(app)
        .post(`/api/chat/threads/${threadId}/report`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ reason: 'Inappropriate discussion topic' })
        .expect(201);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('reportId');

      // Verify Report is in DB
      const { Report } = await import('../src/models/report.model');
      const savedReport = await Report.findOne({ threadId, reporterId: user1 });
      expect(savedReport).toBeDefined();
      expect(savedReport?.reason).toBe('Inappropriate discussion topic');
      expect(savedReport?.reportedUserId).toBe(user2);
    });

    it('should fail if reason is missing or empty', async () => {
      await request(app)
        .post(`/api/chat/threads/${threadId}/report`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ reason: '' })
        .expect(400);
    });
  });

  describe('GET /api/chat/download', () => {
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(__dirname, '../public/uploads');
    const testFile = path.join(uploadDir, 'test-download.txt');

    beforeAll(() => {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(testFile, 'Test download file content');
    });

    afterAll(() => {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it('should download a local file with the preserved custom filename', async () => {
      const res = await request(app)
        .get('/api/chat/download')
        .set('Authorization', `Bearer ${token1}`)
        .query({
          url: '/uploads/test-download.txt',
          filename: 'original-name.txt'
        })
        .expect(200);

      expect(res.header['content-disposition']).toBe('attachment; filename="original-name.txt"');
      expect(res.text).toBe('Test download file content');
    });

    it('should fail download if url is missing', async () => {
      await request(app)
        .get('/api/chat/download')
        .set('Authorization', `Bearer ${token1}`)
        .query({
          filename: 'original-name.txt'
        })
        .expect(400);
    });

    it('should fail download if unauthorized', async () => {
      await request(app)
        .get('/api/chat/download')
        .query({
          url: '/uploads/test-download.txt',
          filename: 'original-name.txt'
        })
        .expect(401);
    });
  });
});
