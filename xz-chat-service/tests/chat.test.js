"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("../src/app");
const message_model_1 = require("../src/models/message.model");
const thread_model_1 = require("../src/models/thread.model");
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
    let threadId;
    const user1 = 'test-user-1';
    const user2 = 'test-user-2';
    beforeAll(async () => {
        // Connect to test MongoDB database
        const uri = process.env.mongodb_uri || 'mongodb://localhost:27017';
        const dbName = 'xz_chat_db_test';
        if (mongoose_1.default.connection.readyState === 0) {
            await mongoose_1.default.connect(`${uri}/${dbName}`);
        }
        // Clear test database collections
        await message_model_1.Message.deleteMany({});
        await thread_model_1.Thread.deleteMany({});
        try {
            const { Report } = await Promise.resolve().then(() => __importStar(require('../src/models/report.model')));
            await Report.deleteMany({});
        }
        catch (e) { }
    });
    afterAll(async () => {
        // Cleanup and close database connection
        await message_model_1.Message.deleteMany({});
        await thread_model_1.Thread.deleteMany({});
        try {
            const { Report } = await Promise.resolve().then(() => __importStar(require('../src/models/report.model')));
            await Report.deleteMany({});
        }
        catch (e) { }
        await mongoose_1.default.connection.close();
    });
    describe('POST /api/chat/threads/:targetUserId', () => {
        it('should create or retrieve a chat thread between two users', async () => {
            const res = await (0, supertest_1.default)(app_1.app)
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
            const res = await (0, supertest_1.default)(app_1.app)
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
            const res = await (0, supertest_1.default)(app_1.app)
                .get(`/api/chat/threads/${threadId}/messages`)
                .set('Authorization', `Bearer ${user2}`)
                .expect(200);
            expect(res.body).toHaveProperty('messages');
            expect(res.body.messages.length).toBeGreaterThan(0);
            // Verify message was marked as delivered to user2
            const updatedMsg = await message_model_1.Message.findOne({ threadId });
            expect(updatedMsg?.deliveredTo).toContain(user2);
        });
    });
    describe('POST /api/chat/threads/:threadId/read', () => {
        it('should mark messages in the thread as read by the recipient', async () => {
            const res = await (0, supertest_1.default)(app_1.app)
                .post(`/api/chat/threads/${threadId}/read`)
                .set('Authorization', `Bearer ${user2}`)
                .expect(200);
            expect(res.body).toHaveProperty('updated');
            expect(res.body.updated).toBeGreaterThan(0);
            // Verify readBy contains user2 in DB
            const updatedMsg = await message_model_1.Message.findOne({ threadId });
            expect(updatedMsg?.readBy).toContain(user2);
        });
    });
    describe('POST /api/chat/threads/:threadId/report', () => {
        it('should save a report of the connection between the users', async () => {
            const res = await (0, supertest_1.default)(app_1.app)
                .post(`/api/chat/threads/${threadId}/report`)
                .set('Authorization', `Bearer ${user1}`)
                .send({ reason: 'Inappropriate discussion topic' })
                .expect(201);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('reportId');
            // Verify Report is in DB
            const { Report } = await Promise.resolve().then(() => __importStar(require('../src/models/report.model')));
            const savedReport = await Report.findOne({ threadId, reporterId: user1 });
            expect(savedReport).toBeDefined();
            expect(savedReport?.reason).toBe('Inappropriate discussion topic');
            expect(savedReport?.reportedUserId).toBe(user2);
        });
        it('should fail if reason is missing or empty', async () => {
            await (0, supertest_1.default)(app_1.app)
                .post(`/api/chat/threads/${threadId}/report`)
                .set('Authorization', `Bearer ${user1}`)
                .send({ reason: '' })
                .expect(400);
        });
    });
});
