# CampusConnect — Quick Overview

**Author:** Mansi Thakur  
**Type:** Full-stack campus communication platform  
**Stack:** React 19 + Vite · Express 5 · MongoDB · Socket.IO · WebRTC

---

## What It Does

CampusConnect connects **students**, **teachers**, and **admins** in one platform with:

- Email-verified registration & JWT auth
- Teacher approval before chat access
- Department/year-scoped messaging
- Real-time chat (typing, receipts, reactions, edits, voice/files)
- Audio/video calls (WebRTC)
- Admin panel (users, departments, academic years)

---

## Project Structure

```
campus connect/
├── campus-api/     # Backend (Express + MongoDB + Socket.IO)
├── campus-web/     # Frontend (React + Vite + Tailwind)
└── docs/           # Documentation
```

---

## Quick Start

### Backend

```bash
cd campus-api
npm install
cp .env.example .env   # fill MONGO_URI, JWT secrets, email config
npm run seed:admin     # create admin user
npm run dev            # http://localhost:5000
```

### Frontend

```bash
cd campus-web
npm install
cp .env.example .env   # VITE_API_URL, VITE_SOCKET_URL
npm run dev            # http://localhost:5173
```

---

## User Roles

| Role | Login | After Login |
|------|-------|-------------|
| **Student** | `/login` | Complete profile → Dashboard → Chat |
| **Teacher** | `/login` | Complete profile → Admin approval → Chat |
| **Admin** | `/admin/login` | Dashboard, users, departments, chat |

---

## Key Features (Implemented)

| Module | Status |
|--------|--------|
| Auth (register, login, email verify, JWT refresh) | ✅ |
| Profile completion | ✅ |
| Teacher approval | ✅ |
| Admin CRUD | ✅ |
| Real-time chat | ✅ |
| Voice/video calls | ✅ |
| Campus AI (Gemini) | ❌ Future |
| Forgot password | ❌ Future |

---

## Tests

| Layer | Files | Cases |
|-------|-------|-------|
| Backend | 5 | 41 |
| Frontend | 5 | 18 |
| **Total** | **10** | **59** |

```bash
cd campus-api && npm test
cd campus-web && npm test
```

---

## Related Docs

| File | Contents |
|------|----------|
| [architecture.md](./architecture.md) | System design & data flow |
| [database-schema.md](./database-schema.md) | MongoDB collections |
| [api-standards.md](./api-standards.md) | REST API endpoints |
| [development-rules.md](./development-rules.md) | Coding conventions |
| [CampusConnect-Project-Report.md](./CampusConnect-Project-Report.md) | Full project report |
