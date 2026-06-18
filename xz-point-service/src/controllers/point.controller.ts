import { Request, Response } from 'express';
import { CreditTransaction } from '../models/credit.model';
import { Badge } from '../models/badge.model';
import axios from 'axios';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3006';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3010';

export const awardPoints = async (req: Request, res: Response): Promise<void> => {
  const { userId, action, referenceId, referenceType } = req.body;

  if (!userId || !action) {
    res.status(400).json({ error: 'Validation Error', message: 'userId and action are required' });
    return;
  }

  // Define points per action
  const creditMap: Record<string, number> = {
    story_published: 10,
    interview_completed: 50,
    post_bookmarked: 5,
    post_shared: 8,
    mentoring_session: 12,
    first_interview_bonus: 100
  };

  const credits = creditMap[action] || 5;

  try {
    // Helper to send notifications when badges are unlocked
    const triggerBadgeNotification = async (badgeName: string) => {
      try {
        await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
          userId,
          title: 'New Badge Awarded!',
          message: `Congratulations! You have been awarded the "${badgeName}" badge!`,
          type: 'badge_awarded',
          referenceId: badgeName
        });
      } catch (err: any) {
        console.error('[Point Service] Failed to send badge notification:', err.message);
      }
    };

    // 1. Create Transaction record
    const txn = new CreditTransaction({
      userId,
      action,
      credits,
      referenceId,
      referenceType
    });
    await txn.save();

    // 2. Fetch all transactions to calculate new total
    const txns = await CreditTransaction.find({ userId });
    const totalCredits = txns.reduce((acc, t) => acc + t.credits, 0);

    // 3. Evaluate Badges
    const existingBadges = await Badge.find({ userId });
    const badgeTypes = existingBadges.map(b => b.badgeType);
    const newBadges: string[] = [...badgeTypes];

    const storiesCount = txns.filter(t => t.action === 'story_published').length;
    const interviewsCount = txns.filter(t => t.action === 'interview_completed').length;

    // Milestone checks
    if (storiesCount >= 1 && !badgeTypes.includes('First Voice')) {
      const b = new Badge({ userId, badgeType: 'First Voice' });
      await b.save();
      newBadges.push('First Voice');
      await triggerBadgeNotification('First Voice');
    }
    if (storiesCount >= 5 && !badgeTypes.includes('Story Keeper')) {
      const b = new Badge({ userId, badgeType: 'Story Keeper' });
      await b.save();
      newBadges.push('Story Keeper');
      await triggerBadgeNotification('Story Keeper');
    }
    if (interviewsCount >= 3 && !badgeTypes.includes('Archivist')) {
      const b = new Badge({ userId, badgeType: 'Archivist' });
      await b.save();
      newBadges.push('Archivist');
      await triggerBadgeNotification('Archivist');
    }
    if (totalCredits >= 300 && !badgeTypes.includes('Wisdom Keeper')) {
      const b = new Badge({ userId, badgeType: 'Wisdom Keeper' });
      await b.save();
      newBadges.push('Wisdom Keeper');
      await triggerBadgeNotification('Wisdom Keeper');
    }

    // 4. Update the user microservice
    try {
      await axios.put(`${USER_SERVICE_URL}/api/users/${userId}/rewards`, {
        legacyCredits: totalCredits,
        badges: newBadges
      });
    } catch (err: any) {
      console.error('[Point Service] Failed to sync rewards to User Service:', err.message);
    }

    res.status(201).json({
      success: true,
      transaction: txn,
      balance: totalCredits,
      badges: newBadges
    });
  } catch (error: any) {
    console.error('[Point Service] awardPoints error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getHistory = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;

  try {
    const transactions = await CreditTransaction.find({ userId }).sort({ createdAt: -1 });
    const badges = await Badge.find({ userId }).sort({ awardedAt: -1 });

    const balance = transactions.reduce((acc, t) => acc + t.credits, 0);

    res.status(200).json({
      userId,
      balance,
      badges,
      transactions
    });
  } catch (error: any) {
    console.error('[Point Service] getHistory error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
