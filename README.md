# DigitalRoots_XZ
Bridging generational gap app

---

## API Endpoints (detailed): Technology • Function • Project Usage • Effects

> This section documents the **microservices endpoints actually present in the repository code** and how the frontend (and services-to-services) uses them.
>
> **Auth convention (HTTP):**
> - Frontend sends `Authorization: Bearer <token>`.
> - Backend auth middleware reads the token and attaches `req.user`.
> - Chat and most content endpoints require auth via `verifyToken`.

---

## 1) xz-chat-service (Express + Socket.io)

---

## Chat & Calls: How two users communicate (HTTP + Socket.io + WebRTC)

### A) How two users send chat messages
1. **Frontend → backend (HTTP)**
   - The user sends a message using:
     - `POST /api/chat/threads/:threadId/messages`
   - Frontend function: `xz-chat-service/frontend/src/api.ts -> sendTextMessage()`
   - Technology: **Express** route + **MongoDB** message creation.

2. **Backend → all recipients (Socket.io)**
   - After the message is created, the backend emits a realtime event:
     - Socket event: `new-message`
     - Target room: `thread:${threadId}`
   - Backend code:
     - `xz-chat-service/src/controllers/chat.controller.ts -> deliverAndEmitMessage()`
   - Technology: **Socket.io rooms**.

3. **Online vs offline delivery / notifications**
   - For recipients who are currently connected, message delivery is tracked in the message document.
   - For recipients who are offline, a notification is created by calling the notification microservice.
   - Effect:
     - Online users see the message instantly.
     - Offline users receive a notification entry that the notification service will relay later.

### B) How “typing indicators” work
- Frontend emits typing through Socket.io.
- Server listens on:
  - `typing-start`, `typing-stop`
- Server broadcasts to the thread room:
  - `user-typing`, `user-stopped-typing`
- Backend: `xz-chat-service/src/sockets/message.handlers.ts`

### C) Are calls made with Jitsi or WebRTC?
- **This project uses WebRTC signaling via Socket.io**.
- There is **no Jitsi integration** in the backend socket handlers.
- WebRTC happens **between browsers** (peer-to-peer media).

#### Real role of the Chat Service in video/audio calls
Chat service does **not** transmit the actual audio/video media streams.
It only provides the signaling channel and call-state synchronization.

#### What WebRTC messages are relayed
The chat socket handler relays these signaling events to the target user’s socket room:
- `webrtc-offer` → forwarded to `user:${targetUserId}`
- `webrtc-answer` → forwarded to `user:${targetUserId}`
- `webrtc-candidate` → forwarded to `user:${targetUserId}`

These three events are the standard WebRTC handshake pieces:
- Offer/Answer: exchange SDP session descriptions.
- ICE candidates: exchange connectivity/network traversal info.

#### How users “join the call” (room management)
- Frontend calls:
  - `join-call` with `{ threadId }`
- Backend behavior:
  - `socket.join('call:${threadId}')`
- Then other events are broadcast in that call room:
  - `toggle-audio` → `user-audio-toggled`
  - `toggle-video` → `user-video-toggled`
  - `toggle-recording` → `recording-toggled`
  - `send-caption` → `new-caption`
  - `end-call-session` → `call-ended`

#### Real meaning: “Call” vs “Video call”
- The signaling and state sync supports both **audio-only** and **video**:
  - Audio is controlled by `toggle-audio` (mute/unmute).
  - Video is controlled by `toggle-video` (camera on/off).
- The presence of these toggles means the call can be used for:
  - voice calls
  - video calls
  - also live captions

---


### Tech used
- **Express**: REST controllers & routes.
- **Socket.io**: persistent real-time events (messages, typing indicators, presence, call signaling).
- **Multer**: multipart upload handling (file/voice uploads).
- **MongoDB/Mongoose**: `Thread`, `Message`, `Report` documents.
- **Inter-service HTTP**: notifications are POSTed/cleared via the notification service.

### Base path
- Express mounts routes at: `/api/chat/*` (from `xz-chat-service/src/app.ts`).

