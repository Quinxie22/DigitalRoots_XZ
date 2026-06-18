import { Router } from 'express';
import { createNotification, getUserNotifications, markAsRead, deleteNotification, deleteNotificationsByReference } from '../controllers/notification.controller';

const router = Router();

router.post('/', createNotification);
router.get('/:userId', getUserNotifications);
router.put('/:notificationId/read', markAsRead);
router.delete('/:notificationId', deleteNotification);
router.delete('/user/:userId/reference/:referenceId', deleteNotificationsByReference);

export default router;
