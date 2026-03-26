# Node Express Boilerplate

A production-ready Node.js/Express API boilerplate with **MongoDB**, **Socket.IO**, **JWT authentication**, and a clean, opinionated project structure.

Uses **ES Modules** (`import`/`export`) throughout.

---

## ⚠️ Must Read Before Using

1. **Services are just an example here.** You do NOT need a service layer for everything. Only extract logic into a service when:
   - Your controller is getting long and unwieldy.
   - The same logic is being reused across multiple controllers.
   - A dedicated service makes conceptual sense (e.g., an AI service that manages all prompt interactions throughout the app, keeping controllers clean).

   Otherwise, keep the logic in the controller directly, or use a simple utility function in `src/utils/`.

2. **Remove the AI-generated comments.** The codebase is heavily commented as a guide — these comments are meant to help you understand the structure, not to live in your production code. Before building on top of this boilerplate, **strip out the explanatory comments** or they will bloat your codebase. Keep only comments that document non-obvious business logic.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env          # then edit .env with your values

# 3. Start in development (auto-restarts on file changes)
npm run dev

# 4. Or start in production
npm start
```

The server starts on `http://localhost:5000` by default (configurable via `PORT` in `.env`).

---

## Available Scripts

| Command              | Description                                        |
| -------------------- | -------------------------------------------------- |
| `npm start`          | Start the server with Node                         |
| `npm run dev`        | Start with nodemon (auto-reload on changes)        |
| `npm run seed:users` | Seed sample users into the database                |
| `npm test`           | Run tests (placeholder — wire up your test runner) |

---

## Project Structure

```
node-express-boilerplate/
├── .env.example            # sample environment variables
├── .gitignore
├── nodemon.json            # dev watcher config
├── package.json
├── public/                 # static frontend files served by Express
│   ├── index.html
│   └── assets/
├── scripts/                # one-off maintenance / seed scripts
│   └── seed.js
├── uploads/                # runtime upload directory
│   └── .gitkeep
└── src/
    ├── app.js              # ★ application entry point
    ├── config/
    │   ├── env.js          # environment variables (single source of truth)
    │   ├── db.js           # MongoDB connection
    │   ├── client.js       # external service clients (OpenAI, Twilio, etc.)
    │   └── socket.js       # Socket.IO initialisation
    ├── controllers/
    │   └── user.controller.js
    ├── middleware/
    │   ├── auth.js         # JWT verification & role authorization
    │   └── validate.js     # Joi request validation
    ├── models/
    │   └── User.js
    ├── routes/
    │   ├── index.js        # root router — mounts all feature routers
    │   └── user.routes.js
    ├── services/
    │   └── user.service.js
    ├── sockets/
    │   ├── index.js        # registers all socket handlers
    │   └── chat.handler.js # example socket handler (rooms + messaging)
    └── utils/
        └── helpers.js      # shared utility functions
```

---

## What Goes Where — Architectural Guide

### `src/app.js` — Entry Point

The single bootstrap file. It:

1. Creates the Express app and HTTP server.
2. Registers global middleware (CORS, JSON parser, morgan logger).
3. Serves static files from `public/`.
4. Mounts all API routes under `/api`.
5. Initialises Socket.IO.
6. Connects to MongoDB and starts listening.

> **Rule of thumb:** Don't put business logic here. Only wiring.

---

### `src/config/` — Configuration

| File        | Purpose                                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env.js`    | Reads `.env` via dotenv and exports individual constants. **Every env var used in the app should be declared here.** No other file should read `process.env` directly. |
| `db.js`     | Connects Mongoose to MongoDB. Called once at server start.                                                                                                             |
| `client.js` | Initialises external SDK clients (OpenAI, Twilio, Stripe, etc.). Create the client once, export it, and import where needed.                                           |
| `socket.js` | Creates the Socket.IO `Server`, registers handlers, and exports `getIO()` for emitting events from anywhere.                                                           |

#### Adding a new env var

1. Add the default to `.env.example`.
2. Export it from `src/config/env.js`.
3. Import the constant wherever you need it.

#### Adding a new external client

1. Install the SDK: `npm install openai`
2. Add the API key to `env.js`.
3. Create and export the client in `client.js`:

```js
import OpenAI from "openai";
import { OPENAI_API_KEY } from "./env.js";