### Socket.io rooms/events (real-time)
- Socket server is created in `xz-chat-service/src/app.ts` and middleware `verifySocketToken` is applied.
- Rooms:
  - `user:${userId}` for per-user events (presence, notifications, call signaling targets).
  - `thread:${threadId}` for per-thread events (new messages, topic updates).
  - `call:${threadId}` for call state sync (audio/video toggles, captions, etc.).

---

### HTTP endpoints: Threads & Messages

#### 1.1 `GET /api/chat/threads`
- **Technology**: Express route + Controller + Mongo query.
- **How it functions**:
  - Reads `req.user.firebase_uid`.
  - Calls `ChatService.getUserThreads(firebaseUid, page, limit)`.
- **How it’s used in the project**:
  - Frontend: `xz-chat-service/frontend/src/api.ts -> getThreads()`
- **Effect**:
  - Returns the user’s active thread list (for sidebar / thread list rendering).

#### 1.2 `POST /api/chat/threads/:targetUserId`
- **Technology**: Express controller + internal call to user-service + Mongo service.
- **How it functions**:
  - Validates `firebaseUid` and `targetUserId`.
  - Blocks direct messages to **Admin** users by calling user-service:
    - `GET ${USER_SERVICE_URL}/api/users/${targetUserId}` with `x-internal-key`.
  - Creates or returns a direct thread via `ChatService.getOrCreateThread(...)`.
- **Frontend usage**:
  - `getOrCreateThread()` in `frontend/src/api.ts`
- **Effect**:
  - Prevents disallowed DM threads; initializes chat UI state with a thread id.

#### 1.3 `GET /api/chat/threads/:threadId/messages?before=&limit=`
- **Technology**: Express controller + Mongo pagination.
- **How it functions**:
  - Parses `before` as date (if provided) and `limit` (default 50).
  - Calls `ChatService.getMessages(threadId, firebaseUid, beforeDate, limit)`.
- **Frontend usage**:
  - `getMessages()` in `frontend/src/api.ts`
- **Effect**:
  - Loads the message history for infinite scroll / pagination.

#### 1.4 `POST /api/chat/threads/:threadId/messages`
- **Technology**: Express controller + Mongo write + Socket.io emit + notifications.
- **How it functions**:
  - Validates `content`.
  - Creates a message via `ChatService.sendTextMessage(...)`.
  - Emits `new-message` into `thread:${threadId}` via Socket.io.
  - Calls notification service for offline/desktop alerts (see `deliverAndEmitMessage`).
- **Frontend usage**:
  - `sendTextMessage()` in `frontend/src/api.ts`
- **Effect**:
  - Immediate real-time delivery to online thread participants + notification records for offline users.

#### 1.5 `GET /api/chat/threads/:threadId/archives`
- **Technology**: Express controller + Mongo query for shared archives.
- **Frontend usage**:
  - `getArchives()` in `frontend/src/api.ts`
- **Effect**:
  - Feeds “shared media/archives” section of a thread.

#### 1.6 `PUT /api/chat/threads/:threadId/topic`
- **Technology**: Express controller + Socket.io emit.
- **How it functions**:
  - Updates thread topic through `ChatService.updateThreadTopic(...)`.
  - Emits `topic-updated` to room `thread:${threadId}`.
- **Frontend usage**:
  - `updateTopic()` in `frontend/src/api.ts`
- **Effect**:
  - Topic changes instantly reflect on other clients in the same thread.

#### 1.7 `POST /api/chat/threads/:threadId/upload` (multipart)
- **Technology**: Express + Multer + FileService + Mongo + Socket.io.
- **How it functions**:
  - Multer parses `file`.
  - `FileService.getFileCategory()` determines image/video/audio.
  - `FileService.validateFile()` enforces size/MIME rules.
  - `FileService.uploadFile()` stores media and metadata.
  - `ChatService.sendFileMessage()` creates a message with type mapping:
    - image -> `MessageType.IMAGE`, video -> `MessageType.VIDEO`, audio -> `MessageType.AUDIO`.
  - Emits `new-message` to room `thread:${threadId}`.
- **Frontend usage**:
  - `uploadFile()` in `frontend/src/api.ts`
- **Effect**:
  - Enables media attachments inside threads.

