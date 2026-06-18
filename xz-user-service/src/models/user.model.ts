import { Schema, model } from 'mongoose';
import bcrypt from 'bcrypt';

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
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      default: 'Youth', // Can be 'Arthur', 'Sarah', 'Tessa', 'Felix', 'Elder', 'Admin', 'Youth'
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

// Hash password before saving
userSchema.pre('save', async function (this: any) {
  const user = this;
  if (!user.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

export const User = model('User', userSchema);
