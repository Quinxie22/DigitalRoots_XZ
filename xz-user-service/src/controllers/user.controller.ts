import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { AuthRequest } from '../middleware/auth.middleware';

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
  const { email, password, name, role, avatar } = req.body;

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
    const userRole = role || 'Youth';

    const newUser = new User({
      email,
      password,
      name,
      role: userRole,
      avatar: calculatedAvatar,
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
  // Simply echo back decoded token payload if validation passes
  res.status(200).json({ valid: true, user: req.user });
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

  const { name, bio, languages, community, contentPreferences, avatar, password } = req.body;

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