#### 1.8 `POST /api/chat/threads/:threadId/voice` (multipart)
- **Technology**: Express + Multer + VoiceService + Transcription + Mongo + Socket.io.
- **How it functions**:
  - Multer receives `file` (webm) + `duration`.
  - `VoiceService.sendVoiceMessage(...)` creates voice transcription/voice message.
  - Fetches the saved message by `result.messageId`.
  - Emits `new-message` to `thread:${threadId}`.
- **Frontend usage**:
  - `sendVoiceNote()` in `frontend/src/api.ts`
- **Effect**:
  - Voice notes appear in the thread and get broadcast live.

#### 1.9 `POST /api/chat/threads/:threadId/read`
- **Technology**: Express + Mongo bulk update + Socket.io + notification cleanup.
- **How it functions**:
  - Updates `Message.readBy` and `deliveredTo` arrays.
  - Sets `Thread.unreadCount[uid]=0`.
  - Emits `messages-read` to each participant’s `user:${participantId}` room.
  - Calls notification service to clear chat notifications:
    - `DELETE ${NOTIFICATION_SERVICE_URL}/api/notifications/user/${firebaseUid}/reference/${threadId}`
- **Frontend usage**:
  - `markMessagesAsRead()` in `frontend/src/api.ts`
- **Effect**:
  - Removes unread badge counts and keeps notification DB consistent.

#### 1.10 `DELETE /api/chat/threads/:threadId/messages/:messageId`
- **Technology**: Express + Mongo soft delete + Socket.io.
- **How it functions**:
  - Ensures message exists and `msg.senderId === firebaseUid`.
  - Soft deletes:
    - `isDeleted=true`, `deletedAt=now`, `content='This message was deleted'`.
  - Emits `message-deleted` to all participants via `user:${participantId}` rooms.
- **Frontend usage**:
  - `deleteMessage()` in `frontend/src/api.ts`
- **Effect**:
  - Message deletion is authorized and synchronized in real-time.

#### 1.11 `POST /api/chat/threads/:threadId/report`
- **Technology**: Express + Mongo create.
- **How it functions**:
  - Finds the thread and ensures current user is a participant.
  - Identifies reported user (the other participant in a direct thread).
  - Creates `Report` document.
- **Frontend usage**:
  - `reportConnection()` in `frontend/src/api.ts`
- **Effect**:
  - Persists abuse report for moderation processes.

#### 1.12 `POST /api/chat/upload` (multipart)
- **Technology**: Express + Multer + FileService.
- **How it functions**:
  - Uploads a generic file (e.g. profile images).
  - Validates category and uploads (no thumbnail if configured).
- **Frontend usage**:
  - `uploadGenericFile()` in `frontend/src/api.ts`
- **Effect**:
  - Returns `{ url }` for immediate usage in UI.

---

## 2) xz-content-service (Express)

### Tech used
- **Express**: REST routes.
- **Multer / upload middleware**: file uploads.
- **Caching middleware**: `cacheMiddleware(...)` for GET endpoints.
- **MongoDB/Mongoose**: Posts/Stories/Knowledge documents.
- **TranscriptionService** (background queue) + transcription logic.
- **Admin role gating**: `requireRole(['Admin'])`.
- **Inter-service HTTP**: awards points + sends notifications on approvals.

### Base path
- Mounted from `xz-content-service/src/app.ts`:
  - `/api/content/posts/*`
  - `/api/content/stories/*`
  - `/api/content/knowledge/*`
  - `/api/content/moderation/*`

---

### 2.1 Posts endpoints

#### 2.1.1 `GET /api/content/posts/feed?page=&limit=&sort=&category=`
- **Technology**: Express + cache + Mongo paging.
- **How it functions**:
  - Requires auth (`verifyToken`).
  - Builds `query = { isPublished:true, isFlagged:false }` and optional `category`.
  - Sorts by `createdAt` using `sort` param.
- **Frontend usage**:
  - `getFeed()` in `frontend/src/contentApi.ts`
- **Effect**:
  - Feeds timeline posts for the app.

