// ─────────────────────────────────────────────────────────────────────────────
// contentApi.ts
// API helper functions for communicating with the backend Content Service.
// ─────────────────────────────────────────────────────────────────────────────

const CONTENT_URL = import.meta.env.VITE_CONTENT_URL || 'http://localhost:3005';

function authHeaders(token: string) {
  const realToken = sessionStorage.getItem('token') || localStorage.getItem('token') || token;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${realToken}`,
  };
}

// ─── Posts API ────────────────────────────────────────────────
export async function getFeed(token: string, page = 1, limit = 20, category = '', sort = 'newest') {
  const FEED_URL = import.meta.env.VITE_FEED_SERVICE_URL || 'http://localhost:3009';
  
  if (!category) {
    try {
      const res = await fetch(`${FEED_URL}/api/feed/personalized?page=${page}&limit=${limit}`, {
        headers: authHeaders(token),
      });
      if (res.ok) {
        return await res.json();
      }
      console.warn(`Feed service returned ${res.status}, falling back to content service.`);
    } catch (err) {
      console.warn('Feed service offline or failed, falling back to content service:', err);
    }
  }

  let url = `${CONTENT_URL}/api/content/posts/feed?page=${page}&limit=${limit}&sort=${sort}`;
  if (category) url += `&category=${category}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`getFeed failed: ${res.status}`);
  return res.json();
}

export async function createTextPost(token: string, body: { title?: string; content: string; category?: string; categories?: string[]; tags?: string[] }) {
  const res = await fetch(`${CONTENT_URL}/api/content/posts/text`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`createTextPost failed: ${res.status}`);
  return res.json();
}

export async function createMediaPost(token: string, files: File[], body: { title?: string; content?: string; category?: string; categories?: string[]; tags?: string }) {
  const formData = new FormData();
  files.forEach(file => formData.append('file', file));
  if (body.title) formData.append('title', body.title);
  if (body.content) formData.append('content', body.content);
  if (body.category) formData.append('category', body.category);
  if (body.categories) {
    formData.append('categories', JSON.stringify(body.categories));
  }
  if (body.tags) formData.append('tags', body.tags);

  const res = await fetch(`${CONTENT_URL}/api/content/posts/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionStorage.getItem('token') || localStorage.getItem('token') || token}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`createMediaPost failed: ${res.status}`);
  return res.json();
}

export async function editPost(token: string, postId: string, body: any) {
  const res = await fetch(`${CONTENT_URL}/api/content/posts/${postId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`editPost failed: ${res.status}`);
  return res.json();
}

export async function deletePost(token: string, postId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/posts/${postId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`deletePost failed: ${res.status}`);
  return res.json();
}

export async function addPostComment(token: string, postId: string, text: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/posts/${postId}/comments`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`addPostComment failed: ${res.status}`);
  return res.json();
}

export async function deletePostComment(token: string, postId: string, commentId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/posts/${postId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`deletePostComment failed: ${res.status}`);
  return res.json();
}

export async function likePostComment(token: string, postId: string, commentId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/posts/${postId}/comments/${commentId}/like`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`likePostComment failed: ${res.status}`);
  return res.json();
}

export async function addPostReaction(token: string, postId: string, type: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/posts/${postId}/reactions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ type }),
  });
  if (!res.ok) throw new Error(`addPostReaction failed: ${res.status}`);
  return res.json();
}

export async function removePostReaction(token: string, postId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/posts/${postId}/reactions`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`removePostReaction failed: ${res.status}`);
  return res.json();
}

export async function sharePost(token: string, postId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/posts/${postId}/share`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`sharePost failed: ${res.status}`);
  return res.json();
}

export async function flagPost(token: string, postId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/posts/${postId}/flag`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`flagPost failed: ${res.status}`);
  return res.json();
}

// ─── Stories API ──────────────────────────────────────────────
export async function uploadStory(token: string, file: Blob, body: { title: string; description?: string; culturalCategory: string; language?: string; tags?: string; duration?: number }) {
  const formData = new FormData();
  const fileName = (file as File).name || 'story-audio.webm';
  formData.append('file', file, fileName);
  formData.append('title', body.title);
  if (body.description) formData.append('description', body.description);
  formData.append('culturalCategory', body.culturalCategory);
  if (body.language) formData.append('language', body.language);
  if (body.tags) formData.append('tags', body.tags);
  if (body.duration) formData.append('duration', body.duration.toString());

  const res = await fetch(`${CONTENT_URL}/api/content/stories/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionStorage.getItem('token') || localStorage.getItem('token') || token}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`uploadStory failed: ${res.status}`);
  return res.json();
}

