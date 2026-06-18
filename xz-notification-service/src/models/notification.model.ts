import { Schema, model, Document } from 'mongoose';

export interface INotification extends Document {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  referenceId?: string;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    notificationId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      required: true
    },
    isRead: { type: Boolean, default: false },
    referenceId: { type: String }
  },
  {
    timestamps: true
  }
);

export const Notification = model<INotification>('Notification', notificationSchema);

