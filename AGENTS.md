# Work Social — Autonomous Codex Audit Protocol

## Mission
Operate as a browser-first QA + engineering agent for `rasheed113/work-social`. Inspect the rendered application, trace findings to the real source, implement fixes, and verify them in the browser. Do not rely on code inspection alone for visual claims.

## Repository authority
- Repository: `rasheed113/work-social`
- Work only on the currently checked-out/user-authorized branch.
- Never switch branches, reset, force-push, stash, pull, or rewrite unrelated history unless explicitly requested.
- Do not touch similarly named repositories.
- Before changes, report branch, HEAD, working tree state, and intended scope.
- Keep changes focused and end-to-end; avoid tiny unrelated refactors.

## Browser-first audit
When browser tooling is available:
1. Start/open the app using the repository's documented dev command or the supplied live URL.
2. Use an authenticated browser session when the target page requires authentication; never ask for or expose passwords in chat.
3. Audit both mobile and desktop viewports.
4. Navigate real application flows rather than inventing routes.
5. Capture screenshots and inspect the rendered DOM/styles where useful.
6. After each fix, revisit the same screen and verify the rendered result.
7. Record console/runtime errors, broken navigation, overflow, overlap, loading/transition issues, and visual regressions.

If browser tooling or an authenticated live session is unavailable, do NOT claim visual verification. Fall back to source/static analysis and clearly mark browser verification as BLOCKED.

## Work Social visual acceptance criteria
Source of truth: `docs/WORK_SOCIAL_MASTER_FUTURISTIC_THEME.md` and the Master Visual Audit context.

Target language:
- Contractor Overview × Premium Financial Terminal × Futuristic Social OS
- Galaxy/deep-space background must remain visible through transparent/glass UI.
- Replace large legacy white/opaque surfaces with dark translucent glass.
- Use subtle cyan/purple borders/glow, readable light typography, and gradient primary actions.
- Avoid card-on-card opaque white surfaces.

Critical audit areas:
- Worker History
- Worker Settings
- Dashboard Customize Cards modal
- Contractor Account Setup
- Contractor Team Finance
- Finance modals
- Account/Work Mode selector
- Mobile keyboard/safe-area behavior
- Loading/transition states
- Contractor Personal Finance
- Contractor Team Finance / Team Dashboard separation

Protected pages:
- Worker Overview
- Contractor Overview
Do not redesign protected pages. Regression-test them after shared CSS changes.

## Domain boundaries
Keep Worker and Contractor domains clearly separated.
- Personal Contractor pages must not masquerade as Team pages.
- Team navigation must lead to real Team destinations.
- Personal Finance must remain personal.
- Team Finance must remain team-scoped.
- Do not invent routes, fake data, or substitute business logic to make a screen appear to work.

## Never change for visual audit work
- Supabase schema/RLS/auth
- AI logic
- business calculations
- team membership semantics
- notification semantics
- fake/mock data
- unrelated refactors

## Verification
Before reporting completion, run when supported by the repo:
- `git diff --check`
- project tests
- `npm run build`
- browser verification of changed pages
- regression verification of protected pages

If a build/test/browser check cannot run, state exactly which check is unavailable and why.

## Audit-only mode
Unless the user explicitly says to implement/fix, first produce an audit report:
- page/route
- observed issue
- severity
- rendered evidence
- likely source file/component/style
- recommended fix
- regression risk

Do not modify code during audit-only mode.

## Implementation mode
When explicitly authorized to implement:
- trace each reported visual issue to its real source;
- make the smallest coherent end-to-end change;
- preserve existing logic and data behavior;
- verify the actual rendered screen after editing;
- do not deploy to production unless explicitly requested.

## Final report
Return:
1. branch + HEAD
2. audit/fix scope
3. files changed
4. concrete findings/fixes
5. test/build result
6. browser verification result
7. remaining blockers
8. deployment status (always "not deployed" unless explicitly authorized)
