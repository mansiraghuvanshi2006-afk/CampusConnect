# CampusConnect — Database Schema

**Database:** MongoDB · **ODM:** Mongoose 9 · **Collections:** 9

---

## Collections Overview

| Collection | Purpose |
|------------|---------|
| **users** | Students, teachers, admins |
| **sessions** | Refresh token sessions (TTL) |
| **departments** | Academic departments |
| **academicyears** | Years per department |
| **conversations** | Direct & group chats |
| **messages** | Chat messages |
| **messagereceipts** | Delivery & read receipts |
| **notifications** | In-app notifications |
| **calls** | Audio/video call state |

---

## Users

| Field | Type | Notes |
|-------|------|-------|
| name | String | 2–100 chars |
| email | String | Unique, lowercase |
| password | String | bcrypt hashed, select: false |
| role | Enum | `student`, `teacher`, `admin` |
| isEmailVerified | Boolean | Must be true to use chat |
| isActive | Boolean | Account status |
| teacherApprovalStatus | Enum | `not_required`, `pending`, `approved`, `rejected` |
| department | ObjectId | → Department |
| year | Number | 1–10 (students) |
| teachingYears | [Number] | Teachers |
| profileCompleted | Boolean | Required for chat |
| lastSeenAt | Date | Presence |

---

## Sessions

| Field | Type | Notes |
|-------|------|-------|
| user | ObjectId | → User |
| sessionId | String | Unique |
| refreshTokenHash | String | SHA-256 |
| expiresAt | Date | **TTL index** — auto-delete |

---

## Conversations

| Field | Type | Notes |
|-------|------|-------|
| type | Enum | `direct`, `teacher_group`, `official_group`, `announcement` |
| members | Array | user, role, unreadCount, isPinned, lastReadAt |
| directKey | String | Sorted user IDs (unique for direct) |
| department | ObjectId | Optional scope |
| academicYears | [Number] | Optional scope |
| onlyAdminsCanSend | Boolean | Announcement mode |

---

## Messages

| Field | Type | Notes |
|-------|------|-------|
| conversation | ObjectId | → Conversation |
| sender | ObjectId | → User |
| type | Enum | `text`, `system`, `image`, `file`, `voice`, `call` |
| text | String | Max 5000 |
| temporaryId | String | Idempotency (unique partial index) |
| attachments | Array | File metadata + URLs |
| reactions | Array | user + emoji (8 allowed) |
| edited / deletedForEveryone | Boolean | Edit window: 15 min default |

---

## MessageReceipts

| Field | Type | Notes |
|-------|------|-------|
| message | ObjectId | → Message |
| user | ObjectId | → User |
| deliveredAt | Date | |
| seenAt | Date | |

**Index:** Unique `{ message, user }`

---

## Calls

| Field | Type | Notes |
|-------|------|-------|
| conversation | ObjectId | → Conversation |
| caller | ObjectId | → User |
| type | Enum | `audio`, `video` |
| status | Enum | `ringing`, `active`, `ended`, `missed`, `rejected`, `busy`, `failed` |
| participants | Array | user, muted, cameraOff, screenSharing |

---

## Relationships

```
Department ──< AcademicYear
Department ──< User
Department ──< Conversation

User ──< Session
User ──< Message (sender)
User ──< MessageReceipt
User ──< Notification

Conversation ──< Message
Conversation ──< Call
Message ──< MessageReceipt
```

---

## Key Indexes

- **Users:** unique email
- **Sessions:** TTL on expiresAt
- **Conversations:** partial unique directKey; member + lastMessageAt
- **Messages:** conversation + createdAt (cursor pagination)
- **MessageReceipts:** unique message + user
