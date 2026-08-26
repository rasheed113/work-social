# Work Social

## Phase 1 — Official Root Baseline

A real social media web platform built around a **$0 / no-credit-card target** for the initial production proof.

The first production proof is intentionally limited to **two real users on two different devices**. The goal is to prove real cloud persistence, cross-device synchronization, authentication, social relationships, posts, and private realtime text chat.

> **Status:** LOCKED — Phase 1 architecture and scope baseline
>
> This README is the working root contract for Phase 1. Development decisions must be checked against it.

---

## 1. Phase 1 Mission

Make the project publicly usable as a real social web application using the $0/no-credit-card target for the initial production proof.

Success means two real users on two real devices can use real cloud data for:

- Authentication
- Profiles
- Friend relationships
- Blocking
- Posts
- Likes
- Comments
- Private realtime text chat
- Notifications
- Settings
- Controlled media uploads

A green build or a rendered page alone is **not** success.

---

## 2. Non-Negotiable Rules

1. **No fake implementation.** Production UI must use real backend data.
2. **No hardcoded API URLs** or placeholder endpoints.
3. A feature is not complete merely because its page renders.
4. No paid service is introduced into Phase 1 without explicit re-evaluation.
5. Provider limits, payment requirements, and important behaviors must be verified from official documentation or controlled testing.
6. Reuse existing sound code where appropriate, but do not carry broken architecture forward just because it already exists.
7. Audio/video calls are **Coming Soon** and must not block Phase 1.
8. Cloud data is authoritative. Local cache is optional and never the source of truth.
9. Do not silently switch to a paid provider when a free quota is reached.
10. Do not declare a gate passed without real-data testing.

---

## 3. Locked Phase 1 Architecture

| Layer | Technology | Phase 1 status |
|---|---|---|
| Source control | GitHub | Required |
| Frontend hosting | Cloudflare Pages | Required |
| Authentication | Supabase Auth | Required |
| Primary database | Supabase PostgreSQL | Required |
| Realtime text chat | Supabase Realtime | Required |
| Initial media storage | Supabase Storage | Required, controlled quota |
| Render / FastAPI production server | None | **Not required** |
| Cloudflare R2 | — | **Hold / optional future Phase 2** |

### Root data flow

```text
GitHub
   ↓
Cloudflare Pages
   ↓
Work Social frontend
   ↓
Supabase Auth / PostgreSQL / Realtime / Storage
```

The browser must never receive private service-role credentials. Public client configuration may be exposed where appropriate; privileged secrets remain server-side.

---

## 4. Phase 1 Feature Contract

### Authentication

- Signup
- Login
- Logout
- Session persistence
- Password recovery/verification where configured

### Profile

- Real authenticated profile data
- Persistent profile state
- No fake fallback such as `No profile assembled` when authoritative data exists

### Friends

- Add Friend
- Accept
- Reject
- Cancel request where implemented
- Unfriend

### Blocking

- Block
- Unblock
- Authorization enforced by the database/application, not only by hiding UI controls

### Posts

- Create post
- Read/feed
- Delete own post
- Persistent cloud state

### Likes

- Like
- Unlike
- Duplicate prevention
- Persistent state/counts

### Comments

- Create
- Read
- Delete own comment
- Real post and author relationships

### Private chat

- Private conversations
- Conversation membership
- Private text messages
- Realtime delivery between authorized users

### Notifications

Basic notifications for:

- Friend actions
- Likes
- Comments
- Messages

### Settings

Real account, privacy, and notification settings must be stored in the database.

### Media

Controlled image/small-media uploads subject to Phase 1 quotas.

---

## 5. Explicitly Out of Phase 1

The following must not become Phase 1 blockers:

- Audio calls
- Video calls
- Unlimited media/video storage
- Large-scale CDN/media infrastructure
- Guaranteed support for thousands of users
- AI recommendation systems
- Paid analytics/monitoring
- Dedicated always-on Python/FastAPI hosting
- Render deployment
- Cloudflare R2 as a required component

These can be considered in later phases when real usage justifies them.

---

## 6. Database Root Model

The target data model contains:

- `profiles`
- `user_settings`
- `friend_requests`
- `friends` (or an equivalent normalized relationship model)
- `blocks`
- `posts`
- `post_media`
- `comments`
- `likes`
- `conversations`
- `conversation_members`
- `messages`
- `notifications`

The schema must be designed together with relationships, constraints, indexes, RLS policies, and application assumptions.

Do not blindly paste or replace a database schema without checking the complete application contract.

---

## 7. Security Root Rules

- Supabase Row Level Security (RLS) is required for protected data.
- Users may modify only resources they are authorized to modify.
- Private conversation data must be readable only by conversation members.
- Blocking must be enforced by backend/database authorization.
- Service-role keys and privileged secrets must never be shipped to the browser.
- Client-side validation is for UX; it does not replace database authorization.

---

## 8. Storage Governor

Phase 1 does **not** attempt unlimited storage.

Uploads must be controlled by:

- File-size limits
- Platform quotas
- User/application quotas where required

If a limit is reached:

1. Reject the upload clearly.
2. Tell the user why it was rejected.
3. Do not silently upgrade.
4. Do not silently switch providers.
5. Do not assume future billing.

Example:

> Storage limit reached. Delete older media before uploading more.

---

## 9. Deployment Root

