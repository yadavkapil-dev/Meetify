# Meetify — Production-Style Code Audit

Audit date: 2026-07-13
Scope: `backend/` (Node/Express/MongoDB/Socket.IO) and `frontend/` (React/Vite/MUI/WebRTC)
Method: full manual read of every source file, `npm audit` on both packages, `eslint` run on frontend, git history check for leaked secrets. No code was modified.

---

## Scores (/10)

| Category | Score | Notes |
|---|---|---|
| **Overall project** | **5.0** | Working MVP with good bones, but the core multi-party call path has a hard-crashing bug and several unscoped security gaps. |
| Backend | 5.0 | Clean, minimal Express API; missing auth middleware, validation, rate limiting, and has an in-memory-state scaling ceiling. |
| Frontend | 4.5 | Auth/Home/History/Landing pages are solid. `VideoMeet.jsx` (the core feature) has critical bugs. |
| UI | 6.5 | MUI + responsive breakpoints are genuinely good. Loses points on accessibility (duplicate DOM ids, no aria-labels). |
| Code quality | 5.0 | 17 ESLint errors, dead functions, empty catch blocks, leftover CRA boilerplate test, heavy `console.log` usage. |
| Security | 3.5 | No auth middleware, token in URL query string + localStorage, wildcard CORS, no rate limiting, 6 high-severity npm CVEs. |
| Production readiness | 3.0 | Core "join call as second user" flow throws immediately (see Critical #1). In-memory socket state won't survive a restart or scale past one instance. |
| Resume readiness | 6.0 → 8.5 potential | Good breadth (WebRTC + Socket.IO + JWT-style auth + MongoDB) for a portfolio piece, but a live demo will likely hit Critical #1 on the first two-person call. Fixing the P0/P1 list below would make this genuinely interview-strong. |

---

## Critical issues at a glance

| # | Severity | Issue | File(s) |
|---|---|---|---|
| 1 | **Critical** | `user-joined` socket event signature mismatch — crashes peer connection setup for every join | [socketManager.js:29](backend/src/controllers/socketManager.js#L29), [VideoMeet.jsx:328-329](frontend/src/pages/VideoMeet.jsx#L328) |
| 2 | **Critical** | `useEffect` with no dependency array re-requests camera/mic on every render | [VideoMeet.jsx:63-66](frontend/src/pages/VideoMeet.jsx#L63) |
| 3 | **Critical** | `connections` peer-map is module-level `var`, not component state — leaks across meetings in the same tab | [VideoMeet.jsx:18](frontend/src/pages/VideoMeet.jsx#L18) |
| 4 | **Critical** | Deprecated/non-standard WebRTC API (`addStream`/`onaddstream`) — unreliable cross-browser | [VideoMeet.jsx](frontend/src/pages/VideoMeet.jsx) (throughout) |
| 5 | **High** | No authentication/authorization middleware — token is manually re-looked-up per handler, not verified via standard bearer/JWT flow | [user.controller.js](backend/src/controllers/user.controller.js), [users.routes.js](backend/src/routes/users.routes.js) |
| 6 | **High** | Session token sent as a URL query parameter | [AuthContext.jsx:45-50](frontend/src/contexts/AuthContext.jsx#L45), [user.controller.js:62-73](backend/src/controllers/user.controller.js#L62) |
| 7 | **High** | 6 high-severity npm vulnerabilities in `socket.io`/`ws` transitive deps (both packages) | `backend/package-lock.json`, `frontend/package-lock.json` |
| 8 | **High** | Wildcard CORS (`origin: "*"`) combined with `credentials: true` on Socket.IO | [socketManager.js:9-14](backend/src/controllers/socketManager.js#L9) |
| 9 | **High** | Unbounded in-memory `messages{}` store — never garbage collected, room key is derived from full URL | [socketManager.js:4,33-38,58](backend/src/controllers/socketManager.js#L4) |
| 10 | **Medium** | "Join as Guest" link is functionally broken — doesn't collect a meeting code and can never share a room with a code-based join | [landing.jsx:11-13](frontend/src/pages/landing.jsx#L11) |

---

## 1. Project architecture

Two independent apps (`backend/`, `frontend/`), deployed separately (per README, both on Render). Reasonable separation for a small project. No shared types/contracts between them (see Critical #1 — this is exactly the kind of bug a shared contract or integration test would have caught).

- **No environment separation** (dev/staging/prod config, feature flags) — acceptable at this size, not worth adding now.
- **No CI/CD, no tests wired to a pipeline** — worth adding before calling this "production," not urgent for a portfolio piece today.

**Verdict:** appropriate architecture for the project's scale; the issue is inside the apps, not the split between them.

## 2. Folder structure

Backend follows a conventional `controllers/models/routes` layout — fine for this size. Frontend is flat (`pages/contexts/utils/styles`) — also fine at this size. No `services/`, `middlewares/`, or `hooks/` folders exist yet because nothing currently needs them — don't add them speculatively.

**Not worth restructuring now.**

## 3. Backend design

- **No middleware layer at all** — no auth guard, no request logger, no centralized error handler, no 404 handler for unknown routes. `app.js` has zero `app.use((err, req, res, next) => ...)`. Any thrown error inside an async route handler that isn't caught (there's no `express-async-errors` or wrapper) would hang the request or crash the process depending on Express 5's behavior with unhandled rejections.
  - **Files:** [app.js](backend/src/app.js)
  - **Fix:** add a catch-all 404 handler and a final error-handling middleware.
  - **Worth fixing now:** Medium priority — low effort, meaningful robustness gain.

- **In-memory Socket.IO state (`connections`, `messages`, `timeOnline`)** — works for a single process but cannot scale horizontally (no Redis adapter), and all active calls/chat history are lost on every deploy/restart.
  - **Files:** [socketManager.js:3-5](backend/src/controllers/socketManager.js#L3)
  - **Fix:** acceptable for current scale; if scaling beyond one instance, move to `@socket.io/redis-adapter`.
  - **Worth fixing now:** Low — only matters if deploying >1 instance.

- **`crypto` listed as an npm dependency** (`"crypto": "^1.0.1"` in package.json) — this is a deprecated npm placeholder package; Node's built-in `crypto` module is used via `import crypto from "crypto"` regardless, so this dependency is dead weight and its presence is a known anti-pattern flagged by security scanners.
  - **Files:** [package.json:17](backend/package.json#L17)
  - **Fix:** remove `"crypto"` from `dependencies` — the built-in module already works without it.
  - **Worth fixing now:** Low effort, do it whenever touching package.json next.

## 4. Frontend design

- **`VideoMeet.jsx` is 620 lines and mixes signaling, media acquisition, UI, and chat in one component** with no custom hooks extracted (`useSocket`, `useLocalMedia`, `usePeerConnections`). This is the direct cause of Critical #2 and #3 — the logic is too entangled to reason about render lifecycles correctly.
  - **Fix:** not urgent to refactor wholesale, but the critical bugs below should be fixed at minimum.
  - **Worth fixing now:** Fix the bugs now; full refactor can wait.

- **`window.localStream` and module-level `connections`/`video`/`audio` mutable globals** instead of `useRef`/component state — see Critical #3.

## 5. API design

- **Inconsistent HTTP status code usage.** `register` correctly uses `http-status` constants; `login`/`getUserHistory`/`addToHistory` use raw numbers, and `login`/`register` failures often return `500` for what are really `400`/`401`/`409` conditions (e.g., a Mongoose `ValidationError` from a missing field surfaces as `500 Something went wrong ValidationError: ...`, leaking internal error text to the client).
  - **Files:** [user.controller.js:34,57,71,87](backend/src/controllers/user.controller.js#L34)
  - **Fix:** map validation errors to `400`, don't interpolate raw error objects into the client-facing message.
  - **Worth fixing now:** Medium — cheap fix, meaningfully better error UX and avoids leaking stack/driver details.

- **`GET /api/v1/users/get_all_activity` takes the auth token as a query parameter** instead of an `Authorization` header — see Critical #6 below (also a security issue, listed once).

- **No version­ing strategy beyond the `/v1` prefix** (no problem yet, just noting there's no deprecation policy — not worth addressing now).

- **No pagination on `getUserHistory`** — returns the user's entire meeting history unbounded. Not a problem at current scale.
  - **Worth fixing now:** No — revisit only if history lists grow large.

## 6. Authentication

- **[HIGH] No authentication middleware.** Every protected action (`getUserHistory`, `addToHistory`) manually does `User.findOne({ token })` inline in the controller instead of a shared `verifyToken` middleware. This isn't just style — it means there's no consistent enforcement point, no `401` for missing/malformed tokens (a missing token just fails to match any user and returns a generic `404 User not found`, which is a confusing/wrong status code for "not authenticated"), and it's easy to add a new protected route in the future and forget the check entirely.
  - **Files:** [user.controller.js:62-89](backend/src/controllers/user.controller.js#L62)
  - **Fix:** extract a small `authenticate` middleware that looks up the user from `req.headers.authorization` and attaches `req.user`, return `401` on failure.
  - **Worth fixing now:** **Yes — High priority**, this is the standard pattern and current code will keep this footgun for every future route.

- **[HIGH] Token transmitted via URL query string** for `GET /get_all_activity` (both client — [AuthContext.jsx:45-50](frontend/src/contexts/AuthContext.jsx#L45) — and server — [user.controller.js:62-73](backend/src/controllers/user.controller.js#L62)). Query strings land in server access logs, browser history, and `Referer` headers of any subsequent cross-origin request. Session tokens should never appear in a URL.
  - **Fix:** send the token as an `Authorization: Bearer <token>` header instead; switch this route to read from headers (pairs naturally with the middleware fix above).
  - **Worth fixing now:** **Yes** — small change, real exposure reduction.

- **Tokens never expire.** `crypto.randomBytes(20).toString("hex")` is stored on the user document with no TTL/`expiresAt` and no refresh mechanism. A stolen token is valid forever until the user logs in again (which overwrites it). There's also no logout endpoint — client-side "Logout" ([home.jsx:32](frontend/src/pages/home.jsx#L32)) only clears `localStorage`; the token remains valid server-side.
  - **Fix:** at minimum add an issued-at/expiry field checked in the auth middleware, or move to signed JWTs with an expiry claim (no server-side lookup needed at all). A real logout endpoint should invalidate the stored token.
  - **Worth fixing now:** Medium — not urgent for a portfolio demo, but flag if this ever handles real user data.

- **Token stored in `localStorage`**, not an httpOnly cookie — standard XSS trade-off for SPA/bearer-token designs. Given there's no cookie-based session elsewhere, this is a defensible choice, just note it's XSS-exposed (any injected script can read `localStorage`).
  - **Worth fixing now:** No — consistent with the rest of the design, not a new gap.

- **No rate limiting on `/login` or `/register`** — nothing prevents credential-stuffing or brute-force attempts against `login`.
  - **Files:** [users.routes.js](backend/src/routes/users.routes.js)
  - **Fix:** add `express-rate-limit` on the auth routes.
  - **Worth fixing now:** Medium — cheap (one middleware) and closes a real gap.

- **Passwords are correctly hashed with `bcrypt`** (cost factor 10) — this part is done right. ✅

## 7. Socket.IO implementation

- **[CRITICAL] `user-joined` event signature mismatch.** Server emits only `socket.id`:
  ```js
  io.to(connections[path][a]).emit("user-joined", socket.id);
  ```
  ([socketManager.js:29](backend/src/controllers/socketManager.js#L29)) but the client listens for two arguments and immediately calls `.forEach` on the second:
  ```js
  socketRef.current.on("user-joined", (id, clients) => {
    clients.forEach((socketListId) => { ... });
  ```
  ([VideoMeet.jsx:328-329](frontend/src/pages/VideoMeet.jsx#L328)). `clients` is `undefined` on every single emit, so this throws `TypeError: Cannot read properties of undefined (reading 'forEach')` the moment **any** user joins a call — including the very first join. This means peer connections are never actually established via this path; the multi-party call feature is broken today.
  - **Fix:** have the server emit the room's connection list as the second argument: `io.to(connections[path][a]).emit("user-joined", socket.id, connections[path]);`
  - **Worth fixing now:** **Yes — this is the single highest-priority fix in the whole repo.** It breaks the app's core feature.

- **[HIGH] `messages{}` map is never cleaned up**, unlike `connections{}` (which deletes empty rooms). Every distinct room key (which, per the frontend, is a full URL — see Critical/Medium #10 below) permanently accumulates chat history in server memory for the lifetime of the process, even after all participants leave. Over time this is unbounded memory growth.
  - **Files:** [socketManager.js:4,58](backend/src/controllers/socketManager.js#L4)
  - **Fix:** delete `messages[key]` alongside `connections[key]` when a room empties out (same `if (connections[key].length === 0)` block).
  - **Worth fixing now:** Yes, it's a two-line fix next to code already being touched for Critical #1.

- **`signal` event has no authorization check.** `socket.on("signal", (toID, message) => io.to(toID).emit("signal", socket.id, message))` forwards to any arbitrary `toID` without verifying the sender and target are in the same room. Socket IDs aren't easily guessable, so exploitability is low, but there's no server-side enforcement that WebRTC signaling stays scoped to a call.
  - **Files:** [socketManager.js:42-44](backend/src/controllers/socketManager.js#L42)
  - **Fix:** verify `toID` is in the same room as `socket.id` before relaying.
  - **Worth fixing now:** Low/Medium — real gap but low practical exploitability given random socket IDs.

- **CORS on the Socket.IO server is wildcard + credentials**, which is a contradictory/invalid combination per the CORS spec (`credentials: true` cannot legally pair with `origin: "*"` for credentialed browser requests) — see Security section for more detail.

## 8. WebRTC implementation

- **[CRITICAL] Uses deprecated, non-standard `RTCPeerConnection.addStream()` / `onaddstream`** throughout ([VideoMeet.jsx](frontend/src/pages/VideoMeet.jsx), e.g. lines 152, 188, 236, 330-345, 386-391, 400) instead of the modern `addTrack()`/`ontrack` API. `addStream`/`onaddstream` were removed from the WebRTC spec years ago; Chrome keeps a compatibility shim but behavior is inconsistent across browsers/versions, and this is the #1 thing a reviewer familiar with WebRTC will flag immediately.
  - **Fix:** migrate to `pc.addTrack(track, stream)` and `pc.ontrack = (event) => { ... event.streams[0] }`.
  - **Worth fixing now:** **Yes** — combined with Critical #1, this is why the app doesn't reliably support more than a lobby of one person today.

- **[CRITICAL] `connections` is a plain module-level `var`**, not `useRef`/component state:
  ```js
  var connections = {};
  ```
  ([VideoMeet.jsx:18](frontend/src/pages/VideoMeet.jsx#L18)). Because it lives outside the component, it is **not reset** when the component unmounts/remounts (e.g., leaving one meeting and joining another in the same tab, or React StrictMode's double-invoke in dev). Stale `RTCPeerConnection` objects from a previous call persist and interfere with the next one.
  - **Fix:** move into a `useRef({})` inside the component, reset on mount/unmount.
  - **Worth fixing now:** Yes, same pass as the addStream migration.

- **No cleanup on unmount.** There is no `useEffect` cleanup that closes the socket connection or `RTCPeerConnection`s when the user navigates away other than the explicit "End Call" button ([VideoMeet.jsx:457-463](frontend/src/pages/VideoMeet.jsx#L457)). Browser back button, direct link navigation, or a crash leaves sockets/peer connections open and camera/mic active until the tab is closed.
  - **Fix:** add a `useEffect` return/cleanup function that tears down `socketRef.current` and all `connections[*]` on unmount.
  - **Worth fixing now:** Medium-High — affects real users (camera stays on unexpectedly), moderate effort.

- **[MEDIUM] Room key is `window.location.href`** (full URL including protocol, host, and query string) rather than just the meeting code:
  ```js
  socketRef.current.emit("join-call", window.location.href);
  ```
  ([VideoMeet.jsx:319](frontend/src/pages/VideoMeet.jsx#L319)). This directly causes the "Join as Guest" link (`/videomeet?guest=true`) to be structurally incapable of ever landing in the same room as a code-based join (`/abc123`) — they produce different URLs, hence different room keys. The guest-join feature as wired today cannot connect a guest to an existing meeting.
  - **Files:** [VideoMeet.jsx:319](frontend/src/pages/VideoMeet.jsx#L319), [landing.jsx:11-13](frontend/src/pages/landing.jsx#L11), [App.jsx:20-21](frontend/src/App.jsx#L20)
  - **Fix:** derive the room key from `useParams()` (the `:url` route param / meeting code) instead of the full href.
  - **Worth fixing now:** Yes — directly tied to Critical #1/#4 fixes and is a visible, demo-breaking gap.

- **Only STUN configured, no TURN server** (`stun:stun.l.google.com:19302` only — [VideoMeet.jsx:20-22](frontend/src/pages/VideoMeet.jsx#L20)). Calls between peers on restrictive/symmetric NATs (common on corporate or mobile carrier networks) will fail to connect with no TURN fallback.
  - **Fix:** add a TURN server (e.g., a free-tier Twilio/Xirsys TURN, or self-hosted coturn) to `iceServers`.
  - **Worth fixing now:** Medium — not needed for a same-network demo, but real-world call reliability depends on it.

- **`JSON.parse(message)` in `gotMessageFromServer` has no try/catch** — a malformed signal payload would throw uncaught.
  - **Files:** [VideoMeet.jsx:275](frontend/src/pages/VideoMeet.jsx#L275)
  - **Worth fixing now:** Low.

## 9. MongoDB models

- **`Meeting.user_id` and `Meeting.meetingCode` are plain `String`s**, not `ObjectId` refs / indexed fields. `user_id` stores the username directly rather than referencing `User._id`, which works but forgoes Mongoose population and means a username change (not currently supported, but if added later) would orphan history records silently.
  - **Files:** [meeting.model.js](backend/src/models/meeting.model.js)
  - **Worth fixing now:** No — fine at current scale; note for later if usernames become editable.

- **No indexes beyond the implicit `username: unique`** on `User`. `Meeting.find({ user_id: ... })` does a collection scan without an index on `user_id`. Not a problem at current data volumes.
  - **Worth fixing now:** Low priority — add `index: true` on `Meeting.user_id` if history grows large.

- **No schema-level validation beyond `required`/`unique`** — no username format/length constraints, no password length constraint at the schema level (relies entirely on missing client-side validation — see Validation section).
  - **Worth fixing now:** Medium, paired with the validation fixes below.

## 10. React components

- **`authentication.jsx` calls `navigate("/home")` unconditionally after `handleRegister`**, even though `handleRegister` (in `AuthContext.jsx`) only actually logs the user in and sets a token *inside* its own conditional (`if (loginRes.status === httpStatus.OK)`). If that inner login step doesn't succeed, the user is still redirected to `/home` with no token, and `withAuth` immediately bounces them back to `/auth` — a confusing double-redirect.
  - **Files:** [authentication.jsx:37-48](frontend/src/pages/authentication.jsx#L37), [AuthContext.jsx:22-33](frontend/src/contexts/AuthContext.jsx#L22)
  - **Fix:** have `handleRegister` return a success boolean and only navigate on true, or navigate from inside `AuthContext` and remove the duplicate call from `authentication.jsx`.
  - **Worth fixing now:** Low-Medium — minor UX rough edge, cheap fix.

- **Duplicate DOM `id="outlined-basic"`** used across multiple `TextField`s on the same page — in `authentication.jsx` (username + password fields both use it), `home.jsx`, and `VideoMeet.jsx`. Duplicate IDs are invalid HTML and break label/input association for assistive technology.
  - **Files:** [authentication.jsx:118,126](frontend/src/pages/authentication.jsx#L118), [home.jsx:46](frontend/src/pages/home.jsx#L46), [VideoMeet.jsx:505,546](frontend/src/pages/VideoMeet.jsx#L505)
  - **Fix:** remove the hardcoded `id` (MUI auto-generates one) or make each unique.
  - **Worth fixing now:** Yes — trivial fix, real accessibility/HTML-validity issue.

- **Dead/unused handlers confirmed by ESLint**: `openChat`, `closeChat`, and `handleMessage` are defined but never referenced — the actual chat-toggle button calls `setModal(!showModal)` inline instead of `openChat`/`closeChat`. Practical consequence: `openChat` was clearly meant to reset the unread-message badge (`setNewMessages(0)`) when opening the chat panel, but since it's dead code, **the unread badge never resets when the user opens the chat.**
  - **Files:** [VideoMeet.jsx:465-474,584-589](frontend/src/pages/VideoMeet.jsx#L465)
  - **Fix:** wire the chat-toggle `IconButton`'s `onClick` to call `openChat`/`closeChat` (or inline the badge reset), delete whichever path is unused.
  - **Worth fixing now:** Yes — small, fixes a real visible bug (stuck unread badge) and clears 3 ESLint errors.

## 11. State management

No global state library is used beyond React Context (`AuthContext`) plus local component state — appropriate for this app's size, not worth introducing Redux/Zustand now.

- **`AuthContext`'s `userData.username` is never populated from a real source of truth** — it's set client-side from whatever the user typed into the login form ([AuthContext.jsx:40](frontend/src/contexts/AuthContext.jsx#L40)) rather than from the server response, and is `null` on page refresh (only `token` is rehydrated from `localStorage`, not `username`). Nothing currently reads `userData.username`, so this is latent rather than an active bug, but it's a correctness gap if a component starts relying on it (e.g., to show "Welcome, X" on `/home`).
  - **Files:** [AuthContext.jsx:14-17,36-43](frontend/src/contexts/AuthContext.jsx#L14)
  - **Worth fixing now:** Low — not currently causing a visible bug.

## 12. Routing

- Route table in `App.jsx` is small and clear. `/:url` catch-all correctly ranks below static routes in React Router v7's matching algorithm, so `/auth`, `/home`, etc. are not shadowed — verified, not a bug.
- **No route-level guard for `/videomeet`/`/:url`** — anyone with a link can join any meeting with no host approval, waiting room, or per-meeting access control. This may be an intentional "anyone with the link can join" design (common for lightweight meeting tools), but is worth calling out explicitly as a product/security decision rather than an oversight.
  - **Worth fixing now:** No — flag as a product decision to confirm with stakeholders, not a bug to silently fix.

## 13. Error handling

- **Generic catch-all error responses everywhere** (`res.status(500).json({ message: `Something went wrong ${e}` })`) interpolate the raw error object into the response body, which can leak internal details (stack traces, driver-specific messages, field names) to the client.
  - **Files:** [user.controller.js:34,57,71,87](backend/src/controllers/user.controller.js#L34)
  - **Fix:** log the full error server-side (`console.error`), return a generic message to the client, and map known error types (validation, duplicate key) to appropriate 4xx codes.
  - **Worth fixing now:** Medium — cheap, real hardening.

- **No global Express error-handling middleware** — see Backend design section.
- **Frontend has near-universal `.catch((e) => console.log(e))`** throughout `VideoMeet.jsx` with no user-facing feedback when WebRTC operations fail (e.g., `getUserMedia` denial just logs to console — user sees a blank video tile with no explanation).
  - **Files:** [VideoMeet.jsx](frontend/src/pages/VideoMeet.jsx) (throughout)
  - **Fix:** surface a toast/snackbar when camera/mic permission is denied or a peer connection fails.
  - **Worth fixing now:** Medium — meaningfully better UX, moderate effort given how many callsites there are.

## 14. Validation

- **No server-side input validation** on `register`/`login` beyond Mongoose's `required: true`. No username format constraints (length, allowed characters), no password minimum length/complexity, no trimming of whitespace.
  - **Files:** [user.controller.js:9-59](backend/src/controllers/user.controller.js#L9), [users.model.js](backend/src/models/users.model.js)
  - **Fix:** add a small validation layer (e.g., `zod`/`joi`, or manual checks) before hitting the DB.
  - **Worth fixing now:** Medium — currently anyone can register with a 1-character password.

- **Client-side form has `noValidate` set on the `<Box component="form">`** ([authentication.jsx:101](frontend/src/pages/authentication.jsx#L101)), which disables the browser's native HTML5 validation for the `required` `TextField`s — meaning the "required" markers are purely cosmetic and empty submissions are not blocked client-side either.
  - **Fix:** either remove `noValidate` (if you want native validation) or add explicit JS validation before calling `handleAuth`.
  - **Worth fixing now:** Medium — currently the only validation gate is "does the server 400 on empty body," which it also doesn't cleanly do (see above).

## 15. Security issues

Consolidating findings referenced above, plus a few additional ones:

- **CORS wildcard.** `app.use(cors())` with no options ([app.js:22](backend/src/app.js#L22)) allows any origin. Socket.IO similarly uses `origin: "*"` combined with `credentials: true` ([socketManager.js:9-14](backend/src/controllers/socketManager.js#L9)), which is a spec-contradictory combination (browsers won't send credentials to a wildcard origin) — indicates copy-pasted boilerplate rather than an intentional config.
  - **Fix:** set `origin` to the actual frontend URL(s) via an env var, drop `credentials: true` if cookies aren't used (they aren't — this app uses bearer-style tokens).
  - **Worth fixing now:** Yes — trivial fix, closes a real (if currently low-impact, since no cookies are involved) misconfiguration.

- **No `helmet` or other security-headers middleware** on the Express app — missing `X-Content-Type-Options`, `X-Frame-Options`/CSP, etc.
  - **Fix:** `app.use(helmet())`.
  - **Worth fixing now:** Yes — one line, meaningful baseline hardening.

- **No rate limiting anywhere** (login, register, or general API) — brute-force and basic abuse are unmitigated.
  - **Worth fixing now:** Medium-High, see Authentication section.

- **6 high-severity + 5 moderate npm vulnerabilities** confirmed via `npm audit` in both `backend/` and `frontend/`, all in the `socket.io` → `engine.io`/`socket.io-adapter` → `ws` dependency chain (uninitialized memory disclosure, memory-exhaustion DoS in `ws`; unbounded binary attachments in `socket.io-parser`) plus a `qs` DoS. All have fixes available via `npm audit fix` (verify it doesn't bump `socket.io` to a major version that breaks the client/server version match before applying).
  - **Files:** `backend/package-lock.json`, `frontend/package-lock.json`
  - **Worth fixing now:** Yes — run `npm audit fix` in both projects and re-test signaling/chat afterward.

- **`backend/.env` contains a live MongoDB Atlas connection string with an embedded username/password**, sitting in plaintext on disk. It is correctly excluded via `backend/.gitignore` and confirmed **not** present anywhere in git history — good practice was followed here. However: **this credential is live and was included in this audit session's context (I read the file to check for the exact leak scenario below).** Recommend rotating the Atlas password as routine hygiene any time a `.env` has been read/shared outside your own terminal, regardless of this session specifically.
  - **Files:** `backend/.env` (untracked, correctly gitignored)
  - **Fix:** rotate the MongoDB Atlas password/user credentials as a precaution; continue keeping `.env` out of git (already done correctly).
  - **Worth fixing now:** Recommend doing this regardless of urgency — cheap and standard practice.

- **No HTTPS enforcement in the app itself** (relies entirely on the hosting platform — Render — terminating TLS). Not a code defect, just noting there's no `express-force-https`/HSTS header if ever self-hosted behind plain HTTP.
  - **Worth fixing now:** No — fine as long as deployed on Render/behind a TLS-terminating proxy.

## 16. Performance problems

- **[CRITICAL] `useEffect(() => { getPermissions(); })` with no dependency array** ([VideoMeet.jsx:63-66](frontend/src/pages/VideoMeet.jsx#L63)) re-runs after **every** render of `VideoMeetComponent` — including renders triggered by incoming chat messages (`setMessages`) and remote peers joining (`setVideos`), both of which happen frequently during an active call. Each run calls `getUserMedia()` again, which stops and replaces `window.localStream` with a *new* `MediaStream`, forcing the browser to re-acquire camera/mic and briefly flicker the camera indicator — and does this on every chat message received during a live call.
  - **Fix:** add an empty dependency array `[]` so this runs once on mount.
  - **Worth fixing now:** **Yes — Critical.** This is a correctness bug with real user-visible symptoms (flickering camera/mic), not just a performance nit. ESLint already flags related hooks (`react-hooks/exhaustive-deps`) at [VideoMeet.jsx:132](frontend/src/pages/VideoMeet.jsx#L132) and [452](frontend/src/pages/VideoMeet.jsx#L452).

- **165KB `mobile.png`** served unoptimized on the landing page ([public/mobile.png](frontend/public/mobile.png), referenced at [landing.jsx:35](frontend/src/pages/landing.jsx#L35)) — not compressed/resized for its rendered size. Minor.
  - **Worth fixing now:** Low — run it through an image compressor if optimizing load time matters.

- **`background.png` is actually a JPEG file** (confirmed via file signature) despite the `.png` extension — browsers handle this fine via content sniffing, but it's a naming footgun and prevents PNG-specific optimizations.
  - **Files:** [frontend/public/background.png](frontend/public/background.png)
  - **Worth fixing now:** Low.

## 17. Accessibility

- **No `aria-label`s on icon-only buttons** (mute/unmute, camera toggle, end call, screen share, chat toggle in `VideoMeet.jsx`) — a screen reader announces these only as "button" with no indication of function.
  - **Files:** [VideoMeet.jsx:561-590](frontend/src/pages/VideoMeet.jsx#L561)
  - **Fix:** add `aria-label="Toggle microphone"` etc. to each `IconButton`.
  - **Worth fixing now:** Medium — cheap, meaningful for anyone actually relying on a screen reader.

- **Duplicate `id="outlined-basic"`** across form fields — see React components section; also an accessibility defect (breaks implicit label association for AT).

- **`Badge color="orange"`** ([VideoMeet.jsx:583](frontend/src/pages/VideoMeet.jsx#L583)) is not a valid MUI `Badge` color token (valid values are `default`/`primary`/`secondary`/`error`/`info`/`success`/`warning`) — MUI will silently ignore it and fall back to default styling, which may result in low-contrast badge text depending on theme.
  - **Worth fixing now:** Low — cosmetic, verify visually and swap to `"warning"` or a `sx` override if a specific orange is wanted.

## 18. Responsive UI

This is a genuine strength of the codebase. `video.module.css` and `home.module.css` both have deliberate, well-considered breakpoints at 1024px (tablet) and 600px (mobile) with sensible layout changes (column-reverse stacking, chat panel becoming a fixed bottom sheet on mobile, flex-direction changes). No issues found here worth flagging.

## 19. Code duplication

- **Near-identical black/silence-stream fallback + `onended` handler logic duplicated** between `getUserMediaSuccess` and `getDislayMediaSuccess` ([VideoMeet.jsx:169-204](frontend/src/pages/VideoMeet.jsx#L169) and [252-271](frontend/src/pages/VideoMeet.jsx#L252)), and the offer-creation loop (`for (let id in connections) { ... createOffer ... }`) is repeated three times (lines ~149-167, ~187-202, ~233-250, ~396-415).
  - **Fix:** extract a shared `renegotiateAllPeers()` helper and a shared `black`/`silence` fallback-stream factory.
  - **Worth fixing now:** Low priority on its own, but worth doing *while* fixing Critical #1/#4 since that code will already be touched.

## 20. Dead code

- **`frontend/App.test.js`** is unmodified Create React App boilerplate (`getByText(/learn react/i)`) that doesn't match this app at all, and **the test tooling to even run it isn't installed** — no `@testing-library/react`, no `jest`/`vitest`, and no `test` script in `package.json`. This file cannot execute; it's pure leftover cruft.
  - **Files:** [App.test.js](frontend/App.test.js)
  - **Fix:** delete it, or (better) set up Vitest + Testing Library and write real tests for `AuthContext`/`withAuth` at minimum.
  - **Worth fixing now:** Yes — trivial to delete; a real test suite is a separate, larger effort worth scoping later.

- **`openChat`/`closeChat`/`handleMessage` unused functions** — see React components section (also a real bug, not just dead code).
- **Commented-out TODO block** at [VideoMeet.jsx:58-61](frontend/src/pages/VideoMeet.jsx#L58) (`// TODO / if(isChrome() === false) {}`) — harmless, low priority to clean up.
- **`reportWebVitals.jsx`** is wired up ([main.jsx:5,17](frontend/src/main.jsx#L5)) but its callback is never provided (`reportWebVitals()` with no argument), so it measures nothing — effectively dead instrumentation.
  - **Worth fixing now:** Low — either wire it to real analytics or remove it.

## 21. ESLint issues

Ran `npx eslint .` in `frontend/` — **17 errors, 3 warnings**, none fixed as part of this audit:

```
App.test.js            2 errors  — 'test'/'expect' undefined (no test runner configured)
AuthContext.jsx         1 error  — Fast Refresh: context should be in its own file
VideoMeet.jsx           11 errors, 2 warnings — unused vars, empty catch blocks,
                                                  missing hook deps, dead functions
home.jsx                2 errors — Fast Refresh: HOC export pattern
withAuth.jsx             1 error, 1 warning — unused param, missing hook dep
```

Full detail already broken out in the relevant sections above (Critical #2, React components, Dead code). The `react-hooks/exhaustive-deps` warnings at [VideoMeet.jsx:132](frontend/src/pages/VideoMeet.jsx#L132) and [452](frontend/src/pages/VideoMeet.jsx#L452), and [withAuth.jsx:12](frontend/src/utils/withAuth.jsx#L12), are worth a look but are lower priority than the no-array effect at line 63 (Critical #2).

**No ESLint config exists for the backend** — not required, but worth adding (`eslint` + Node config) for consistency.
- **Worth fixing now:** Fixing the errors tied to real bugs (VideoMeet.jsx) — yes. The Fast-Refresh warnings and backend ESLint setup — low priority, cosmetic/DX only.

## 22. Maintainability

- `VideoMeet.jsx`'s size and mixed concerns (see Frontend design) is the single biggest maintainability risk — any future change to signaling logic requires understanding the entire file.
- Naming is generally clear and consistent (`handleX`, `getX`) across the frontend.
- No JSDoc/comments explaining *why* on any of the non-obvious WebRTC negotiation logic (e.g., why `onended` swaps in a black/silent stream instead of just removing the track) — a future maintainer unfamiliar with WebRTC would have to reverse-engineer intent.
  - **Worth fixing now:** Low — nice-to-have, not blocking.

## 23. Scalability

- **In-memory Socket.IO state** (see Backend design) is the ceiling here — fine for a single-instance deployment (matches the current Render single-service setup), but cannot scale horizontally without a Redis adapter and would lose all active session/chat state on every restart or deploy.
- **Unbounded `messages{}` growth** (Critical/High #9) is a scalability/stability risk even at single-instance scale — long-running processes will accumulate memory indefinitely.
- **No connection/room limits** — nothing caps how many participants can join a single room, which for a mesh WebRTC topology (every peer connects to every other peer, as implemented here) degrades quickly past ~4-6 participants. This is inherent to the mesh design, not a code bug — worth knowing as a design constraint rather than "fixing."
  - **Worth fixing now:** Not urgent; if group-call scale beyond a handful of people is a goal, this would require an SFU (e.g., mediasoup/LiveKit) — a significant redesign, only worth scoping if that's an actual product requirement.

## 24. Industry best practices

- ✅ Passwords hashed with bcrypt.
- ✅ `.env` correctly gitignored and never committed.
- ✅ Sensible request body size limits (`express.json({ limit: "40kb" })`).
- ❌ No centralized error handling middleware.
- ❌ No structured logging (uses raw `console.log`/`console.error` throughout both apps — acceptable for a portfolio project, but not production practice).
- ❌ No environment variable validation at startup (app will attempt `mongoose.connect(undefined)` and fail via the generic catch block if `MONGO_URI` is missing, rather than failing fast with a clear message).
  - **Files:** [app.js:30-41](backend/src/app.js#L30)
  - **Worth fixing now:** Low — nice-to-have fail-fast check.
- ❌ No automated tests anywhere in the repo that actually run (see Dead code section).
- ❌ No CI pipeline (no `.github/workflows`).

---

## Suggested fix order (if/when you want to proceed)

This is not a plan to implement — just a priority ordering for your review, since several findings above compound (e.g., the WebRTC fixes cluster together):

1. **P0 — core feature is broken:** `user-joined` signature mismatch (#1), `useEffect` missing deps (#2), module-level `connections` (#3), deprecated `addStream`/`onaddstream` (#4), room-key-from-full-URL (#10). These all live in `VideoMeet.jsx` + `socketManager.js` and should likely be fixed together.
2. **P1 — security baseline:** auth middleware + bearer-header token (#5, #6), CORS config (#8), `helmet`, rate limiting, `npm audit fix` (#7).
3. **P2 — polish:** error handling/status codes, input validation, dead code cleanup, accessibility labels, ESLint cleanup.

---

*This audit intentionally makes no code changes. Awaiting your review before implementing any of the above.*
