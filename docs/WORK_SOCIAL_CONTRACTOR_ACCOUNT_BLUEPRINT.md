# Work Social — Contractor Account
## Final Business Contract & Product Blueprint

**Version:** 1.0  
**Status:** Blueprint / Pre-Implementation  
**Product:** Work Social  
**Module:** Contractor Account  
**AI:** Frozen / Out of Scope for Contractor Core

---

## 1. Purpose

Contractor Account is a Work Social account capability for a person who receives commercial work at an **Actual Rate**, distributes execution to workers at a **Worker Rate**, and retains the difference as a **Contractor Commission**.

The product must make the commercial chain understandable and financially safe:

```text
Master Contract
      ↓
Actual Rate
      ↓
Worker Rate + Commission
      ↓
Team Distribution
      ↓
Worker Work
      ↓
Worker Payable
      ↓
Payment Event
      ↓
ONE Finance Event
      ↓
Received / Expenses / Reconciliation
```

The Contractor Account is a new business capability. It must extend existing Work Social primitives without silently redefining existing Worker, Social, or Finance behavior.

---

## 2. Core Business Vocabulary

### Contractor
The authenticated Work Social user operating the Contractor account and owning Contractor resources.

### Master Contract
The Contractor's commercial source of work. It records the actual commercial terms from which team execution and commission are derived.

### Team
A Contractor-owned execution group connected to a Master Contract context.

### Worker
An existing authenticated Work Social user invited to and accepted into a Contractor Team.

### Team Work
Work performed in the context of a Contractor Team. It is separate from the worker's personal work.

### Worker Rate
The per-piece amount attributable to the worker.

### Actual Rate
The per-piece commercial amount represented by the Master Contract.

### Commission
The Contractor's per-piece commercial earning.

### Payment
A real payment event against a worker payable.

### Finance Event
The single authoritative financial event representing the real-world money movement. Other screens are views of this event, not additional financial events.

### Received Money
Actual money received/withdrawn/accounted for in financial reality. It is not the same thing as expected commission.

---

## 3. Non-Negotiable Financial Formula

The fundamental rate equation is:

```text
Actual Rate = Worker Rate + Commission
```

For every allocated piece:

```text
Worker Amount = Quantity × Worker Rate
Contractor Commission = Quantity × Commission
Actual Contract Value = Quantity × Actual Rate
```

Example:

```text
Quantity      = 2,400
Actual Rate   = 55
Worker Rate   = 50
Commission    = 5

Actual Value  = 132,000
Worker Amount = 120,000
Commission    = 12,000
```

The Contractor **does not pay the worker 55 per piece** in this model. The worker payable is based on the Worker Rate of 50. The Contractor's commercial earning is 5 per piece.

---

## 4. Contractor Finance Color Contract

These meanings are permanent product semantics:

- 🟢 **Green = Contractor's real earning / commission**
- 🟠 **Orange = Worker amount / payable**
- 🔴 **Red = Received / withdrawal-side money**

These colors must not be repurposed to mean generic status such as completed, pending, or warning.

Expected commission must never be silently rewritten to equal received money.

Example:

```text
Expected Contractor Commission = 12,000 🟢
Actually accounted/received     = 10,000 🔴
Unaccounted difference          =  2,000
```

The 2,000 difference is an accounting/reconciliation discrepancy. It does not reduce the original expected commission to 10,000.

---

## 5. Identity Contract

Contractor Account belongs to the **existing authenticated Work Social identity**.

Contractor functionality must not create a second login identity or a parallel user identity model.

The Contractor role/account state is an additional capability of the authenticated user.

Existing Worker identity remains valid and must continue to operate normally.

### Work Social ID
The existing Work Social user-facing unique identity identifier must be reused if it is already the canonical user-facing identifier. Contractor implementation must not create a conflicting second identity identifier.

If the existing `work_id` is not the canonical user-facing Work Social ID, the exact mapping must be resolved during Phase 0 before implementation. No guess or silent reinterpretation is permitted.

---

## 6. Contractor Account Switch

The existing account switch contains:

