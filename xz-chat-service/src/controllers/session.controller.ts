import { Request, Response } from 'express';
import { Interview } from '../models/interview.model';
import { MentoringPair } from '../models/mentoring.model';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3006';
const POINT_SERVICE_URL = process.env.POINT_SERVICE_URL || 'http://localhost:3007';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3010';

export const proposeInterview = async (req: Request, res: Response): Promise<void> => {
  const { archivistId, archivistName, subjectId, subjectName, title, description, scheduledAt, questions } = req.body;

  if (!archivistId || !subjectId || !title || !scheduledAt) {
    res.status(400).json({ error: 'Validation Error', message: 'Required fields: archivistId, subjectId, title, scheduledAt' });
    return;
  }

  try {
    const interview = new Interview({
      interviewId: uuidv4(),
      archivistId,
      archivistName,
      subjectId,
      subjectName,
      title,
      description,
      scheduledAt,
      questions: questions || []
    });

    await interview.save();

    // Trigger notification to the recipient of the proposal
    try {
      const proposerId = (req as any).user?.firebase_uid || (req as any).user?.id || archivistId;
      const recipientId = proposerId === archivistId ? subjectId : archivistId;
      const proposerName = proposerId === archivistId ? archivistName : subjectName;
      await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
        userId: recipientId,
        title: 'New Oral History Proposal',
        message: `${proposerName} has proposed a new oral history recording session: "${title}"`,
        type: 'interview_proposal',
        referenceId: interview.interviewId
      });
    } catch (err: any) {
      console.error('[Session Controller] Failed to send proposal notification:', err.message);
    }

    res.status(201).json({ success: true, interview });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const confirmInterview = async (req: Request, res: Response): Promise<void> => {
  const { interviewId } = req.params;

  try {
    const interview = await Interview.findOne({ interviewId });
    if (!interview) {
      res.status(404).json({ error: 'Not Found', message: 'Interview not found' });
      return;
    }

    interview.status = 'confirmed';
    await interview.save();

    // Trigger notification to the proposer (other party)
    try {
      const confirmerId = (req as any).user?.firebase_uid || (req as any).user?.id || interview.subjectId;
      const recipientId = confirmerId === interview.subjectId ? interview.archivistId : interview.subjectId;
      const confirmerName = confirmerId === interview.subjectId ? interview.subjectName : interview.archivistName;
      await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
        userId: recipientId,
        title: 'Oral History Proposal Confirmed',
        message: `${confirmerName} has confirmed your proposed session: "${interview.title}"`,
        type: 'interview_confirmed',
        referenceId: interview.interviewId
      });
    } catch (err: any) {
      console.error('[Session Controller] Failed to send confirm notification:', err.message);
    }

    res.status(200).json({ success: true, interview });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const completeInterview = async (req: Request, res: Response): Promise<void> => {
  const { interviewId } = req.params;
  const { recordingUrl } = req.body;

  try {
    const interview = await Interview.findOne({ interviewId });
    if (!interview) {
      res.status(404).json({ error: 'Not Found', message: 'Interview not found' });
      return;
    }

    interview.status = 'completed';
    if (recordingUrl) interview.recordingUrl = recordingUrl;
    await interview.save();

    // Award Points to both Archivist (Youth) and Subject (Elder)
    try {
      // Award Youth Archivist
      await axios.post(`${POINT_SERVICE_URL}/api/points/award`, {
        userId: interview.archivistId,
        action: 'interview_completed',
        referenceId: interview.interviewId,
        referenceType: 'interview'
      });
      // Award Elder Subject
      await axios.post(`${POINT_SERVICE_URL}/api/points/award`, {
        userId: interview.subjectId,
        action: 'interview_completed',
        referenceId: interview.interviewId,
        referenceType: 'interview'
      });
    } catch (err: any) {
      console.error('[Session Controller] Failed to trigger point awards on interview completion:', err.message);
    }

    res.status(200).json({ success: true, interview });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const requestMentoring = async (req: Request, res: Response): Promise<void> => {
  const { mentorId, mentorName, menteeId, menteeName, pairingType, skillFocus, requestedById } = req.body;

  if (!mentorId || !menteeId || !pairingType || !skillFocus) {
    res.status(400).json({ error: 'Validation Error', message: 'mentorId, menteeId, pairingType, and skillFocus are required' });
    return;
  }

  const requesterId = requestedById || (req as any).user?.firebase_uid || (req as any).user?.id || menteeId;

  try {
    const existingPair = await MentoringPair.findOne({
      $or: [
        { mentorId, menteeId, status: { $ne: 'completed' } },
        { mentorId: menteeId, menteeId: mentorId, status: { $ne: 'completed' } }
      ]
    });

    if (existingPair) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'A mentorship connection already exists or has been requested between these two users.'
      });
      return;
    }

    const pair = new MentoringPair({
      pairingId: uuidv4(),
      mentorId,
      mentorName,
      menteeId,
      menteeName,
      pairingType,
      skillFocus,
      requestedById: requesterId,
      status: 'requested'
    });

    await pair.save();

    // Trigger notification to the recipient of the pairing request
    try {
      const recipientId = requesterId === mentorId ? menteeId : mentorId;
      const requesterName = requesterId === mentorId ? mentorName : menteeName;
      await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
        userId: recipientId,
        title: 'New Mentorship Request',
        message: `${requesterName} has requested a mentoring connection with you focusing on: "${skillFocus}"`,
        type: 'mentoring_request',
        referenceId: pair.pairingId
      });
    } catch (err: any) {
      console.error('[Session Controller] Failed to send mentoring request notification:', err.message);
    }

    res.status(201).json({ success: true, pair });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const acceptMentoring = async (req: Request, res: Response): Promise<void> => {
  const { pairingId } = req.params;

  try {
    const pair = await MentoringPair.findOne({ pairingId });
    if (!pair) {
      res.status(404).json({ error: 'Not Found', message: 'Mentoring pairing record not found' });
      return;
    }

    pair.status = 'active';
    await pair.save();

    // Trigger notification to the requester (sender) of the pairing request
    try {
      const accepterId = (req as any).user?.firebase_uid || (req as any).user?.id || (pair.requestedById === pair.mentorId ? pair.menteeId : pair.mentorId);
      const accepterName = accepterId === pair.mentorId ? pair.mentorName : pair.menteeName;
      await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
        userId: pair.requestedById,
        title: 'Mentorship Request Accepted',
        message: `${accepterName} has accepted your mentoring connection request!`,
        type: 'mentoring_accepted',
        referenceId: pair.pairingId
      });
    } catch (err: any) {
      console.error('[Session Controller] Failed to send mentoring acceptance notification:', err.message);
    }

    res.status(200).json({ success: true, pair });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getMentoringMatches = async (req: Request, res: Response): Promise<void> => {
  const { userId, role } = req.query;

  if (!userId || !role) {
    res.status(400).json({ error: 'Validation Error', message: 'userId and role parameters are required' });
    return;
  }

  try {
    const profileRes = await axios.get(`${USER_SERVICE_URL}/api/users/profile`, {
      headers: {
        Authorization: req.headers.authorization || '',
        'x-user-id': req.headers['x-user-id'] || '',
        'x-user-role': req.headers['x-user-role'] || '',
        'x-user-email': req.headers['x-user-email'] || '',
        'x-user-name': req.headers['x-user-name'] || ''
      }
    });
    const currentUser = profileRes.data.user;

    const allUsersRes = await axios.get(`${USER_SERVICE_URL}/api/users`, {
      headers: {
        Authorization: req.headers.authorization || '',
        'x-user-id': req.headers['x-user-id'] || '',
        'x-user-role': req.headers['x-user-role'] || '',
        'x-user-email': req.headers['x-user-email'] || '',
        'x-user-name': req.headers['x-user-name'] || ''
      }
    });
    const allUsers: any[] = allUsersRes.data.users || [];

    const normalizeRole = (r: string): 'Elder' | 'Youth' => {
      const normalized = (r || '').toLowerCase();
      if (normalized === 'elder' || normalized === 'arthur' || normalized === 'felix') {
        return 'Elder';
      }
      return 'Youth';
    };

    const currentNormalizedRole = normalizeRole(role as string);
    const targetRole = currentNormalizedRole === 'Elder' ? 'Youth' : 'Elder';

    const matches = allUsers
      .filter((u: any) => {
        const uId = (u._id || u.id || '').toString();
        const curId = (userId || '').toString();
        if (uId === curId) return false;
        if (u.role === 'Admin') return false;
        return normalizeRole(u.role) === targetRole;
      })
      .map((u: any) => {
        let score = 0;

        const commonLangs = (currentUser.languages || []).filter((l: string) => (u.languages || []).includes(l));
        score += commonLangs.length * 30;

        if (currentUser.community && u.community && currentUser.community === u.community) {
          score += 25;
        }

        const commonPrefs = (currentUser.contentPreferences || []).filter((p: string) => (u.contentPreferences || []).includes(p));
        score += commonPrefs.length * 15;

        score = Math.min(score, 100);

        return {
          user: {
            id: u._id,
            name: u.name,
            role: u.role,
            bio: u.bio,
            community: u.community,
            languages: u.languages,
            avatar: u.avatar,
            contentPreferences: u.contentPreferences || []
          },
          sharedInterests: commonPrefs,
          score
        };
      })
      .sort((a, b) => b.score - a.score);

    res.status(200).json({ success: true, matches });
  } catch (error: any) {
    console.error('[Session Controller] Matches error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getInterviews = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.query;
  const userIdStr = typeof userId === 'string' ? userId : undefined;

  try {
    const query = userIdStr ? { $or: [{ archivistId: userIdStr }, { subjectId: userIdStr }] } : {};
    const list = await Interview.find(query).sort({ scheduledAt: 1 });
    res.status(200).json({ success: true, interviews: list });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getMentoringPairs = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.query;
  const userIdStr = typeof userId === 'string' ? userId : undefined;

  try {
    const query = userIdStr ? { $or: [{ mentorId: userIdStr }, { menteeId: userIdStr }] } : {};
    const list = await MentoringPair.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, pairs: list });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const cancelMentoring = async (req: Request, res: Response): Promise<void> => {
  const { pairingId } = req.params;
  const requesterId = (req as any).user?.firebase_uid || (req as any).user?.id;

  try {
    const pair = await MentoringPair.findOne({ pairingId });
    if (!pair) {
      res.status(404).json({ error: 'Not Found', message: 'Mentoring pairing record not found' });
      return;
    }

    if (requesterId !== pair.mentorId && requesterId !== pair.menteeId) {
      res.status(403).json({ error: 'Forbidden', message: 'You are not authorized to cancel this mentoring connection.' });
      return;
    }

    try {
      const otherUserId = requesterId === pair.mentorId ? pair.menteeId : pair.mentorId;
      const cancellerName = requesterId === pair.mentorId ? pair.mentorName : pair.menteeName;
      await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
        userId: otherUserId,
        title: 'Mentorship Cancelled',
        message: `${cancellerName} has ended the mentoring connection.`,
        type: 'mentoring_cancelled',
        referenceId: pairingId
      });
    } catch (err: any) {
      console.error('[Session Controller] Failed to send mentoring cancellation notification:', err.message);
    }

    await MentoringPair.deleteOne({ pairingId });
    res.status(200).json({ success: true, message: 'Mentoring pairing cancelled and deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