export const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;
```

---

### `src/routes/` — Route Definitions

- **`index.js`** is the root router. It composes all feature routers and is mounted at `/api` in `app.js`.
- Each feature gets its own file (e.g., `user.routes.js`, `post.routes.js`).
- Routes define **HTTP method + path + middleware chain + controller handler**. No business logic here.

#### Adding a new route group

1. Create `src/routes/orders.routes.js`:

```js
import { Router } from "express";
import * as orderCtrl from "../controllers/order.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();
router.get("/", auth, orderCtrl.list);
router.post("/", auth, orderCtrl.create);
export default router;
```

2. Mount it in `src/routes/index.js`:

```js
import orderRoutes from "./orders.routes.js";
router.use("/orders", orderRoutes);
```

Now `GET /api/orders` and `POST /api/orders` work.

---

### `src/controllers/` — Request Handlers

Thin functions that:

1. Extract input from `req.body` / `req.params` / `req.query`.
2. Call a **service** function.
3. Send the response.

Controllers should **not** contain database queries or business logic directly.

```js
export async function create(req, res) {
  try {
    const order = await orderService.createOrder(req.body, req.user.id);
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}
```

---

### `src/services/` — Business Logic

This is where the real work happens:

- Database operations via Mongoose models.
- Calls to external APIs via clients from `config/client.js`.
- Validation, transformations, calculations.
- Background job scheduling.

Services are **framework-agnostic** — they don't know about `req`/`res`. They receive plain data and return plain data or throw errors.

```js
export async function createOrder(data, userId) {
  // validate, compute, persist
  const order = await Order.create({ ...data, user: userId });
  return order;
}
```

---

### `src/models/` — Database Schemas

Mongoose models and schemas. Each file exports one model.

- Define the schema, indexes, hooks (pre-save, etc.), and instance/static methods.
- The included `User.js` is a working example with password hashing, comparison, and JSON sanitisation.

```js
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    /* ... */
  },
  { timestamps: true },
);
export default mongoose.model("Order", orderSchema);
```

---

### `src/middleware/` — Express Middleware

| File          | Purpose                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.js`     | Extracts & verifies JWT from `Authorization: Bearer <token>`. Attaches `req.user`. Also exports `authorize(...roles)` for role-based access. |
| `validate.js` | Takes a Joi schema and validates `req.body` (or `req.query`/`req.params`). Returns 422 with details on failure.                              |

#### Adding custom middleware

Create a new file in `src/middleware/` and import it in your route files:

```js
// src/middleware/rateLimit.js
export function rateLimit(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    /* ... */
  };
}
```

---

### `src/sockets/` — Socket.IO Event Handlers

Real-time functionality is organised by feature, mirroring the route/controller pattern.

| File              | Purpose                                                                   |
| ----------------- | ------------------------------------------------------------------------- |
| `index.js`        | Entry point — registers all handler groups on each new socket connection. |
| `chat.handler.js` | Example handler: room joining/leaving and message broadcasting.           |

#### How it works

1. `src/config/socket.js` creates the Socket.IO server and listens for `connection` events.
2. On each connection, it calls `registerSocketHandlers(io, socket)` from `src/sockets/index.js`.
3. That function calls each feature handler (e.g., `registerChatHandlers`), which attaches `socket.on(...)` listeners.

#### Adding a new socket feature

1. Create `src/sockets/notification.handler.js`:

```js
export function registerNotificationHandlers(io, socket) {
  socket.on("notification:subscribe", (channel) => {
    socket.join(`notify:${channel}`);
  });
}
```

2. Import and call it in `src/sockets/index.js`:

```js
import { registerNotificationHandlers } from "./notification.handler.js";

export default function registerSocketHandlers(io, socket) {
  registerChatHandlers(io, socket);
  registerNotificationHandlers(io, socket); // ← add
}
```

#### Emitting events from services/controllers

Use `getIO()` to push events from anywhere in the server:

```js
import { getIO } from "../config/socket.js";

// Inside a service function:
getIO().to(roomId).emit("order:status", { orderId, status: "shipped" });
```

---

### `src/utils/` — Shared Helpers

Pure utility functions with no Express or Mongoose dependencies.

The included `helpers.js` provides:

- `sleep(ms)` — delay execution (useful for retries / rate limiting).
- `safeJsonParse(str)` — parse JSON without throwing.
- `pick(obj, keys)` — select specific keys from an object.

