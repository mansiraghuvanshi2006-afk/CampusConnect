# CampusConnect — API Reference

**Base URL:** `/api/v1`  
**Auth:** `Authorization: Bearer <access_token>` (unless Public)  
**Response:** `{ success, message, data }`

---

## Health

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/health` | Public |

---

## Auth

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| POST | `/auth/register` | Public | `{ name, email, password, role }` |
| POST | `/auth/login` | Public | `{ email, password }` |
| POST | `/auth/verify-email` | Public | `{ token }` |
| POST | `/auth/resend-verification` | Public | `{ email }` |
| POST | `/auth/refresh` | Cookie | — |
| POST | `/auth/logout` | Cookie | — |
| GET | `/auth/me` | Bearer | — |
| GET | `/auth/sessions` | Bearer | — |
| DELETE | `/auth/sessions/:sessionId` | Bearer | — |
| POST | `/auth/logout-all` | Bearer | — |

---

## Profile

| Method | Endpoint | Body |
|--------|----------|------|
| PATCH | `/profile/student` | `{ department, year }` |
| PATCH | `/profile/teacher` | `{ department, teachingYears }` |
| GET | `/profile-options/departments` | — |
| GET | `/profile-options/departments/:id/years` | — |

---

## Admin (requires role: admin)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/dashboard` | Stats |
| GET | `/admin/teachers/pending` | Pending teachers |
| PATCH | `/admin/teachers/:id/approve` | Approve |
| PATCH | `/admin/teachers/:id/reject` | Reject |
| GET | `/admin/users` | List (filter: type, search, page) |
| GET | `/admin/users/:id` | Get user |
| PATCH | `/admin/users/:id/status` | Activate/deactivate |
| PATCH | `/admin/users/:id` | Update |
| DELETE | `/admin/users/:id` | Delete (`confirmation: "DELETE"`) |
| POST/GET/PATCH/DELETE | `/admin/departments` | Department CRUD |
| GET/POST | `/admin/departments/:id/years` | Academic years |
| GET/PATCH/DELETE | `/admin/academic-years/:id` | Academic year CRUD |

---

## Chat

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/chat/eligible-users` | Users you can chat with |
| GET | `/chat/conversations` | List conversations |
| POST | `/chat/conversations/direct` | Start direct chat |
| POST | `/chat/conversations/groups` | Create group |
| GET | `/chat/conversations/:id` | Get conversation |
| GET | `/chat/conversations/:id/messages` | Messages (`?before=&limit=`) |
| POST | `/chat/conversations/:id/messages` | Send message |
| POST | `/chat/conversations/:id/attachments` | Upload files (max 5) |
| GET | `/chat/conversations/:id/search` | Search messages |
| PATCH | `/chat/conversations/:id/read` | Mark read |
| PATCH | `/chat/conversations/:id/pin` | Pin conversation |
| PATCH | `/chat/messages/:id` | Edit message |
| DELETE | `/chat/messages/:id/me` | Delete for me |
| DELETE | `/chat/messages/:id/everyone` | Delete for everyone |
| POST | `/chat/messages/:id/reactions` | React |
| POST | `/chat/messages/:id/pin` | Pin message |
| POST | `/chat/messages/:id/forward` | Forward |
| GET | `/chat/notifications` | Notifications |
| POST | `/chat/conversations/:id/calls` | Start call |
| POST | `/chat/calls/:id/accept` | Accept call |
| POST | `/chat/calls/:id/reject` | Reject call |
| POST | `/chat/calls/:id/end` | End call |

---

## Socket Events (Client ↔ Server)

**Connect:** JWT in `socket.auth.token`

| Emit (client → server) | Listen (server → client) |
|------------------------|--------------------------|
| `conversation:join` | `message:new` |
| `message:send` | `message:delivered`, `message:read` |
| `message:typing` | `message:typing`, `message:stop-typing` |
| `message:edit`, `message:delete` | `message:edited`, `message:deleted` |
| `message:react`, `message:pin` | `message:reaction`, `message:pinned` |
| `call:start`, `call:accept`, `call:end` | `call:incoming`, `call:accept`, `call:end` |
| `call:offer`, `call:answer`, `call:ice` | `call:offer`, `call:answer`, `call:ice` |
| — | `presence:online`, `presence:offline`, `presence:snapshot` |
| — | `notification:new` |

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Forbidden (policy/role) |
| 404 | Not found |
| 409 | Duplicate (email, directKey) |
| 500 | Server error |