- Salary Person
- Work on Contract Job

Contractor adds:

- **Contractor**

Selecting Contractor opens the Contractor Personal Dashboard.

The Contractor Personal Dashboard is separate from Team Dashboard data.

---

## 7. Contractor Personal Dashboard

The initial Contractor dashboard contains:

- Today's Entries
- Weekly Entries
- Monthly Entries
- Grand Total

The Contractor can add work entries through a Worker-like workflow with Contractor-specific commercial information, including:

- Item
- Quantity
- Size/sizes where applicable
- Actual Rate
- Worker Rate
- Commission per Piece
- Notes / occurrence information where supported

The commercial relationship must satisfy:

```text
Actual Rate = Worker Rate + Commission
```

Dashboard totals must be derived from persisted records rather than fake counters.

---

## 8. Master Contract

A Master Contract is the authoritative commercial source of a Contractor job.

Minimum conceptual fields:

- Contractor owner
- Contract/item identity
- Total quantity
- Size information where applicable
- Actual Rate
- Worker Rate / applicable worker-rate basis
- Commission
- Lifecycle state
- Created/updated timestamps

The Master Contract is not the same object as a worker's Team Work entry.

### Master Contract authority
The Contractor owns and controls the Master Contract within authorized Contractor scope.

### Historical commercial truth
Historical work, allocation, payable, and payment calculations must retain the rates/terms that governed them. Editing a current contract must never silently rewrite already-established historical financial reality.

---

## 9. Team Contract

A Contractor can create multiple Teams.

Team creation minimum fields:

```text
Team Name
Company Name
Contract Work Type
```

Example:

```text
Team Name: ABC
Company: ABC Garments
Contract Work Type: Stitching
```

Each Team receives a system-generated unique Team ID that can be copied.

A Team operates within an explicit Master Contract context. The exact one-team-to-one-contract versus reusable-team rule must be frozen in Phase 0 before implementation; the initial Chick must use one unambiguous relationship and must not infer it from UI state.

---

## 10. Membership Contract

A Contractor adds workers to a Team through two discovery methods.

### A. Name Search

Contractor → Team → Add Members → search by name.

Multiple matching users may appear. Contractor selects the intended identity.

Existing Friends/search behavior must remain unchanged.

### B. Unique Work Social ID

A worker may provide their exact Work Social ID.

Exact ID search must resolve the intended identity before invitation.

### Invitation State

Selecting a worker creates a **Pending Invitation**.

Pending Invitation is **not membership**.

The worker receives the invitation and can:

- Accept
- Decline

Decline ends that invitation.

Accept creates official active Team membership.

Only active membership grants the corresponding Team Work authority.

---

## 11. Membership Safety

The following are separate business states:

```text
No Relationship
      ↓
Pending Invitation
      ↓
Accepted / Active Member
      ↓
Removed / Left / Terminated
```

A pending worker must not receive active-member permissions.

A removed/left worker must not regain Team access merely because historical records exist.

Historical Team Work and payment records must remain coherent after membership changes.

Exact edge-case behavior for leaving, rejoining, removal with outstanding payable, and team archival is a Phase 0/implementation decision and must be explicitly frozen before those operations are built.

---

## 12. Team Dashboard

The Contractor Team Dashboard provides:

- Today's Work
- Weekly Work
- Monthly Work
- Grand Total

Clicking a summary opens the underlying work details.

Worker-level details may show entries such as:

- Abdullah Work
- Ali Work
- Rasheed Work

Contractor/team leader can see authorized Team Work details.

Other workers do **not** automatically receive access to each other's private detailed work or financial data.

---

## 13. Worker Team Experience

After acceptance:

1. Contractor Team member list shows the worker's profile picture and display name.
2. Worker Account Team Work becomes available.
3. Accepted Team appears under Team Work.
4. Worker can open the accepted Team.
5. Worker can create Team Work entries according to Team permissions.
6. Those Team Work entries become visible to the authorized Contractor Team Dashboard.

Personal Work and Team Work remain distinct concepts.