- GitHub is the source-of-truth repository.
- Cloudflare Pages is the Phase 1 public frontend host.
- The initial production URL uses the free Pages domain.
- A custom domain is not required for Phase 1.
- Production deployments must come from the repository.
- No undocumented manual production copy is allowed.
- There must be no hidden Render/API dependency in the production frontend.
- Placeholder API hostnames are forbidden.

---

## 10. Verification Protocol — Two Users / Two Devices

Phase 1 is verified using two real accounts and two real devices.

1. Create Account A on Device 1.
2. Create Account B on Device 2.
3. Test login, logout, reload, and session persistence.
4. Verify both profiles contain real persistent data.
5. A sends a friend request to B.
6. B accepts and both devices see the friendship.
7. Test unfriend and re-add as applicable.
8. Test block/unblock and confirm unauthorized interaction is actually prevented.
9. A creates a post.
10. B sees the same post from cloud data.
11. B likes and comments; A sees the result.
12. A sends a private text message.
13. B receives it through realtime.
14. B replies; A receives it through realtime.
15. Reload/close/reopen both devices and verify persistence.
16. Test media upload within the controlled Phase 1 quota.
17. Verify no production code points to Render or a placeholder API hostname.

---

## 11. Phase 1 PASS Criteria

Phase 1 passes only when all of the following are true:

- Public URL works.
- Two real accounts can authenticate.
- Data survives reload and re-login.
- Device A and Device B observe the same authoritative cloud state.
- Friend/block/unfriend flows work correctly.
- Posts, comments, and likes are real and persistent.
- Private realtime text chat works.
- Protected data is enforced by RLS/authorization.
- No Render dependency remains in the production frontend.
- The demonstration works without requiring a paid hosting service.

---

## 12. STOP / GO Rules

### GO

A gate is documented, implemented, and tested with real data.

### STOP

Stop and resolve the current gate if:

- A provider requires payment/card contrary to the current constraint.
- A feature depends on a missing backend service.
- A UI works only with mocked/hardcoded data.
- Security depends only on frontend hiding.
- A provider limit has not been verified and the decision depends on that limit.

### RECOVER

When development becomes confusing:

1. Return to the locked architecture in this README.
2. Identify the failing Phase 1 gate.
3. Inspect only that gate and its dependencies.
4. Fix the smallest real root cause.
5. Run the corresponding real-data test.
6. Only then continue to the next gate.

Do not invent a new architecture in the middle of Phase 1.

---

## 13. Provider Status Baseline

The Phase 1 provider baseline is:

**GitHub + Cloudflare Pages + Supabase**

Supabase is the backend foundation.

Cloudflare Pages is the frontend deployment target.

Cloudflare R2 is not a Phase 1 dependency.

Free-tier limits and provider policies can change. Whenever a deployment decision depends on a quota, pricing rule, storage limit, or payment requirement, verify the current official provider documentation before treating it as confirmed.

---

## 14. Build Strategy

This repository is a clean implementation of the locked Phase 1 contract.

We should build in small verified gates rather than creating the entire application and debugging everything at the end.

Recommended order:

```text
1. Repository foundation
        ↓
2. Supabase project/configuration
        ↓
3. Database schema + RLS
        ↓
4. Authentication
        ↓
5. Profile
        ↓
6. Friends + blocking
        ↓
7. Posts
        ↓
8. Likes + comments
        ↓
9. Private realtime chat
        ↓
10. Notifications
        ↓
11. Settings
        ↓
12. Controlled media
        ↓
13. Cloudflare Pages deployment
        ↓
14. Two-user / two-device verification
        ↓
15. Phase 1 PASS
```

Each gate must use real data before the next dependent gate is expanded.

---

## 15. Project Quality Rules

- Prefer simple, maintainable architecture over unnecessary complexity.
- Keep frontend and backend responsibilities clear.
- Do not add an API server merely because one was used in an older implementation.
- Do not add dependencies without a real reason.
- Keep configuration in environment variables.
- Never commit secrets.
- Keep database authorization close to the data using RLS where appropriate.
- Remove dead runtime paths once their replacement is verified.
- Do not preserve broken integrations merely for compatibility.
- Every production feature must have a real verification path.

---

## 16. Phase Roadmap

### Phase 1 — Core Social Proof

Authentication, profiles, friends, block/unblock, posts, comments, likes, private realtime text chat, notifications, settings, and controlled media.

### Phase 2 — Scale / Experience

Larger media strategy, stronger caching/PWA, storage expansion, moderation, performance improvements, and support for more users.

### Phase 3 — Communication Expansion

Audio/video calls and additional realtime communication capabilities.

Paid infrastructure is considered only when real usage proves that the free architecture is no longer sufficient.

---

## 17. Root Recovery Rule

If we get lost, do not start rewriting randomly.

```text
STOP
 ↓
Read this README
 ↓
Identify the failing Phase 1 gate
 ↓
Inspect the real code + Supabase state for that gate
 ↓
Fix the smallest root cause
 ↓
Test with real data
 ↓
Continue
```

The purpose of this repository is not to create a demo that merely looks complete. The purpose is to prove that the social platform actually works online with real users and real cloud state.

---

## 18. Final Root Statement

> **Work Social Phase 1 is successful only when the social platform works for two real users on two real devices with real cloud data, real authentication, real social relationships, persistent posts, and realtime private text chat under the $0/no-card target. We do not declare success from a static page, mocked data, or a green build alone.**

---

**Phase 1 Root Baseline: LOCKED**  
**Repository: `work-social`**  
**Primary deployment target: Cloudflare Pages**  
**Primary backend: Supabase**  
**Source of truth: this repository + its verified implementation**
