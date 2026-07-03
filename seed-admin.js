#!/usr/bin/env node
/**
 * seed-admin.js
 * Run this ONCE on the EC2 server to create the first Admin account.
 * Usage: node seed-admin.js
 *
 * It connects directly to MongoDB and inserts an Admin user,
 * bypassing the API (which requires an existing Admin token).
 */

const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

// ── Config ────────────────────────────────────────────────────────────────────
const MONGO_URI  = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME    = 'xz_users';
const COLLECTION = 'users';

// ── Admin credentials to create ───────────────────────────────────────────────
const ADMIN = {
  email   : 'admin@digitalroots.app',
  password: 'DigitalRoots@Admin2026!',   // stored as plain text to match the app's current auth
  name    : 'Digital Roots Admin',
  role    : 'Admin',
  avatar  : 'DA',
  status  : 'active',
  bio     : 'System Administrator account.',
  community: 'System',
  languages: ['English', 'French'],
  contentPreferences: ['Cultural', 'Educational'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB:', MONGO_URI);

    const db  = client.db(DB_NAME);
    const col = db.collection(COLLECTION);

    // Check if admin already exists
    const existing = await col.findOne({ email: ADMIN.email });
    if (existing) {
      console.log('Admin user already exists:', existing.email);
      console.log('Role:', existing.role);
      return;
    }

    const result = await col.insertOne(ADMIN);
    console.log('\n✅ Admin user created successfully!');
    console.log('───────────────────────────────────');
    console.log('  Email   :', ADMIN.email);
    console.log('  Password:', ADMIN.password);
    console.log('  Role    :', ADMIN.role);
    console.log('  MongoDB _id:', result.insertedId);
    console.log('───────────────────────────────────');
    console.log('\nYou can now log in at https://xz-digitalroots.duckdns.org');
    console.log('Delete this script after use for security.\n');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
