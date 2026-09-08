# Work Social — Contractor Account
## 🔒 Blueprint Freeze Record

**Contract:** `WORK_SOCIAL_CONTRACTOR_ACCOUNT_BLUEPRINT.md`  
**Freeze Version:** 1.1  
**Status:** 🔒 FROZEN — Pre-Implementation  
**Scope:** Contractor Core / Functional Chick  
**AI:** Frozen / Out of Scope

---

## 1. Freeze Decision

The Contractor Core business contract is frozen for implementation planning.

The frozen contract defines business meaning, ownership, permissions, historical integrity, quantity/rate rules, payment semantics, and Finance Manager integration. Technical implementation details may vary, but they must not change these business rules without an explicit blueprint revision.

---

## 2. Identity — FROZEN

- Contractor is a capability of the existing authenticated Work Social user.
- No second login or parallel identity is created.
- The canonical user-facing Work Social ID is used for exact worker discovery.
- Existing internal `work_id` semantics must remain unchanged; if it is not the canonical public ID, Phase 0 establishes a mapping rather than redefining it.
- Team ID is a separate resource identifier.

---

## 3. Contractor / Master Contract — FROZEN

- Contractor owns Contractor resources through authenticated identity.
- Master Contract is the authoritative commercial source.
- Initial lifecycle: `DRAFT → ACTIVE → COMPLETED → CLOSED`.
- Draft cannot create active execution.
- Completed/closed contracts cannot silently rewrite historical work, payable, payment, or commission.
- Historical records retain the terms that governed them.

---

## 4. Commercial Rules — FROZEN

```text
Actual Rate = Worker Rate + Commission
Worker Amount = Quantity × applicable historical Worker Rate
Contractor Commission = Quantity × applicable historical Commission
Actual Contract Value = Quantity × Actual Rate
```

For the initial Chick:

- Worker Rate is defined at the applicable Master Contract work/item level.
- Advanced per-worker/per-size rate matrices are deferred.
- Arbitrary hidden commission overrides are not part of the Chick.

Example:

```text
2,400 pieces
Actual Rate = 55
Worker Rate = 50
Commission = 5

Actual Value = 132,000
Worker Amount = 120,000
Contractor Commission = 12,000
```

---

## 5. Team — FROZEN

- Contractor may create multiple Teams.
- Required Team creation data: Team Name, Company Name, Contract Work Type.
- Each Team gets a unique Team ID.
- Initial Chick relationship: **one Team operates within one active Master Contract context**.
- Reusable Teams across multiple simultaneous contracts are deferred.

---

## 6. Quantity / Distribution — FROZEN

- Allocated quantity may never exceed Master Contract quantity.
- Remaining quantity is deterministic: `Master Quantity − Total Allocated Quantity`.
- Undistributed quantity is allowed.
- Corrections/reallocation are explicit operations.
- Historical financial reality cannot be silently rewritten.
- The same authoritative allocated quantity drives Worker Payable and Contractor Commission.

---

## 7. Membership — FROZEN

```text
No Relationship
      ↓
Pending Invitation
      ↓
Accepted / Active Member
      ↓
Removed / Left
```

- Pending Invitation is not membership.
- Accept creates active membership.
- Decline ends the invitation.
- Only active membership grants Team Work authority.
- Removed/left workers lose active access.
- Historical Team Work and payment records remain.
- Removing a worker does not erase outstanding payable.
- Detailed rejoin, duplicate-invitation, leave UX, and archival workflows are deferred unless needed for core correctness.

---

## 8. Visibility / Authorization — FROZEN

- Contractor can access authorized Contractor-owned resources.
- Accepted Worker can access their own authorized Team Work and accepted Team context.
- Pending Worker can act only on invitation permissions.
- Other Team Members do not automatically see another worker's private detailed work/payment information.
- Unrelated users have no Contractor resource access.
- RLS must enforce these boundaries.

---

## 9. Historical Rates — FROZEN

Any financially meaningful historical record preserves the rates/commission that governed it.

A later contract amendment affects future work only after its effective point. It does not rewrite existing historical work, payable, commission, or payment reality.

---

## 10. Payment — FROZEN