Whether Team Work totals are also aggregated into the worker's Personal Dashboard is **not part of the initial contract** and must not cause duplicate financial/work totals.

---

## 14. Member Card Contract

A Team member card contains:

- Profile picture
- Display name
- Top-right 3-dots menu

Initial member actions:

- Message
- Remove from Team

Additional actions are growth features unless required for correctness.

---

## 15. Team Work and Distribution

Master Contract represents the commercial source.

Team Work represents execution.

Work Distribution assigns execution quantity to workers.

Example:

```text
Master Contract quantity = 2,400

Abdullah = 100
Ali      = 150
Rasheed  = 200
```

The system must define whether undistributed quantity is allowed. Initial implementation should preserve a deterministic remaining-quantity calculation and must prevent allocations that violate the frozen conservation rule.

A worker's payable is derived from:

```text
Worker Quantity × applicable historical Worker Rate
```

Contractor commission is derived from the same underlying commercial activity:

```text
Worker Quantity × applicable Commission
```

The same quantity must not independently create contradictory payable and commission records.

---

## 16. Rate and Historical Snapshot Contract

For any financially meaningful historical record, the system must preserve the rate/commission values that governed that record.

At minimum, historical work/payable/payment calculations must not depend on a mutable current rate.

If a Master Contract rate changes:

- Existing historical records remain unchanged.
- New work uses the new applicable rate only after the amendment becomes effective.
- The amendment must not rewrite previously calculated payable or commission.

Exact amendment/version UX can be implemented after the core historical invariant is established.

---

## 17. Payment Contract

A Worker Payable must exist before a payment can be recorded against it.

A Payment is a real-world money movement, not a theoretical earning.

Minimum conceptual payment identity:

- Payment ID
- Worker/payee
- Underlying payable attribution
- Amount
- Payment timestamp
- Payment state
- Authoritative creator/owner
- Finance-event identity/source linkage

### Payment correction
After a payment is recorded, later corrections must use an explicit correction/reversal/adjustment model. They must not silently mutate historical money movement into a different event.

---

## 18. ONE Financial Event Rule

This is a hard invariant:

> **One real-world payment = one authoritative financial event.**

Example:

```text
Payment to Ali
7 September 2026 — 7:59 PM
5,000
```

That real payment may be visible in:

- Contractor Team payment history
- Contractor Finance
- Finance Manager

But those are views of the same event.

The implementation must not create:

```text
Payment Event = 5,000
Finance Event = another 5,000
```

That would double-count reality.

Existing Finance Manager source identity/uniqueness patterns must be respected when connecting Contractor payments.

---

## 19. Contractor Commission vs Received Money

Contractor commission is an expected commercial earning derived from work.

Received money is actual financial reality.

They are separate concepts.

```text
Expected Commission
        ↓
Financial Reality
        ↓
Received / Expenses / Payments
        ↓
Reconciliation
```

A commission record must not automatically be treated as cash received merely because work was completed.

The exact financial recognition timing of commission must be frozen before Finance Integration is implemented.

---

## 20. Finance Manager Integration

Finance Manager remains an existing financial subsystem and source of truth for its financial records.

Contractor Finance must integrate through the single financial-event boundary rather than creating a parallel hidden finance ledger.

The integration must support the distinction between:

- Expected Contractor Commission 🟢
- Worker Payable 🟠
- Actual Received / withdrawal-side money 🔴
- Expenses
- Payments
- Unaccounted/unmatched differences

Example:

```text
Expected commission = 12,000
Actual accounted    = 10,000
Difference          =  2,000
```

The difference is surfaced for reconciliation. It does not rewrite the expected commission.

---

## 21. Reconciliation Contract

Reconciliation compares expected Contractor commercial reality with actual financial reality.

Conceptually:

```text
Expected Commission
        −
Financially Accounted Reality
        =
Unmatched / Unaccounted Difference
```

The reconciliation layer must make clear whether a difference is caused by, for example:

- money not yet received
- received money not recorded
- expense not recorded
- incorrect payment
- other mismatch

The system must not guess the cause merely from the numeric difference.

AI-assisted explanation is explicitly outside the current scope.