#### 2.1.2 `POST /api/content/posts/text`
- **Technology**: Express + controller + Mongo create.
- **How it functions**:
  - Validates `content`.
  - Creates Post with `PostType.TEXT`.
  - Clears cache pattern `feed:*`.
- **Frontend usage**:
  - `createTextPost()` in `contentApi.ts`
- **Effect**:
  - Adds a published text post.

#### 2.1.3 `POST /api/content/posts/media` (multipart)
- **Technology**: Express + Multer + FileService + Mongo create.
- **How it functions**:
  - Validates file category from MIME.
  - Uploads media via FileService to Cloudinary/local storage.
  - Creates Post with `IMAGE/VIDEO/AUDIO` type and metadata.
  - Clears cache.
- **Frontend usage**:
  - `createMediaPost()`
- **Effect**:
  - Adds media post to feed.

#### 2.1.4 `GET /api/content/posts/:postId`
- **Technology**: Express + Mongo query.
- **How it functions**:
  - Requires auth.
  - Finds by `postId` and `isPublished:true`.
  - Increments `views`.
- **Frontend usage**: (not explicitly found in `contentApi.ts` in the provided snippet, but backend supports it)
- **Effect**:
  - View tracking + single post fetch.

#### 2.1.5 `PUT /api/content/posts/:postId`
- **Technology**: Express + Mongo update + FileService (optional thumbnail).
- **How it functions**:
  - Requires auth.
  - Author-only update (`post.authorId === req.user.firebase_uid`).
  - Optionally uploads new thumbnail if `req.file` provided and MIME is image.
  - Clears cache.
- **Frontend usage**:
  - `editPost()` in `contentApi.ts`
- **Effect**:
  - Updates author’s post content.

#### 2.1.6 `DELETE /api/content/posts/:postId`
- **Technology**: Express + Mongo update/delete.
- **How it functions**:
  - If requester `role === Admin`, permanently deletes (`Post.deleteOne`).
  - Else author can soft delete: `isPublished=false`.
  - Clears cache.
- **Frontend usage**:
  - `deletePost()` in `contentApi.ts`
- **Effect**:
  - Removes content from feed.

#### 2.1.7 `POST /api/content/posts/:postId/comments`
- **Technology**: Express + Mongo array push.
- **How it functions**:
  - Adds comment object into `post.comments`.
- **Frontend usage**:
  - `addPostComment()` in `contentApi.ts`
- **Effect**:
  - Enables commenting.

#### 2.1.8 `DELETE /api/content/posts/:postId/comments/:commentId`
- **Technology**: Express + Mongo array splice.
- **How it functions**:
  - Admin can delete any comment; author can delete own.
  - Locates comment by `_id` string.
- **Frontend usage**:
  - `deletePostComment()` in `contentApi.ts`
- **Effect**:
  - Deletes comment.

#### 2.1.9 `POST /api/content/posts/:postId/comments/:commentId/like`
- **Technology**: Express + Mongo toggle.
- **How it functions**:
  - Backend toggles like array on comment.
- **Frontend usage**:
  - `likePostComment()` in `contentApi.ts`
- **Effect**:
  - Likes/unlikes comment.

#### 2.1.10 `POST /api/content/posts/:postId/reactions` and `DELETE .../reactions`
- **Technology**: Express + Mongo reaction array update.
- **How it functions**:
  - Validates reaction type.
  - Adds/removes user from matching reaction.
- **Frontend usage**:
  - `addPostReaction()` / `removePostReaction()` in `contentApi.ts`
- **Effect**:
  - Enables emoji-like reactions.

#### 2.1.11 `POST /api/content/posts/:postId/share`
- **Technology**: Express + Mongo `$inc` shares.
- **How it functions**:
  - Increments `shares` counter.
- **Frontend usage**:
  - `sharePost()` in `contentApi.ts`
- **Effect**:
  - Tracks share count.

#### 2.1.12 `POST /api/content/posts/:postId/flag`
- **Technology**: Express + Mongo update.
- **How it functions**:
  - Sets `isFlagged=true` and clears feed cache.
- **Frontend usage**:
  - `flagPost()` in `contentApi.ts`
- **Effect**:
  - Moves content into moderation queue.

---