- Worker Payable exists before payment is recorded against it.
- Initial Chick: one payment → one Worker Payable attribution.
- Payment represents real-world money movement.
- Corrections use explicit correction/reversal/adjustment events.
- Historical money movement is never silently rewritten.

---

## 11. ONE Financial Event — HARD FREEZE

> **One real-world payment = one authoritative financial event.**

A payment may appear in Contractor Team history, Contractor Finance, and Finance Manager, but these are views/integrations of the same event.

No duplicate Contractor ledger event may be created for the same real payment.

Existing Finance Manager source identity and uniqueness protections must be respected.

---

## 12. Finance Color Contract — HARD FREEZE

- 🟢 **Green = Contractor real earning / commission**
- 🟠 **Orange = Worker amount / payable**
- 🔴 **Red = Received / withdrawal-side money**

These meanings are not generic status colors.

---

## 13. Commission vs Received Money — HARD FREEZE

Expected commission and received money are separate concepts.

```text
Expected Commission ≠ Received Money
```

Example:

```text
Expected Commission = 12,000 🟢
Received/Accounted  = 10,000 🔴
Unmatched Difference = 2,000
```

The expected commission remains 12,000. The 2,000 is an unmatched/unaccounted financial difference.

Expenses and received amounts do not retroactively rewrite expected commission.

Under-receipt and over-receipt remain explicit unmatched financial conditions. The system must not invent a cause from the numeric difference alone.

---

## 14. Existing System Protection — HARD FREEZE

Contractor is additive.

- Existing Worker Contract Work semantics remain unchanged.
- Existing `work_entries` remain valid and historically readable.
- Contractor Team Work does not silently repurpose existing Worker entries.
- Existing Worker Finance remains operational.
- Finance Manager remains authoritative for its existing financial records.
- Existing Work ID meaning remains stable.
- Existing Friends/Search semantics remain intact.
- Existing Notifications semantics remain intact.
- Existing RLS/security cannot be bypassed.
- AI is not required by Contractor Core.

---

## 15. Functional Chick — FROZEN

The first complete Contractor release must prove:

```text
Contractor
   ↓
Master Contract
   ↓
Team
   ↓
Worker Invitation
   ↓
Worker Acceptance
   ↓
Team Work
   ↓
Work Distribution
   ↓
Worker Payable
   ↓
Contractor Commission
   ↓
Payment
   ↓
ONE Finance Event
   ↓
Reconciliation
```

The Chick must be real, persisted, authorized, RLS-protected, historically coherent, financially non-duplicating, end-to-end testable, and independent of AI.

---

## 16. Explicitly Deferred — NOT Chick Blockers

These are intentionally deferred and must not expand the initial implementation:

- AI assistance
- Advanced reporting/analytics
- Reusable multi-contract Teams
- Advanced per-worker/per-size rate matrices
- Multi-payable payment allocation
- Complex rejoin UX
- Advanced duplicate-invitation UX
- Advanced team archival workflows
- Advanced filters/management tooling
- Automatic Team Work aggregation into Personal Dashboard totals

These require a separately justified future contract/extension if introduced.

---

## 17. Frozen Roadmap

```text
Phase 0 — Business Contract / Data Foundation
Phase 1 — Contractor Identity
Phase 2 — Contractor Core
Phase 3 — Master Contract
Phase 4 — Team Foundation
Phase 5 — Membership
Phase 6 — Team Work
Phase 7 — Work Distribution
Phase 8 — Payments
Phase 9 — Finance Integration
Phase 10 — Reconciliation
Phase 11 — Core Validation
Phase 12 — Growth
```

Phase 0 must implement only the foundation required by this frozen contract. No Growth work is allowed to leak into the Chick.

---

## 18. Freeze Record

**Business Contract:** 🔒 FROZEN  
**Contractor Core:** 🔒 FROZEN FOR IMPLEMENTATION  
**Functional Chick:** 🔒 FROZEN  
**Roadmap:** 🔒 FROZEN  
**Application Code:** unchanged by this freeze  
**Database:** unchanged by this freeze  
**Deployment:** none  
**AI:** frozen

Any change to the frozen business meaning requires an explicit blueprint revision before implementation proceeds.
