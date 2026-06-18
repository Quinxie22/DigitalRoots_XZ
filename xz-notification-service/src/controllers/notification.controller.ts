import { Request, Response } from 'express';
import { Notification } from '../models/notification.model';
import { v4 as uuidv4 } from 'uuid';

export const createNotification = async (req: Request, res: Response): Promise<void> => {
  const { userId, title, message, type, referenceId } = req.body;

  if (!userId || !title || !message || !type) {
    res.status(400).json({ error: 'Validation Error', message: 'userId, title, message, and type are required' });
    return;
  }

  try {
    const notification = new Notification({
      notificationId: uuidv4(),
      userId,
      title,
      message,
      type,
      referenceId
    });

    await notification.save();

    // Relay to Chat service for real-time WebSocket delivery
    try {
      await fetch('http://localhost:3004/api/chat/internal/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, notification })
      });
    } catch (err: any) {
      console.warn('[Notification Service] Failed to send real-time notification to chat service:', err.message);
    }

    res.status(201).json({ success: true, notification });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getUserNotifications = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;

  try {
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, notifications });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  const { notificationId } = req.params;

  try {
    const notification = await Notification.findOne({ notificationId });
    if (!notification) {
      res.status(404).json({ error: 'Not Found', message: 'Notification not found' });
      return;
    }

    notification.isRead = true;
    await notification.save();
    res.status(200).json({ success: true, notification });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  const { notificationId } = req.params;

  try {
    const result = await Notification.deleteOne({ notificationId });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Not Found', message: 'Notification not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const deleteNotificationsByReference = async (req: Request, res: Response): Promise<void> => {
  const { userId, referenceId } = req.params;

  try {
    const result = await Notification.deleteMany({ userId, referenceId, type: 'chat_message' });
    res.status(200).json({ success: true, deletedCount: result.deletedCount });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