### 2.2 Stories endpoints

#### 2.2.1 `GET /api/content/stories?page=&limit=&category=&tag=&isPublished=&authorId=`
- **Technology**: Express + cache + Mongo query.
- **How it functions**:
  - Auth required.
  - Builds query based on filters and role-based publication rules.
- **Frontend usage**:
  - `getStories()` in `contentApi.ts`
- **Effect**:
  - Renders story list.

#### 2.2.2 `POST /api/content/stories/upload`
- **Technology**: Express + Multer + FileService + Story model + background queue.
- **How it functions**:
  - Role gate: `requireRole(['Elder','Youth','Admin'])`.
  - Uploads file to storage.
  - Creates `Story` with `isPublished=false`.
  - Queues transcription only for audio.
- **Frontend usage**:
  - `uploadStory()` in `contentApi.ts`
- **Effect**:
  - Creates new archive candidate (awaits admin approval).

#### 2.2.3 `GET /api/content/stories/:storyId`
- **Technology**: Express + Mongo.
- **How it functions**:
  - Increments view counter.
- **Frontend usage**:
  - `getStoryDetails()` in `contentApi.ts`
- **Effect**:
  - Loads story detail page.

#### 2.2.4 `POST /api/content/stories/:storyId/like` and `DELETE .../like`
- **Technology**: Express + Mongo likes toggle.
- **Frontend usage**:
  - `likeStory()` / `unlikeStory()` in `contentApi.ts`
- **Effect**:
  - Like counter / engagement.

#### 2.2.5 `GET /api/content/stories/:storyId/transcription`
- **Technology**: Express + Mongo read.
- **How it functions**:
  - Returns `{ status, transcript }`.
- **Frontend usage**:
  - `getTranscription()` in `contentApi.ts`
- **Effect**:
  - Shows transcription progress and final text.

#### 2.2.6 `GET /api/content/stories/:storyId/transcript/download`
- **Technology**: Express + text response.
- **How it functions**:
  - Sends `transcript` as `text/plain` with attachment headers.
- **Frontend usage**: supported by backend; not shown in frontend snippet.
- **Effect**:
  - Allows users to download transcript file.

#### 2.2.7 Admin-only approval endpoints
- **PUT /api/content/stories/:storyId/approve**
- **PUT /api/content/stories/:storyId/reject**
- **POST /api/content/stories/bulk-approve**
- **DELETE /api/content/stories/:storyId**

**Technology (all)**: Express + role gate + Mongo state change +
- Audit log creation (`AuditLog`)
- Cache clearing (`stories:*`)
- Inter-service HTTP:
  - Award points via Point Service
  - Send notifications via Notification Service

**Frontend usage** (from `contentApi.ts`):
- `approveStory()` / `rejectStory()` / `bulkApproveStories()` / `deleteStory()`

**Effect**:
- Publishes or hides story archive in the ecosystem.

---

### 2.3 Knowledge endpoints

#### 2.3.1 `GET /api/content/knowledge/search?q=&category=&language=&page=&limit=`
- **Technology**: Express + cache + Mongo text search (`$text`).
- **How it functions**:
  - Requires auth.
  - Runs `KnowledgeArticle.find({ isPublished:true, $text:{ $search:q } })`.
  - Sorts by `textScore`.
- **Frontend usage**:
  - `searchArticles()` in `contentApi.ts`
- **Effect**:
  - Search page for knowledge library.

#### 2.3.2 `GET /api/content/knowledge/bookmarks`
- **Technology**: Express + Mongo query.
- **How it functions**:
  - Returns user-pinned articles with `bookmarks: userId`.
- **Frontend usage**:
  - `getSavedBookmarks()`
- **Effect**:
  - Loads bookmark list.

#### 2.3.3 `GET /api/content/knowledge/:knowledgeId`
- **Technology**: Express + cache + Mongo.
- **How it functions**:
  - Returns only `isPublished:true` article.
  - Increments `views`.
- **Frontend usage**:
  - `getArticleDetails()`
- **Effect**:
  - Article detail page.

