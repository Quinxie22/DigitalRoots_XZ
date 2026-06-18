// ─────────────────────────────────────────────────────────────────────────────
// api.ts
// Centralized API helper functions for communicating with the backend.
//
// HOW IT WORKS:
//   - All HTTP requests go to the backend at BACKEND_URL (default port 3004).
//   - The Authorization header carries a "Bearer <token>" where the token is
//     the logged-in user's ID. In development/mock mode, the backend accepts
//     any string as a valid user token.
//   - In production, this would be a real Firebase ID token.
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';

function authHeaders(token: string) {
  const realToken = sessionStorage.getItem('token') || token;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${realToken}`,
  };
}

// ─── Thread API ───────────────────────────────────────────────
export async function getThreads(token: string) {
  const res = await fetch(`${BACKEND_URL}/api/chat/threads`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`getThreads failed: ${res.status}`);
  return res.json();
}

export async function getOrCreateThread(token: string, targetUserId: string) {
  const res = await fetch(`${BACKEND_URL}/api/chat/threads/${targetUserId}`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`getOrCreateThread failed: ${res.status}`);
  return res.json();
}

// ─── Messages API ─────────────────────────────────────────────
export async function getMessages(token: string, threadId: string, before?: string) {
  const params = before ? `?before=${before}&limit=50` : '?limit=50';
  const res = await fetch(`${BACKEND_URL}/api/chat/threads/${threadId}/messages${params}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`getMessages failed: ${res.status}`);
  return res.json();
}

export async function sendTextMessage(token: string, threadId: string, content: string) {
  const res = await fetch(`${BACKEND_URL}/api/chat/threads/${threadId}/messages`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`sendTextMessage failed: ${res.status}`);
  return res.json();
}

export async function markMessagesAsRead(token: string, threadId: string) {
  const res = await fetch(`${BACKEND_URL}/api/chat/threads/${threadId}/read`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`markMessagesAsRead failed: ${res.status}`);
  return res.json();
}

// ─── Archives API ─────────────────────────────────────────────
export async function getArchives(token: string, threadId: string) {
  const res = await fetch(`${BACKEND_URL}/api/chat/threads/${threadId}/archives`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`getArchives failed: ${res.status}`);
  return res.json();
}

export async function uploadFile(token: string, threadId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BACKEND_URL}/api/chat/threads/${threadId}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionStorage.getItem('token') || token}` }, // no Content-Type — browser sets it for FormData
    body: formData,
  });
  if (!res.ok) throw new Error(`uploadFile failed: ${res.status}`);
  return res.json();
}

export async function uploadGenericFile(token: string, file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BACKEND_URL}/api/chat/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionStorage.getItem('token') || token}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`uploadGenericFile failed: ${res.status}`);
  return res.json();
}

// ─── Discussion Topic API ─────────────────────────────────────
export async function updateTopic(token: string, threadId: string, topic: string) {
  const res = await fetch(`${BACKEND_URL}/api/chat/threads/${threadId}/topic`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ topic }),
  });
  if (!res.ok) throw new Error(`updateTopic failed: ${res.status}`);
  return res.json();
}

export async function sendVoiceNote(token: string, threadId: string, audioBlob: Blob, duration: number) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'voice-note.webm');
  formData.append('duration', duration.toString());
  const res = await fetch(`${BACKEND_URL}/api/chat/threads/${threadId}/voice`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionStorage.getItem('token') || token}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`sendVoiceNote failed: ${res.status}`);
  return res.json();
}

export function resolveMediaUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${BACKEND_URL}${url}`;
}

export async function deleteMessage(token: string, threadId: string, messageId: string) {
  const res = await fetch(`${BACKEND_URL}/api/chat/threads/${threadId}/messages/${messageId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`deleteMessage failed: ${res.status}`);
  return res.json();
}

export async function reportConnection(token: string, threadId: string, reason: string) {
  const res = await fetch(`${BACKEND_URL}/api/chat/threads/${threadId}/report`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`reportConnection failed: ${res.status}`);
  return res.json();
}

const NOTIFICATION_SERVICE_URL = import.meta.env.VITE_NOTIFICATION_SERVICE_URL || 'http://localhost:3010';

export async function deleteNotification(token: string, notificationId: string): Promise<void> {
  const res = await fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${sessionStorage.getItem('token') || token}` },
  });
  if (!res.ok) throw new Error(`deleteNotification failed: ${res.status}`);
}


