# Meetify

Meetify is a real-time video meeting app. Users register and log in, create or join a meeting by code, and communicate over live audio/video with in-call chat. The backend is an Express + MongoDB API for auth and meeting history; real-time media and signalling run through Socket.IO and WebRTC.

## Live Demo

- **Frontend:** [https://meetify-frontend.onrender.com](https://meetify-frontend.onrender.com)
- **Backend:** [https://meetify-backend.onrender.com](https://meetify-backend.onrender.com)

Both are hosted on Render's free tier, so the first request after a period of inactivity can take a while to respond while the instance spins back up.

## Try It Out

No signup needed — log in with the shared demo account:

- **Username:** `demo`
- **Password:** `demo1234`

This is a shared account, so meeting history is visible to anyone who logs in with it.

To test a call: open the app in two browser windows (or two devices), log in, and join the same meeting code from both.

**Note:** Video connections may fail if participants are on mobile data or restrictive corporate networks. This demo uses STUN only (no TURN relay server), so peers behind symmetric NAT can't establish a direct connection. Use WiFi for best results.

## Tech Stack

**Backend**
- Node.js, Express 5
- MongoDB with Mongoose
- Socket.IO (signalling)
- bcrypt (password hashing), CORS, dotenv

**Frontend**
- React 19, Vite
- React Router
- MUI (Material UI) components
- Axios
- socket.io-client

## Features

- Register and log in (username/password)
- Create or join a meeting by a shared code
- Real-time audio/video calling via WebRTC
- In-call text chat
- Mute/unmute, camera on/off, and screen sharing
- Meeting history per user

## Architecture

**Signalling.** The backend runs a Socket.IO server (`backend/src/controllers/socketManager.js`) alongside the Express API. Clients join a meeting by emitting `join-call` with the meeting code; the server tracks socket IDs per room in memory and broadcasts `user-joined`/`user-left` events. WebRTC offer/answer SDP and ICE candidates are relayed between peers as opaque payloads through a single `signal` event — the server never inspects or stores this data, it just forwards it to the target socket ID.

**Peer connections (mesh).** Video/audio itself does not go through the server. Each client opens a direct `RTCPeerConnection` to every other participant in the room (full mesh) — when a new peer joins, it creates a connection to each existing participant and initiates the offer/answer exchange over the signalling channel. With N participants, each client maintains N-1 simultaneous peer connections.

**Auth.** Login issues an opaque token generated with `crypto.randomBytes(20).toString("hex")`, stored on the user's document in MongoDB (`user.token`). It is **not** a JWT — there's no signing, expiry, or claims encoded in it; the server looks it up by exact match in the `users` collection on each authenticated request. The frontend stores this token in `localStorage` and sends it as a query param or body field (not an `Authorization` header).

## Local Setup

### Prerequisites
- Node.js
- A MongoDB connection string (e.g. a free MongoDB Atlas cluster)

### Install

```bash
git clone https://github.com/Noobod/Meetify.git
cd Meetify

cd backend && npm install
cd ../frontend && npm install
```

### Environment variables

`backend/.env` (see `backend/.env.example`):

```
MONGO_URI=<your-mongodb-connection-string>
PORT=8000
CORS_WHITELIST=http://localhost:5173
```

`frontend/.env` (see `frontend/.env.example`):

```
VITE_API_URL=http://localhost:8000
VITE_SOCKET_URL=http://localhost:8000
```

`MONGO_URI` is required — the backend exits on startup if it's missing. `PORT` defaults to `8000` if unset. `CORS_WHITELIST` is a comma-separated list of allowed origins; without the frontend's origin in it, API and Socket.IO requests will be rejected.

### Run

```bash
# backend (from backend/)
npm run dev      # nodemon, auto-restarts on changes
# or
npm start        # node, no auto-restart

# frontend (from frontend/)
npm run dev      # Vite dev server
```

## Known Limitations

- **STUN only, no TURN server.** The only ICE server configured is Google's public STUN server (`stun:stun.l.google.com:19302`). STUN is enough to establish a direct peer connection when both sides can be reached via NAT hole-punching, but it does nothing when a participant is behind a restrictive/symmetric NAT or a firewall that blocks direct peer traffic — in that case there's no TURN relay to fall back to, and the call for that participant will fail to connect.
- **Mesh topology doesn't scale.** Every participant connects directly to every other participant, so bandwidth and CPU cost per client grow with the number of participants (N-1 connections and encoded streams each). This works fine for small calls but degrades quickly as the room grows.
- **No automated tests.** There is no test suite (unit, integration, or e2e) in either the backend or frontend.
- **No CI/CD pipeline.** There's no GitHub Actions (or other CI) configuration — no automated linting, testing, or deployment on push.
- **No Docker setup.** There's no Dockerfile or docker-compose config; running the app means installing Node dependencies and running it directly on the host.
- **In-memory signalling state.** Room membership and chat history live in memory in `socketManager.js` and are lost on server restart; the backend also doesn't horizontally scale past one instance without a shared adapter for Socket.IO state.