---

## 22. Authorization Contract

Authorization is based on authenticated identity plus the business relationship to the Contractor resource.

At minimum:

### Contractor
Can access and mutate Contractor-owned resources for which the Contractor is authorized.

### Accepted Worker
Can access their own authorized Team Work and accepted Team context.

### Pending Worker
Can only act on the invitation itself according to invitation permissions.

### Other Team Members
Do not automatically gain access to another worker's private detailed work/payment information.

### Unrelated User
Cannot access Contractor Team, membership, work, payment, or finance records without an explicit authorized relationship.

All new Contractor tables/records must have RLS/security boundaries consistent with these business rules.

---

## 23. Existing System Protection

Contractor implementation is additive.

### Existing Worker Contract Work
Must continue to work exactly according to its existing semantics.

### Existing `work_entries`
Must remain valid and historically readable. Contractor Team Work must not silently repurpose existing Worker entries.

### Existing Worker Finance
Must remain operational. Contractor payment integration must not duplicate Worker financial reality.

### Existing Finance Manager
Must remain authoritative for its existing financial records and must not be replaced by a hidden Contractor ledger.

### Existing Work ID
Its meaning must remain stable. Contractor Team IDs must not conflict with or redefine existing Work IDs.

### Existing RLS
Must remain secure. Contractor functionality must not create a bypass around existing authorization boundaries.

### Existing Notifications
Contractor invitation/acceptance notifications must extend existing infrastructure without changing unrelated notification semantics.

### Existing Friends/Search
Existing Friends/search behavior remains intact. Contractor worker discovery is a separate business use of identity search, not a redefinition of friendship.

---

## 24. Core Invariants

1. Contractor uses the authenticated Work Social identity.
2. Contractor ownership is explicit.
3. Master Contract and Team Work are separate concepts.
4. Team Work and personal Worker Work are separate concepts.
5. Actual Rate = Worker Rate + Commission.
6. Contractor commission is not Worker payable.
7. 🟢 Green means Contractor commission/earning.
8. 🟠 Orange means Worker amount/payable.
9. 🔴 Red means received/withdrawal-side money.
10. Pending invitation is not membership.
11. Active membership is required for Team Work authority.
12. Historical rates cannot silently change historical financial reality.
13. Worker payable is derived from authoritative allocated quantity and applicable historical Worker Rate.
14. Contractor commission is derived from the same underlying commercial activity.
15. One real-world payment creates one authoritative financial event.
16. Finance Manager must not double-count Contractor payments.
17. Expected commission is not automatically received money.
18. Existing Worker/Social/Finance behavior remains intact.
19. RLS must enforce the business authorization boundary.
20. AI is not required for the Contractor Core.

---

## 25. Functional Chick Definition 🐣

The first complete Contractor release must prove this real persisted lifecycle:

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

The Chick must be:

- persisted
- authorized
- RLS-protected
- connected by real relationships
- usable by the correct identities
- based on real quantities and rates
- historically coherent
- financially non-duplicating
- testable end-to-end
- independent of AI

The Chick is intentionally small in UX polish. Correct wiring comes before feature richness.

---

## 26. Explicitly Outside the Chick

- AI-assisted Contractor operations
- advanced analytics
- bulk worker operations
- enterprise organization hierarchy
- sophisticated automation
- advanced reporting
- advanced integrations
- enterprise-scale RBAC
- advanced notification workflows
- nonessential convenience features

These may be introduced later only when they solve a real Contractor problem.

---

## 27. Pending Decisions Before Implementation

The following must be explicitly frozen during Phase 0 because they can alter schema, authorization, historical integrity, or financial correctness:

