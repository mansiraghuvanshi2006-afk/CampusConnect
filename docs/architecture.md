# CampusConnect — Architecture

## High-Level Stack

```
React SPA (campus-web)
    ↓ REST (Axios)          ↓ WebSocket (Socket.IO)
Express API (campus-api)
    ↓
MongoDB
```

---

## Backend Layers

| Layer | Location | Role |
|-------|----------|------|
| Routes | `src/routes/` | URL mapping |
| Controllers | `src/controllers/` | HTTP in/out |
| Services | `src/services/` | Business logic |
| Models | `src/models/` | MongoDB schemas |
| Middleware | `src/middleware/` | Auth, validation, uploads |
| Sockets | `src/sockets/` | Real-time events |

**Pattern:** Routes → Controllers → Services → Models

---

## Frontend Layers

| Layer | Location | Role |
|-------|----------|------|
| Pages | `src/pages/` | Route screens |
| Components | `src/components/` | Reusable UI |
| Services | `src/services/` | API calls |
| Context | `src/context/` | Auth state |
| Socket | `src/socket/` | Real-time connection |
| Utils | `src/utils/` | Chat state reducers |

**State:** React Context (auth + socket) + local state in ChatPage. No Redux.

---

## Authentication Flow

1. **Login** → access token in `localStorage` + refresh token in HttpOnly cookie
2. **API calls** → `Authorization: Bearer <token>`
3. **401 response** → auto-refresh via `/auth/refresh` (queued to prevent races)
4. **Socket** → connects with JWT when user is chat-eligible

---

## Real-Time Architecture

```
Socket.IO Server (same port as Express)
├── Rooms: user:{id}, conversation:{id}
├── Auth: JWT on handshake + canUseChat()
└── Events: message:*, call:*, presence:*
```

**WebRTC:** Server relays SDP/ICE only. Media is peer-to-peer (mesh) on clients.

---

## Chat Policy

All chat access goes through `chatPolicyService.js`:

- Email verified + account active
- Profile completed
- Teachers must be **approved**
- Direct chats: same department + role rules
- Groups: type-based permissions (`direct`, `teacher_group`, `official_group`, `announcement`)

---

## Security Summary

- Helmet, CORS, bcrypt, JWT + refresh rotation
- SHA-256 hashed refresh tokens in Session (TTL index)
- Zod validation on inputs
- Socket rate limits (40 msgs / 15s)
- Multer file upload whitelist

---

## Environment Variables

**Backend:** `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`, email vars  
**Frontend:** `VITE_API_URL`, `VITE_SOCKET_URL`

See `.env.example` in each package.