export async function getStories(token: string, page = 1, limit = 20, category = '', tag = '', isPublished?: boolean, authorId?: string) {
  let url = `${CONTENT_URL}/api/content/stories?page=${page}&limit=${limit}`;
  if (category) url += `&category=${category}`;
  if (tag) url += `&tag=${encodeURIComponent(tag)}`;
  if (isPublished !== undefined) url += `&isPublished=${isPublished}`;
  if (authorId) url += `&authorId=${authorId}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`getStories failed: ${res.status}`);
  return res.json();
}

export async function getStoryDetails(token: string, storyId: string, incrementView = true) {
  const res = await fetch(`${CONTENT_URL}/api/content/stories/${storyId}${incrementView ? '' : '?incrementView=false'}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`getStoryDetails failed: ${res.status}`);
  return res.json();
}

export async function getTranscription(token: string, storyId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/stories/${storyId}/transcription`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`getTranscription failed: ${res.status}`);
  return res.json();
}

export async function likeStory(token: string, storyId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/stories/${storyId}/like`, { method: 'POST', headers: authHeaders(token) });
  if (!res.ok) throw new Error(`likeStory failed: ${res.status}`);
  return res.json();
}

export async function unlikeStory(token: string, storyId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/stories/${storyId}/like`, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error(`unlikeStory failed: ${res.status}`);
  return res.json();
}

export async function approveStory(token: string, storyId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/stories/${storyId}/approve`, {
    method: 'PUT',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`approveStory failed: ${res.status}`);
  return res.json();
}

export async function rejectStory(token: string, storyId: string, reason: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/stories/${storyId}/reject`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`rejectStory failed: ${res.status}`);
  return res.json();
}

export async function bulkApproveStories(token: string, storyIds: string[]) {
  const res = await fetch(`${CONTENT_URL}/api/content/stories/bulk-approve`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ storyIds }),
  });
  if (!res.ok) throw new Error(`bulkApproveStories failed: ${res.status}`);
  return res.json();
}

export async function deleteStory(token: string, storyId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/stories/${storyId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`deleteStory failed: ${res.status}`);
  return res.json();
}

// ─── Knowledge Library API ────────────────────────────────────
export async function searchArticles(token: string, q: string, category = '', language = '', page = 1, limit = 20) {
  let url = `${CONTENT_URL}/api/content/knowledge/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`;
  if (category) url += `&category=${category}`;
  if (language) url += `&language=${language}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`searchArticles failed: ${res.status}`);
  return res.json();
}

export async function getArticleDetails(token: string, knowledgeId: string, incrementView = true) {
  const res = await fetch(`${CONTENT_URL}/api/content/knowledge/${knowledgeId}${incrementView ? '' : '?incrementView=false'}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`getArticleDetails failed: ${res.status}`);
  return res.json();
}

export async function addArticleComment(token: string, knowledgeId: string, text: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/knowledge/${knowledgeId}/comments`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`addArticleComment failed: ${res.status}`);
  return res.json();
}

export async function deleteArticleComment(token: string, knowledgeId: string, commentId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/knowledge/${knowledgeId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`deleteArticleComment failed: ${res.status}`);
  return res.json();
}

export async function getSavedBookmarks(token: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/knowledge/bookmarks`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`getSavedBookmarks failed: ${res.status}`);
  return res.json();
}

export async function createArticle(token: string, file: File | null, body: { title: string; content: string; summary: string; category?: string; tags?: string[]; language?: string }) {
  const formData = new FormData();
  if (file) formData.append('file', file);
  formData.append('title', body.title);
  formData.append('content', body.content);
  formData.append('summary', body.summary);
  if (body.category) formData.append('category', body.category);
  if (body.language) formData.append('language', body.language);
  if (body.tags) {
    body.tags.forEach(t => formData.append('tags', t));
  }

  const res = await fetch(`${CONTENT_URL}/api/content/knowledge`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionStorage.getItem('token') || localStorage.getItem('token') || token}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`createArticle failed: ${res.status}`);
  return res.json();
}

export async function editArticle(token: string, knowledgeId: string, body: any) {
  const res = await fetch(`${CONTENT_URL}/api/content/knowledge/${knowledgeId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`editArticle failed: ${res.status}`);
  return res.json();
}

export async function deleteArticle(token: string, knowledgeId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/knowledge/${knowledgeId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`deleteArticle failed: ${res.status}`);
  return res.json();
}