Add your own: date formatting, string sanitisation, file helpers, etc.

---

### `scripts/` — One-Off Tasks

Maintenance and seeding scripts that run **outside** the server process.

```bash
node scripts/seed.js          # or: npm run seed:users
```

- Each script connects to the database, does its work, then disconnects.
- Keep them decoupled from the runtime server — they import models and config, nothing else.

Good candidates for scripts:

- Database seeding / migration
- Data backfills
- External API sync jobs
- Stats / reporting rollups

---

### `public/` — Static Frontend

Express serves everything in `public/` as static files. Options:

1. **Simple landing page** — the default `index.html`.
2. **SPA build** — copy your React/Vue/Svelte build output here for a single deployable artifact. Uncomment the SPA fallback in `app.js`.
3. **None** — delete `public/` if this is a pure API backend.

---

### `uploads/` — Runtime Upload Storage

Directory for file uploads handled by the server. Ignored by git (except `.gitkeep`).

---

## API Reference

### Base URL

```
http://localhost:5000/api
```

### Health Check

```
GET /health  →  { "status": "ok", "uptime": 123.45 }
```

### Auth Endpoints (example)

| Method | Path                  | Auth   | Description                |
| ------ | --------------------- | ------ | -------------------------- |
| POST   | `/api/users/register` | No     | Create a new user          |
| POST   | `/api/users/login`    | No     | Login, returns JWT         |
| GET    | `/api/users/me`       | Bearer | Get current user           |
| GET    | `/api/users`          | Admin  | List all users (paginated) |

#### Register

```bash
curl -X POST http://localhost:5000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","password":"secret123"}'
```

#### Login

```bash
curl -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"secret123"}'
```

Response includes a `token` — use it in subsequent requests:

```bash
curl http://localhost:5000/api/users/me \
  -H "Authorization: Bearer <token>"
```

---

## Socket.IO Events (example)

Connect to `http://localhost:5000` with a Socket.IO client.

| Event (client → server) | Payload                        | Description          |
| ----------------------- | ------------------------------ | -------------------- |
| `chat:join`             | `roomId` (string)              | Join a chat room     |
| `chat:leave`            | `roomId` (string)              | Leave a chat room    |
| `chat:message`          | `{ roomId, message }` (object) | Send message to room |

| Event (server → client) | Payload                                    | Description             |
| ----------------------- | ------------------------------------------ | ----------------------- |
| `chat:user-joined`      | `{ socketId, roomId }`                     | A user joined the room  |
| `chat:user-left`        | `{ socketId, roomId }`                     | A user left the room    |
| `chat:message`          | `{ socketId, roomId, message, timestamp }` | New message in the room |

---

## Adding a New Feature — Step by Step

Say you're adding an **Orders** feature:

1. **Model** — `src/models/Order.js` → define the Mongoose schema.
2. **Service** — `src/services/order.service.js` → business logic (create, list, update).
3. **Controller** — `src/controllers/order.controller.js` → thin handlers calling the service.
4. **Routes** — `src/routes/order.routes.js` → HTTP method + path + middleware + controller.
5. **Mount** — import and `.use()` the route in `src/routes/index.js`.
6. **Socket (optional)** — `src/sockets/order.handler.js` → real-time events, registered in `src/sockets/index.js`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

| Variable         | Default                     | Description                       |
| ---------------- | --------------------------- | --------------------------------- |
| `PORT`           | `5000`                      | Server port                       |
| `NODE_ENV`       | `development`               | Environment mode                  |
| `MONGO_URI`      | `mongodb://127.0.0.1:27017` | MongoDB connection URI            |
| `MONGO_DB_NAME`  | `express_boilerplate`       | Database name                     |
| `JWT_SECRET`     | `super-secret-change-me`    | JWT signing secret                |
| `JWT_EXPIRES_IN` | `14d`                       | Token expiry duration             |
| `CORS_ORIGINS`   | `http://localhost:3000`     | Allowed origins (comma-separated) |

---

## Tech Stack

- **Runtime:** Node.js (ES Modules)
- **Framework:** Express 4
- **Database:** MongoDB + Mongoose
- **Real-time:** Socket.IO
- **Auth:** JWT (jsonwebtoken + bcryptjs)
- **Validation:** Joi
- **Dev tooling:** nodemon

---

## License

ISC
