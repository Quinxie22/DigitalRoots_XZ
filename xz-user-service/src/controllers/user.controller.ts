import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { verifyFirebaseToken } from '../config/firebase';

const getJWTSecret = () => process.env.JWT_SECRET || 'xz_jwt_secret_shared_2026_key';
const getJWTExpiry = () => process.env.JWT_EXPIRY || '24h';

// Helper to generate initials from a name
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, name, role, avatar, age } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: 'Validation Error', message: 'Email, password, and name are required' });
    return;
  }

  if (role === 'Admin') {
    res.status(400).json({ error: 'Validation Error', message: 'Direct registration as Administrator is restricted' });
    return;
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ error: 'ConflictError', message: 'A user with this email already exists' });
      return;
    }

    const calculatedAvatar = avatar || getInitials(name);
    const calculatedAge = age ? Number(age) : 0;
    const userRole = calculatedAge >= 40 ? 'Elder' : 'Youth';

    const newUser = new User({
      email,
      password,
      name,
      role: userRole,
      avatar: calculatedAvatar,
      age: calculatedAge,
    });

    await newUser.save();

    // Generate JWT
    const token = jwt.sign(
      {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
      },
      getJWTSecret(),
      { expiresIn: getJWTExpiry() as any }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        avatar: newUser.avatar,
        age: newUser.age,
        bio: newUser.bio,
        languages: newUser.languages,
        community: newUser.community,
        contentPreferences: newUser.contentPreferences,
        legacyCredits: newUser.legacyCredits,
        badges: newUser.badges,
      },
    });
  } catch (error: any) {
    console.error('[User Service] Registration error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Validation Error', message: 'Email and password are required' });
    return;
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
      return;
    }

    if (user.status === 'Suspended' || user.status === 'Banned') {
      res.status(403).json({ error: 'Forbidden', message: `Your account is ${user.status}. Please contact an administrator.` });
      return;
    }

    const isMatch = await (user as any).comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      getJWTSecret(),
      { expiresIn: getJWTExpiry() as any }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        languages: user.languages,
        community: user.community,
        contentPreferences: user.contentPreferences,
        legacyCredits: user.legacyCredits,
        badges: user.badges,
        age: user.age,
      },
    });
  } catch (error: any) {
    console.error('[User Service] Login error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Access denied' });
    return;
  }

  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User profile not found' });
      return;
    }
    res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        languages: user.languages,
        community: user.community,
        contentPreferences: user.contentPreferences,
        legacyCredits: user.legacyCredits,
        badges: user.badges,
        age: user.age,
      }
    });
  } catch (error: any) {
    console.error('[User Service] Profile error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const verify = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid token payload' });
    return;
  }
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.status === 'Suspended' || user.status === 'Banned') {
      res.status(403).json({ error: 'Forbidden', message: `Your account is ${user ? user.status : 'disabled'}. Please contact an administrator.` });
      return;
    }
    res.status(200).json({ valid: true, user: req.user });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({}).select('-password');
    res.status(200).json({ users });
  } catch (error: any) {
    console.error('[User Service] Get all users error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Access denied' });
    return;
  }

  const { name, bio, languages, community, contentPreferences, avatar, password, age, role } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User profile not found' });
      return;
    }

    if (name !== undefined) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (community !== undefined) user.community = community;
    if (contentPreferences !== undefined) user.contentPreferences = contentPreferences;
    if (avatar !== undefined) user.avatar = avatar;
    if (password !== undefined && password.trim() !== '') user.password = password;
    if (age !== undefined) {
      const calculatedAge = Number(age);
      user.age = calculatedAge;
      user.role = calculatedAge >= 40 ? 'Elder' : 'Youth';
    }

    if (languages !== undefined) {
      const validLangs = languages.filter((l: string) => ['English', 'French'].includes(l));
      user.languages = validLangs;
    }

    await user.save();
    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        languages: user.languages,
        community: user.community,
        contentPreferences: user.contentPreferences,
        legacyCredits: user.legacyCredits,
        badges: user.badges,
        age: user.age,
      }
    });
  } catch (error: any) {
    console.error('[User Service] Profile update error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const updatePointsAndBadges = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const { legacyCredits, badges } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }

    if (legacyCredits !== undefined) user.legacyCredits = legacyCredits;
    if (badges !== undefined) user.badges = badges;

    await user.save();
    res.status(200).json({
      message: 'Points and badges updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        languages: user.languages,
        community: user.community,
        contentPreferences: user.contentPreferences,
        legacyCredits: user.legacyCredits,
        badges: user.badges,
      }
    });
  } catch (error: any) {
    console.error('[User Service] Rewards update error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const createAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || req.user.role !== 'Admin') {
    res.status(403).json({ error: 'Forbidden', message: 'Only Administrators can create other Administrators' });
    return;
  }

  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: 'Validation Error', message: 'Email, password, and name are required' });
    return;
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ error: 'ConflictError', message: 'A user with this email already exists' });
      return;
    }

    const initials = getInitials(name);

    const newAdmin = new User({
      email,
      password,
      name,
      role: 'Admin',
      avatar: initials,
      bio: 'System Administrator account.',
      community: 'System',
      languages: ['English', 'French'],
      contentPreferences: ['Cultural', 'Educational']
    });

    await newAdmin.save();

    res.status(201).json({
      message: 'Admin created successfully',
      user: {
        id: newAdmin._id,
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role,
        avatar: newAdmin.avatar,
      },
    });
  } catch (error: any) {
    console.error('[User Service] Admin creation error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// firebaseLogin
// Called after the client obtains a Firebase ID Token (email/password or
// Google Sign-In). Verifies the token, finds-or-creates the MongoDB profile,
// and issues our own internal JWT used by all microservices.
//
// Request body:
//   idToken  (string, required)  — Firebase ID Token
//   role     (string, optional)  — 'Youth' | 'Elder'
//                                  Required for new Email/Password registrations.
//                                  Omitted for Google Sign-In (frontend prompts
//                                  role selection separately via needsRoleSelection).
//   name     (string, optional)  — Display name override
// ─────────────────────────────────────────────────────────────────────────────
export const firebaseLogin = async (req: Request, res: Response): Promise<void> => {
  const { idToken, role, name: requestedName, age } = req.body;

  if (!idToken) {
    res.status(400).json({ error: 'Validation Error', message: 'Firebase idToken is required' });
    return;
  }

  try {
    // Step 1 — Verify the Firebase ID Token
    const decoded = await verifyFirebaseToken(idToken);
    const firebaseEmail: string = (decoded.email || '').toLowerCase().trim();
    const firebaseName: string = requestedName || decoded.name || decoded.email?.split('@')[0] || 'User';
    const firebaseUid: string = decoded.uid || '';

    if (!firebaseEmail) {
      res.status(400).json({ error: 'Validation Error', message: 'Firebase token does not contain an email address' });
      return;
    }

    // Step 2 — Look up by email in MongoDB
    let user = await User.findOne({ email: firebaseEmail });

    if (user) {
      if (user.status === 'Suspended' || user.status === 'Banned') {
        res.status(403).json({ error: 'Forbidden', message: `Your account is ${user.status}. Please contact an administrator.` });
        return;
      }
      // ── Returning user (legacy OR previously registered via Firebase) ──────
      // Link the Firebase UID if not already stored (e.g. legacy user signs in
      // with Google using the same email for the first time).
      if (!user.firebaseUid && firebaseUid) {
        user.firebaseUid = firebaseUid;
        await user.save();
      }
    } else {
      // ── Brand-new user ────────────────────────────────────────────────────
      // For Email/Password Firebase registration, 'role' is sent from the form.
      // For Google Sign-In, 'role' is absent — we flag needsRoleSelection so
      // the frontend can show a role-picker modal before creating the profile.
      if (!role) {
        res.status(200).json({
          needsRoleSelection: true,
          needsOnboarding: true,
          firebaseUid,
          email: firebaseEmail,
          name: firebaseName,
          message: 'New Google user — role selection required before profile creation',
        });
        return;
      }

      if (role === 'Admin') {
        res.status(400).json({ error: 'Validation Error', message: 'Direct registration as Administrator is restricted' });
        return;
      }

      const initials = getInitials(firebaseName);
      const calculatedAge = age ? Number(age) : 0;
      const calculatedRole = calculatedAge >= 40 ? 'Elder' : 'Youth';

      user = new User({
        email: firebaseEmail,
        password: '',        // No password for Firebase/Google-only accounts
        firebaseUid,
        name: firebaseName,
        role: calculatedRole,
        avatar: initials,
        age: calculatedAge,
      });
      await user.save();
    }

    // Step 3 — Check if profile is incomplete (triggers onboarding modal)
    const needsOnboarding = !user.bio || !user.community || user.contentPreferences.length === 0;

    // Step 4 — Issue internal JWT (same format used by ALL microservices)
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      getJWTSecret(),
      { expiresIn: getJWTExpiry() as any }
    );

    res.status(200).json({
      message: 'Firebase login successful',
      needsOnboarding,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        languages: user.languages,
        community: user.community,
        contentPreferences: user.contentPreferences,
        legacyCredits: user.legacyCredits,
        badges: user.badges,
        age: user.age,
      },
    });
  } catch (error: any) {
    console.error('[User Service] Firebase login error:', error);
    if (error.code === 'auth/id-token-expired') {
      res.status(401).json({ error: 'Unauthorized', message: 'Firebase token has expired. Please sign in again.' });
      return;
    }
    if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid Firebase token.' });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    if (!['Active', 'Suspended', 'Banned'].includes(status)) {
      res.status(400).json({ error: 'Validation Error', message: 'Invalid status value' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }

    user.status = status;
    await user.save();

    if (status === 'Banned') {
      try {
        const contentServiceUrl = process.env.VITE_CONTENT_SERVICE_URL || 'http://localhost:3004';
        const authHeader = req.headers.authorization || '';
        await (global as any).fetch(`${contentServiceUrl}/api/moderation/ban`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader
          },
          body: JSON.stringify({ userIdToBan: userId, reason })
        });
      } catch (err) {
        console.warn('[User Service] Failed to call content service ban endpoint:', err);
      }
    }

    res.status(200).json({ message: `User status updated to ${status} successfully`, user });
  } catch (error: any) {
    console.error('[User Service] Update user status error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['Elder', 'Youth', 'Admin'].includes(role)) {
      res.status(400).json({ error: 'Validation Error', message: 'Invalid role value' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }

    user.role = role;
    await user.save();
    res.status(200).json({ message: `User role updated to ${role} successfully`, user });
  } catch (error: any) {
    console.error('[User Service] Update user role error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
