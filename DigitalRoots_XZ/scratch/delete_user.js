const mongoose = require('mongoose');
const { getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

try {
  require('dotenv').config();
} catch (e) {}

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017';
const email = 'queenmbiakop@gmail.com';

mongoose.connect(MONGO_URI, { dbName: 'xz_users' }).then(async () => {
  console.log('Connected to MongoDB');
  
  const db = mongoose.connection.db;
  const user = await db.collection('users').findOne({ email });
  if (!user) {
    console.log('User not found in MongoDB');
  } else {
    console.log('Found user in MongoDB:', user.name, user._id);
    const targetUserIdStr = user._id.toString();
    const firebaseUid = user.firebaseUid;

    if (firebaseUid) {
      try {
        const { deleteFirebaseUser } = require('./dist/config/firebase');
        await deleteFirebaseUser(firebaseUid);
        console.log('Firebase user deleted for UID:', firebaseUid);
      } catch (fbErr) {
        console.warn('Firebase user delete failed/ignored:', fbErr.message);
      }
    }

    const dbConnection = mongoose.connection;
    const contentDb = dbConnection.useDb('xz_content');
    await contentDb.collection('posts').deleteMany({ authorId: targetUserIdStr });
    await contentDb.collection('stories').deleteMany({ authorId: targetUserIdStr });
    await contentDb.collection('knowledgearticles').deleteMany({ authorId: targetUserIdStr });
    
    await contentDb.collection('posts').updateMany(
      {},
      { $pull: { comments: { userId: targetUserIdStr } } }
    );
    await contentDb.collection('posts').updateMany(
      {},
      { $pull: { 'reactions.$[].userIds': targetUserIdStr } }
    );
    await contentDb.collection('stories').updateMany(
      {},
      { $pull: { comments: { userId: targetUserIdStr } } }
    );
    await contentDb.collection('knowledgearticles').updateMany(
      {},
      { $pull: { comments: { userId: targetUserIdStr } } }
    );

    await contentDb.collection('communities').updateMany(
      {},
      { $pull: { members: targetUserIdStr, admins: targetUserIdStr } }
    );
    await contentDb.collection('communities').deleteMany({ creatorId: targetUserIdStr });

    const chatDb = dbConnection.useDb('xz_chat_db');
    await chatDb.collection('messages').deleteMany({ senderId: targetUserIdStr });
    await chatDb.collection('threads').updateMany(
      {},
      { $pull: { participants: targetUserIdStr } }
    );

    const sessionDb = dbConnection.useDb('xz_sessions');
    await sessionDb.collection('mentoringpairings').deleteMany({
      $or: [{ youthId: targetUserIdStr }, { elderId: targetUserIdStr }]
    });
    await sessionDb.collection('sessions').deleteMany({
      $or: [{ youthId: targetUserIdStr }, { elderId: targetUserIdStr }, { mentorId: targetUserIdStr }]
    });

    const notificationDb = dbConnection.useDb('xz_notifications');
    await notificationDb.collection('notifications').deleteMany({ userId: targetUserIdStr });

    const pointDb = dbConnection.useDb('xz_points');
    await pointDb.collection('points').deleteMany({ userId: targetUserIdStr });

    await db.collection('users').deleteOne({ _id: user._id });
    console.log('User document deleted from MongoDB');
  }

  // Also clean up directly from Firebase Auth by email (if they registered but didn't save MongoDB doc)
  try {
    const { initFirebase } = require('./dist/config/firebase');
    initFirebase();
  } catch (err) {}

  try {
    if (getApps().length > 0) {
      try {
        const authUser = await getAuth().getUserByEmail(email);
        if (authUser) {
          await getAuth().deleteUser(authUser.uid);
          console.log('Deleted user directly from Firebase by email:', email);
        }
      } catch (err) {
        if (err.code !== 'auth/user-not-found') {
          console.error('Error fetching/deleting direct firebase user:', err.message);
        } else {
          console.log('User not found directly in Firebase Auth by email.');
        }
      }
    }
  } catch (err) {
    console.warn('Firebase direct clean failed:', err.message);
  }

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
