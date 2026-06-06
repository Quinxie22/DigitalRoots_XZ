// ─────────────────────────────────────────────────────────────────────────────
// socket.ts
// Creates and exports a single Socket.io client instance.
//
// HOW IT WORKS:
//   - We connect to the backend server at port 3004.
//   - The auth token is set to the user's ID (which the backend treats as a
//     Firebase UID in mock/dev mode). This is how the backend identifies who
//     this socket connection belongs to.
//   - autoConnect: false means the socket won't auto-connect on import;
//     the app controls when to connect (on login).
// ─────────────────────────────────────────────────────────────────────────────
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';

export const socket = io(BACKEND_URL, {
  autoConnect: false,
  transports: ['websocket'],
});