#### 2.3.4 `POST /api/content/knowledge` (multipart optional cover image)
- **Technology**: Express + Multer + FileService + Mongo create.
- **How it functions**:
  - Requires `title/content/summary`.
  - Uploads cover image only if provided.
  - Creates article with `isPublished=false` initially.
- **Frontend usage**:
  - `createArticle()`
- **Effect**:
  - Adds new knowledge draft.

#### 2.3.5 `PUT /api/content/knowledge/:knowledgeId`
- **Technology**: Express + Mongo update + optional cover upload.
- **How it functions**:
  - Author-only update.
- **Frontend usage**:
  - `editArticle()`
- **Effect**:
  - Updates draft.

#### 2.3.6 `DELETE /api/content/knowledge/:knowledgeId`
- **Technology**: Express + Mongo delete.
- **How it functions**:
  - Author-only delete.
- **Frontend usage**:
  - `deleteArticle()`
- **Effect**:
  - Removes draft permanently.

#### 2.3.7 Like/Unlike
- `POST /api/content/knowledge/:knowledgeId/like`
- `DELETE /api/content/knowledge/:knowledgeId/like`

**Technology**: Express + Mongo toggle.

**Frontend usage**:
- `likeArticle()` / `unlikeArticle()`

**Effect**:
- Engagement & ranking.

#### 2.3.8 Bookmark/Unbookmark
- `POST /api/content/knowledge/:knowledgeId/bookmark`
- `DELETE /api/content/knowledge/:knowledgeId/bookmark`

**Technology**: Express + Mongo toggle.

**Frontend usage**:
- `bookmarkArticle()` / `unbookmarkArticle()`

**Effect**:
- Personal saved list.

#### 2.3.9 Admin-only publication & feature
- `PUT /api/content/knowledge/:knowledgeId/publish`
- `PUT /api/content/knowledge/:knowledgeId/feature`

**Technology**: Express + role gate + Mongo update + AuditLog.

**Inter-service effects**:
- Cache clearing only (points/notifications not directly called in controller code shown).

**Frontend usage**:
- `publishArticle()`

---

### 2.4 Moderation endpoints

> All endpoints under moderation routes are secured by `router.use(verifyToken, requireRole(['Admin']))`.

#### 2.4.1 `GET /api/content/moderation/flagged`
- **Technology**: Express + Mongo query.
- **How it functions**:
  - Returns posts where `isFlagged=true`.
- **Frontend usage**:
  - `getAnalytics()` exists but flagged endpoint isn’t in `contentApi.ts` snippet; supported by backend.
- **Effect**:
  - Admin moderation queue.

#### 2.4.2 `PUT /api/content/moderation/posts/:postId/hide`
- **Technology**: Express + Mongo update.
- **How it functions**:
  - Sets `isPublished` based on `req.body.isPublished`.
  - Writes AuditLog.
- **Effect**:
  - Hides/unhides content.

#### 2.4.3 `GET /api/content/moderation/analytics`
- **Technology**: Express + Mongo aggregates.
- **How it functions**:
  - Counts posts/stories/articles.
  - Aggregates views/comments/shares.
- **Frontend usage**:
  - `getAnalytics()` exists.
- **Effect**:
  - Admin dashboard metrics.

#### 2.4.4 `GET /api/content/moderation/audit-log`
- **Technology**: Express + Mongo read.
- **Effect**:
  - Admin audit trail.

#### 2.4.5 `POST /api/content/moderation/ban`
- **Technology**: Express + Mongo bulk update.
- **How it functions**:
  - Sets `isPublished=false` for all posts/stories/articles by banned author.
  - Writes AuditLog.
  - Clears caches.
- **Effect**:
  - Global content takedown for a user.

---

## 3) xz-feed-service

### Tech used
- **Express** controller.
- **Axios** for service-to-service REST calls.

### Base route
- `/api/feed/*` likely from app.ts (not opened here); the route present is:
  - `GET /personalized`

### Endpoint
#### `GET /personalized`
- **Technology**: Express + controller + axios.
- **How it functions**:
  - Reads authenticated user profile from user-service:
    - `GET ${USER_SERVICE_URL}/api/users/profile`
  - Fetches posts from content-service:
    - `GET ${CONTENT_SERVICE_URL}/api/content/posts` (note: route in content-service is mounted under `/api/content/posts/*` and the snippet indicates `/api/content/posts` might be implemented elsewhere or mismatch).
  - Scores posts based on category/language/community preferences.
  - Sorts by `feedScore`.
