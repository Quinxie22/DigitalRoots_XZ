import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: false, // Optional: Google Sign-In users have no password
      default: '',
    },
    firebaseUid: {
      type: String,
      default: '', // Links a Firebase Auth UID to this MongoDB profile
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      default: 'Youth',
    },
    status: {
      type: String,
      enum: ['Active', 'Suspended', 'Banned'],
      default: 'Active',
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    avatar: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
    },
    languages: {
      type: [String],
      enum: ['English', 'French'],
      default: ['English'],
    },
    community: {
      type: String,
      default: '',
    },
    contentPreferences: {
      type: [String],
      default: [],
    },
    legacyCredits: {
      type: Number,
      default: 0,
    },
    badges: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving (skip if password is empty — Firebase-only accounts)
userSchema.pre('save', async function (this: any) {
  const user = this;
  if (!user.isModified('password')) return;
  if (!user.password || user.password.trim() === '') return;

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

// Dynamic virtual age property
userSchema.virtual('age').get(function (this: any) {
  if (!this.dateOfBirth) return 0;
  const dob = new Date(this.dateOfBirth);
  if (isNaN(dob.getTime())) return 0;
  
  const today = new Date();
  let calculatedAge = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    calculatedAge--;
  }
  return calculatedAge;
});

// Include virtuals in toJSON and toObject output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

export const User = model('User', userSchema);