1. Canonical user-facing Work Social ID versus existing `worker_profiles.work_id` semantics.
2. Exact Contractor account/entity ownership representation.
3. Exact Master Contract lifecycle states.
4. Whether Worker Rate is global per contract, per item, per size, per worker, or another frozen basis.
5. Exact commission override rules, if any.
6. Whether Team is permanently bound to one Master Contract or can execute multiple contracts.
7. Quantity conservation/undistributed quantity rule.
8. Reallocation policy.
9. Contract amendment/version policy.
10. Membership removal/leave/rejoin policy.
11. Outstanding payable behavior after membership removal.
12. Payment-to-payable attribution cardinality.
13. Payment correction/reversal policy.
14. Exact point at which Contractor commission becomes financially recognized.
15. Which Finance Manager event types participate in reconciliation.
16. Whether Contractor expenses reduce the displayed reconciliation balance and how.
17. Over-receipt/under-receipt handling.
18. Exact permission boundary for Contractor, accepted Worker, pending Worker, and other Team members.

No code should be written for these areas until their rules are frozen.

---

## 28. Implementation Roadmap

### Phase 0 — Business Contract / Data Foundation

0.1 Contractor vocabulary and invariants  
0.2 Identity and ownership contract  
0.3 Master Contract / Team / Work relationship contract  
0.4 Rate / payment / finance-event contract  
0.5 RLS and authorization contract

### Phase 1 — Contractor Identity

1.1 Contractor identity capability  
1.2 Contractor ownership  
1.3 Contractor authorization  
1.4 Access validation

### Phase 2 — Contractor Core

2.1 Contractor core persistence  
2.2 Contractor lifecycle/state  
2.3 Contractor-owned resources  
2.4 Contractor read/write authorization

### Phase 3 — Master Contract

3.1 Master Contract persistence  
3.2 Contract ownership  
3.3 Contract lifecycle  
3.4 Rate/commission contract  
3.5 Historical rate/version semantics

### Phase 4 — Team Foundation

4.1 Team persistence  
4.2 Team ownership  
4.3 Team ↔ Master Contract relationship  
4.4 Team authorization

### Phase 5 — Membership

5.1 Worker invitation  
5.2 Invitation state  
5.3 Worker acceptance  
5.4 Active membership  
5.5 Membership authorization

### Phase 6 — Team Work

6.1 Team Work persistence  
6.2 Team Work ↔ Team relationship  
6.3 Team Work ↔ Master Contract relationship  
6.4 Work authorization  
6.5 Work lifecycle validation

### Phase 7 — Work Distribution

7.1 Worker allocation  
7.2 Quantity allocation rules  
7.3 Worker rate snapshot  
7.4 Worker payable  
7.5 Contractor commission derivation

### Phase 8 — Payments

8.1 Payment initiation  
8.2 Payment event persistence  
8.3 Payment lifecycle/history  
8.4 Single financial-event enforcement

### Phase 9 — Finance Integration

9.1 Finance-event linkage  
9.2 Contractor Finance views  
9.3 Received/expense/payment integration

### Phase 10 — Reconciliation

10.1 Expected commission calculation  
10.2 Actual financial reality comparison  
10.3 Unmatched/unaccounted difference handling

### Phase 11 — Core Validation

11.1 Identity/RLS validation  
11.2 Contract/team/membership validation  
11.3 Work/distribution/payable validation  
11.4 Payment/Finance non-duplication validation  
11.5 End-to-end Contractor Chick validation

### Phase 12 — Growth

12.1 Useful filters  
12.2 Better management UX  
12.3 Reporting improvements  
12.4 Productivity features  
12.5 Additional Contractor capabilities justified by real use

---

## 29. Development Philosophy

The Contractor Account follows:

```text
🥚 Blueprint / Business Contract
        ↓
🐣 Functional Chick
        ↓
🐥 Useful Extensions
        ↓
🐔 Mature Contractor Account
```

The first implementation must not attempt to build the mature product all at once.

The correct order is:

**Business Contract → Blueprint Review/Freeze → Phase 0 → Functional Chick → useful options one by one → mature product.**

Feature count is not the goal. A reliable business lifecycle is the goal.

---

## 30. Current Status

**Blueprint:** Created in repository  
**Application Code:** Not changed by this blueprint  
**Database:** Not changed by this blueprint  
**Deployment:** Not performed  
**AI Contractor Functionality:** Frozen  
**Next Gate:** Human/business review and explicit freeze of Phase 0 pending decisions