- **Frontend usage**: not mapped in the frontend snippets we opened.
- **Effect**:
  - Produces personalized feed ordering.

---

## 4) xz-user-service

### Tech used
- **Express** routes.
- **jsonwebtoken** (JWT).
- **MongoDB/Mongoose** user persistence.

### Base route
- `xz-user-service/src/app.ts` mounts user routes; from `routes/user.routes.ts` we know endpoints exist at `/api/users/*`.

### Endpoints

#### 4.1 `POST /api/users/register`
- **Technology**: Express controller + JWT issuance.
- **How it functions**:
  - Validates inputs.
  - Prevents direct registration as Admin.
  - Creates user in Mongo.
  - Signs JWT.
- **Effect**:
  - Creates new account.

#### 4.2 `POST /api/users/login`
- **Technology**: Express controller + password verification.
- **How it functions**:
  - Finds user by email.
  - Verifies password.
  - Signs JWT.
- **Effect**:
  - Auth token for frontend sessionStorage usage.

#### 4.3 `POST /api/users/admins`
- **Technology**: Express + role check.
- **How it functions**:
  - Requires requester to be Admin.
  - Creates admin user with Admin role.
- **Frontend usage**:
  - `createAdminUser()` exists in `contentApi.ts` (calls `http://localhost:3006/api/users/admins`).
- **Effect**:
  - Admin management tool.

#### 4.4 `GET /api/users/`
- **Technology**: Express controller.
- **Effect**:
  - Returns all users (no password).

#### 4.5 `GET /api/users/profile`
- **Technology**: Express + auth middleware.
- **How it functions**:
  - Returns the current user profile derived from JWT.
- **Effect**:
  - Used by feed service personalization.

#### 4.6 `PUT /api/users/profile`
- **Technology**: Express + Mongo update.
- **How it functions**:
  - Allows update of name/bio/community/preferences/avatar/password.
- **Effect**:
  - Profile editing.

#### 4.7 `PUT /api/users/:userId/rewards`
- **Technology**: Express + Mongo update.
- **How it functions**:
  - Used by point-service to sync legacy credits and badges.
- **Effect**:
  - Updates reward balances.

#### 4.8 `GET /api/users/verify`
- **Technology**: Express + auth.
- **Effect**:
  - Validates token payload.

---

## 5) xz-session-service

### Tech used
- **Express** routes.
- **MongoDB/Mongoose** for interviews and mentoring pairs.
- **Axios** to notification-service and point-service.

### Endpoints (from `routes/session.routes.ts`)

#### 5.1 `POST /api/sessions/interviews`
- **Technology**: Express + Interview model + axios.
- **How it functions**:
  - Creates an Interview record.
  - Sends proposal notification via notification-service.
- **Effect**:
  - Starts oral history session proposal.

#### 5.2 `PUT /api/sessions/interviews/:interviewId/confirm`
- **Technology**: Express + Mongo update + axios.
- **How it functions**:
  - Updates status to `confirmed`.
  - Sends confirmation notification to proposer.
- **Effect**:
  - Confirms scheduling.

#### 5.3 `PUT /api/sessions/interviews/:interviewId/complete`
- **Technology**: Express + Mongo update + axios.
- **How it functions**:
  - Updates status to `completed` and saves recordingUrl.
  - Awards points via point-service to both participants.
- **Effect**:
  - Finalizes interview workflow.

#### 5.4 `POST /api/sessions/mentoring`
- **Technology**: Express + Mongo MentoringPair + axios.
- **How it functions**:
  - Prevents duplicate active/requested pairings.
  - Creates pairing with `status=requested`.
  - Sends mentorship request notification.
- **Effect**:
  - Opens a mentorship request.

#### 5.5 `PUT /api/sessions/mentoring/:pairingId/accept`
- **Technology**: Express + Mongo update + axios.
- **How it functions**:
  - Updates pairing status to `active`.
  - Sends acceptance notification.
