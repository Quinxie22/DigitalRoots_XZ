import { Server, Socket } from 'socket.io';
import { ChatService } from '../services/chat.service';
import { Message } from '../models/message.model';
import logger from '../utils/logger';

// Track online users: Map<userId, Set<socketId>>
const onlineUsers = new Map<string, Set<string>>();

export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers.keys());
}

export function isUserOnline(userId: string): boolean {
  const sockets = onlineUsers.get(userId);
  return sockets !== undefined && sockets.size > 0;
}

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket: any) => {
    const userId = socket.user?.firebase_uid;
    logger.info(`User ${userId} connected`);
    
    socket.join(`user:${userId}`);

    // ── Online Presence ──────────────────────────────────────────
    // Register user as online
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Broadcast updated presence to everyone
    io.emit('presence-update', {
      userId,
      status: 'online',
      onlineUsers: getOnlineUsers(),
    });

    // When a new client connects, send them the full online list
    socket.emit('presence-list', { onlineUsers: getOnlineUsers() });
    
    socket.on('join-thread', (threadId: string) => {
      socket.join(`thread:${threadId}`);
    });
    
    socket.on('send-message', async (data: { threadId: string; content: string }, callback: any) => {
      try {
        const message = await ChatService.sendTextMessage(data.threadId, userId, data.content);
        io.to(`thread:${data.threadId}`).emit('new-message', message);
        callback({ success: true, message });
      } catch (error: any) {
        callback({ success: false, error: error.message });
      }
    });

    // ── Typing Indicators ────────────────────────────────────────
    socket.on('typing-start', (data: { threadId: string }) => {
      socket.to(`thread:${data.threadId}`).emit('user-typing', {
        userId,
        threadId: data.threadId,
      });
    });

    socket.on('typing-stop', (data: { threadId: string }) => {
      socket.to(`thread:${data.threadId}`).emit('user-stopped-typing', {
        userId,
        threadId: data.threadId,
      });
    });

    // ── Message Deletion ─────────────────────────────────────────
    socket.on('delete-message', async (data: { threadId: string; messageId: string }, callback?: any) => {
      try {
        const msg = await Message.findOne({ messageId: data.messageId, threadId: data.threadId });
        if (!msg) {
          if (callback) callback({ success: false, error: 'Message not found' });
          return;
        }
        if (msg.senderId !== userId) {
          if (callback) callback({ success: false, error: 'Cannot delete messages from other users' });
          return;
        }

        msg.isDeleted = true;
        msg.deletedAt = new Date();
        msg.content = 'This message was deleted';
        await msg.save();

        io.to(`thread:${data.threadId}`).emit('message-deleted', {
          threadId: data.threadId,
          messageId: data.messageId,
        });

        if (callback) callback({ success: true });
      } catch (error: any) {
        logger.error('Error deleting message:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // --- WebRTC Video Call Signaling Handlers ---

    // Join the call room
    socket.on('join-call', (data: { threadId: string }) => {
      logger.info(`User ${userId} joined call room call:${data.threadId}`);
      socket.join(`call:${data.threadId}`);
      // Notify other participants in the call room
      socket.to(`call:${data.threadId}`).emit('user-joined-call', { userId });
    });

    // Leave the call room
    socket.on('leave-call', (data: { threadId: string }) => {
      logger.info(`User ${userId} left call room call:${data.threadId}`);
      socket.leave(`call:${data.threadId}`);
      // Notify other participants
      socket.to(`call:${data.threadId}`).emit('user-left-call', { userId });
    });

    // Relay WebRTC SDP Offer
    socket.on('webrtc-offer', (data: { threadId: string; targetUserId: string; offer: any }) => {
      logger.info(`Relaying WebRTC offer from ${userId} to ${data.targetUserId} for thread ${data.threadId}`);
      io.to(`user:${data.targetUserId}`).emit('webrtc-offer', {
        senderId: userId,
        offer: data.offer,
        threadId: data.threadId,
      });
    });

    // Relay WebRTC SDP Answer
    socket.on('webrtc-answer', (data: { threadId: string; targetUserId: string; answer: any }) => {
      logger.info(`Relaying WebRTC answer from ${userId} to ${data.targetUserId} for thread ${data.threadId}`);
      io.to(`user:${data.targetUserId}`).emit('webrtc-answer', {
        senderId: userId,
        answer: data.answer,
        threadId: data.threadId,
      });
    });

    // Relay ICE Candidate
    socket.on('webrtc-candidate', (data: { threadId: string; targetUserId: string; candidate: any }) => {
      io.to(`user:${data.targetUserId}`).emit('webrtc-candidate', {
        senderId: userId,
        candidate: data.candidate,
        threadId: data.threadId,
      });
    });

    // Sync Audio/Microphone Toggle state
    socket.on('toggle-audio', (data: { threadId: string; isMuted: boolean }) => {
      socket.to(`call:${data.threadId}`).emit('user-audio-toggled', {
        userId,
        isMuted: data.isMuted,
      });
    });

    // Sync Video/Camera Toggle state
    socket.on('toggle-video', (data: { threadId: string; isVideoOff: boolean }) => {
      socket.to(`call:${data.threadId}`).emit('user-video-toggled', {
        userId,
        isVideoOff: data.isVideoOff,
      });
    });

    // Sync Call Recording Toggle state
    socket.on('toggle-recording', (data: { threadId: string; isRecording: boolean }) => {
      io.to(`call:${data.threadId}`).emit('recording-toggled', {
        userId,
        isRecording: data.isRecording,
      });
    });

    // Send Live Captions / Speech-to-Text Transcripts in call
    socket.on('send-caption', (data: { threadId: string; text: string }) => {
      io.to(`call:${data.threadId}`).emit('new-caption', {
        senderId: userId,
        text: data.text,
        timestamp: new Date(),
      });
    });

    // End call completely
    socket.on('end-call-session', (data: { threadId: string }) => {
      logger.info(`Call session ended for thread ${data.threadId} by user ${userId}`);
      io.to(`call:${data.threadId}`).emit('call-ended', { userId });
    });
    
    socket.on('disconnect', () => {
      logger.info(`User ${userId} disconnected`);

      // Remove socket from the online set
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Only broadcast offline if user has no remaining sockets
          io.emit('presence-update', {
            userId,
            status: 'offline',
            onlineUsers: getOnlineUsers(),
          });
        }
      }
    });
  });
};