export async function likeArticle(token: string, knowledgeId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/knowledge/${knowledgeId}/like`, { method: 'POST', headers: authHeaders(token) });
  if (!res.ok) throw new Error(`likeArticle failed: ${res.status}`);
  return res.json();
}

export async function unlikeArticle(token: string, knowledgeId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/knowledge/${knowledgeId}/like`, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error(`unlikeArticle failed: ${res.status}`);
  return res.json();
}

export async function bookmarkArticle(token: string, knowledgeId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/knowledge/${knowledgeId}/bookmark`, { method: 'POST', headers: authHeaders(token) });
  if (!res.ok) throw new Error(`bookmarkArticle failed: ${res.status}`);
  return res.json();
}

export async function unbookmarkArticle(token: string, knowledgeId: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/knowledge/${knowledgeId}/bookmark`, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error(`unbookmarkArticle failed: ${res.status}`);
  return res.json();
}

// ─── Moderation API ───────────────────────────────────────────
export async function getAnalytics(token: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/moderation/analytics`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`getAnalytics failed: ${res.status}`);
  return res.json();
}

export async function getArticles(token: string, page = 1, limit = 20, category = '', authorId = '', isPublished?: boolean) {
  let url = `${CONTENT_URL}/api/content/knowledge?page=${page}&limit=${limit}`;
  if (category) url += `&category=${category}`;
  if (authorId) url += `&authorId=${authorId}`;
  if (isPublished !== undefined) url += `&isPublished=${isPublished}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`getArticles failed: ${res.status}`);
  return res.json();
}

export async function publishArticle(token: string, knowledgeId: string, isPublished: boolean) {
  const res = await fetch(`${CONTENT_URL}/api/content/knowledge/${knowledgeId}/publish`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ isPublished }),
  });
  if (!res.ok) throw new Error(`publishArticle failed: ${res.status}`);
  return res.json();
}

export async function createAdminUser(token: string, body: { email: string; password?: string; name: string }) {
  const res = await fetch(`http://localhost:3006/api/users/admins`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.message || `createAdminUser failed: ${res.status}`);
  }
  return res.json();
}

export async function translateTranscript(token: string, storyId: string, targetLanguage: 'en' | 'fr') {
  const res = await fetch(`${CONTENT_URL}/api/content/stories/${storyId}/translate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ targetLanguage }),
  });
  if (!res.ok) throw new Error(`translateTranscript failed: ${res.status}`);
  return res.json();
}

export function resolveContentUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${CONTENT_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export async function getPost(token: string, postId: string, incrementView = true) {
  const res = await fetch(`${CONTENT_URL}/api/content/posts/${postId}${incrementView ? '' : '?incrementView=false'}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`getPost failed: ${res.status}`);
  return res.json();
}

export async function getAllUsersList(token: string) {
  const res = await fetch(`http://localhost:3006/api/users`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`getAllUsersList failed: ${res.status}`);
  return res.json();
}

export async function updateUserStatus(token: string, userId: string, status: 'Active' | 'Suspended' | 'Banned', reason?: string) {
  const res = await fetch(`http://localhost:3006/api/users/${userId}/status`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ status, reason }),
  });
  if (!res.ok) throw new Error(`updateUserStatus failed: ${res.status}`);
  return res.json();
}

export async function updateUserRole(token: string, userId: string, role: 'Elder' | 'Youth' | 'Admin') {
  const res = await fetch(`http://localhost:3006/api/users/${userId}/role`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`updateUserRole failed: ${res.status}`);
  return res.json();
}

export async function getFlaggedPosts(token: string, page = 1, limit = 20) {
  const res = await fetch(`${CONTENT_URL}/api/content/moderation/flagged?page=${page}&limit=${limit}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`getFlaggedPosts failed: ${res.status}`);
  return res.json();
}

export async function hidePost(token: string, postId: string, isPublished: boolean) {
  const res = await fetch(`${CONTENT_URL}/api/content/moderation/posts/${postId}/hide`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ isPublished }),
  });
  if (!res.ok) throw new Error(`hidePost failed: ${res.status}`);
  return res.json();
}

export async function getAuditLogs(token: string, page = 1, limit = 20) {
  const res = await fetch(`${CONTENT_URL}/api/content/moderation/audit-log?page=${page}&limit=${limit}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`getAuditLogs failed: ${res.status}`);
  return res.json();
}

export async function banUser(token: string, userIdToBan: string, reason: string) {
  const res = await fetch(`${CONTENT_URL}/api/content/moderation/ban`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ userIdToBan, reason }),
  });
  if (!res.ok) throw new Error(`banUser failed: ${res.status}`);
  return res.json();
}