- **Effect**:
  - Starts mentorship relationship.

#### 5.6 `GET /api/sessions/mentoring/matches?userId=&role=`
- **Technology**: Express + axios + scoring algorithm.
- **How it functions**:
  - Loads current user profile and all users from user-service.
  - Scores compatibility and returns sorted matches.
- **Effect**:
  - Mentoring recommendations.

#### 5.7 `GET /api/sessions/mentoring/pairs?userId=`
- **Technology**: Express + Mongo query.
- **How it functions**:
  - Returns all pairs where user is mentor or mentee.
- **Effect**:
  - Shows active partnerships.

#### 5.8 `DELETE /api/sessions/mentoring/:pairingId`
- **Technology**: Express + Mongo delete + axios.
- **How it functions**:
  - Verifies requester is either mentorId or menteeId.
  - Deletes pairing.
  - Sends cancellation notification.
- **Effect**:
  - Cancels mentorship.

#### 5.9 `GET /api/sessions/interviews?userId=`
- **Technology**: Express + Mongo query.
- **How it functions**:
  - Filters interviews by userId participation.
- **Effect**:
  - Lists scheduled sessions.

---

## 6) xz-notification-service

### Tech used
- **Express** REST endpoints.
- **MongoDB/Mongoose** notification documents.
- **Fetch** to chat service internal WebSocket relay endpoint.

### Base path
- Routes at `/api/notifications/*` (from `notification.routes.ts`).

#### 6.1 `POST /api/notifications/`
- **Technology**: Express + Mongo create + inter-service websocket relay.
- **How it functions**:
  - Validates `userId/title/message/type`.
  - Creates notification document.
  - Relays to chat-service:
    - `POST http://localhost:3004/api/chat/internal/notifications`
- **Effect**:
  - Stores notification and pushes it live.

#### 6.2 `GET /api/notifications/:userId`
- **Technology**: Express + Mongo query.
- **Effect**:
  - Fetches all notifications for a user.

#### 6.3 `PUT /api/notifications/:notificationId/read`
- **Technology**: Express + Mongo update.
- **Effect**:
  - Marks one notification as read.

#### 6.4 `DELETE /api/notifications/:notificationId`
- **Technology**: Express + Mongo delete.
- **Effect**:
  - Removes one notification.

#### 6.5 `DELETE /api/notifications/user/:userId/reference/:referenceId`
- **Technology**: Express + Mongo deleteMany.
- **How it functions**:
  - Deletes only chat notifications where `type='chat_message'`.
- **Effect**:
  - Called by chat mark-read to clean unread notifications.

---

## 7) xz-point-service

### Tech used
- **Express** routes.
- **MongoDB/Mongoose** transactions and badges.
- **Axios** to sync user rewards and trigger badge notifications.

### Endpoints

#### 7.1 `POST /api/points/award`
- **Technology**: Express controller + rules engine.
- **How it functions**:
  - Validates `userId` and `action`.
  - Computes credits from `creditMap`.
  - Creates `CreditTransaction`.
  - Recalculates total credits.
  - Unlocks badges based on milestone counts.
  - Syncs new `legacyCredits` and `badges` to user-service:
    - `PUT ${USER_SERVICE_URL}/api/users/:userId/rewards`
  - Triggers badge notifications via notification-service.
- **Effect**:
  - Centralized points/badges mechanism.

#### 7.2 `GET /api/points/:userId/history`
- **Technology**: Express controller + Mongo queries.
- **How it functions**:
  - Loads transactions and badges.
  - Computes balance.
- **Effect**:
  - Renders credits history UI.

---

## Frontend link summary (where you modify endpoint usage)

- **Chat REST API**: `xz-chat-service/frontend/src/api.ts`
  - If you change any `/api/chat/...` endpoint: update corresponding function here.
- **Chat real-time**: `xz-chat-service/frontend/src/socket.ts` + components using `socket`
  - If you change socket events: update event name strings + listener registration.
- **Content REST API**: `xz-chat-service/frontend/src/contentApi.ts`
  - If you change `/api/content/...`: update corresponding helper here.

---

