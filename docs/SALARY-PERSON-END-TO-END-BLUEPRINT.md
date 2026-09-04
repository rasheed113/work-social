# Work Social — Salary Person End-to-End Blueprint

**Status:** Design / formula discussion — NOT implementation-ready until open decisions are explicitly frozen.

**Scope:** Salary Person mode only. Existing Work on Contract behavior must remain unchanged. Offline/Online AI is completely out of scope.

## 1. Existing Entry Point — Work Identity / Worker Settings

The Salary Person journey starts from the **existing Work Identity / Worker Settings page**. It must not begin at a salary calculation screen.

Current flow:

```text
Worker Settings
    ↓
Work Identity
    ↓
Existing Worker Identity form
```

The existing Work Identity screen already contains the worker identity/work information, including:

```text
Work Identity
Tell Work House what you do.

[Social / worker identity]

Work Role
Worker

Describe Your Work
...

Skills
...

Work ID
...

Save Work Identity
```

The Salary Person feature extends this existing screen.

### 1.1 New Worker Type control

Add a clear **Worker Type** selector/switch to the existing Work Identity form:

```text
Worker Type

○ Salary Person
○ Work per Job / Contract
```

Recommended placement is after the existing work identity fields and before the Work ID/save area. The exact visual control can be a segmented switch, radio-style selector, or equivalent premium control, but the two modes must be unmistakable.

### 1.2 Meaning of the modes

**Salary Person**

The worker is paid according to a saved salary policy. Work Social uses that policy for attendance, overtime, salary-period calculation, and salary slips.

**Work per Job / Contract**

The existing contract/piece-work flow remains active. Existing quantity, size, rate, work-entry, and contract-finance behavior must remain unchanged.

---

## 2. Worker Type Is the Branching Point

The end-to-end product branch is:

```text
Existing Work Identity
        ↓
    Worker Type
       /     \
      /       \
Salary Person   Work per Job / Contract
      ↓                    ↓
Salary flow          Existing flow unchanged
```

Selecting **Work per Job / Contract** must not activate salary setup.

Selecting **Salary Person** starts the Salary Person activation flow.

Switching modes must not delete or silently rewrite historical records from either mode.

Conceptually:

```text
Salary Person selected
        ↓
Salary Data Caution
        ↓
Continue to Salary Setup
        ↓
One-Time Salary Setup
        ↓
Save Salary Policy
        ↓
Salary Person Work House mode
```

This is the missing starting portion that makes the blueprint truly end-to-end.

---

## 3. Product Goal

Work Social currently supports contract/piece-based work. Salary Person mode adds a second work model for people paid by salary.

The key principle is:

> **Configure once, calculate automatically thereafter.**

The worker should configure salary rules once. Daily operation should use the saved policy instead of repeatedly asking the same salary-policy questions.

---

## 4. Pre-Form Salary Data Caution / Privacy Notice

Before the Salary Setup form opens, show a professional caution explaining how salary information is used.

Suggested product copy:

> ### Your Salary Data Is Private
>
> Your salary information is used only to maintain your personal salary, attendance, and overtime records in Work Social.
>
> We do not use your salary data for public display or social sharing. It helps Work Social provide you with a clear, organized, and accurate record of your work and salary information.
>
> Please review your salary details carefully before continuing.

Primary action: **Continue to Salary Setup**.

This notice is informational and must not promise security/privacy guarantees beyond the actual implementation. Database authorization and RLS remain mandatory.

---

## 5. One-Time Salary Setup Form

The Salary Person setup form currently contains:

### 5.1 Salary

- Amount: user-entered monetary value.
- Currency: required for monetary records/display.

### 5.2 Salary Type

- Daily
- Weekly
- 15 Days
- Monthly

This determines the base salary period. The exact mathematical conversion between these periods must be frozen before implementation.

### 5.3 Working Hours

- 8 hours
- 12 hours
- Optional / not set

Working hours are required for an exact hourly overtime calculation. If omitted, attendance can still be recorded, but the system must not invent an hourly basis.

### 5.4 Overtime Type

- Same as salary — `1.0×`
- `1.5×`
- `2.0×`

### 5.5 Sunday Paid?

- Yes
- No

If Yes, a normal Sunday off is paid according to the salary policy.

If the worker actually works on Sunday, Work Social does **not** automatically create overtime. The worker manually enters actual overtime hours, and the selected overtime multiplier is applied.

### 5.6 Holidays Paid?

- Yes
- No

The exact holiday calendar/source and working-holiday behavior remain open decisions.

### 5.7 Salary Start Date

A Salary Start Date is recommended for salary-period boundaries and historical accuracy. Exact UI/semantic treatment remains open until explicitly finalized.

---

## 6. Saved Salary Policy

After successful setup, the form values become a structured **Salary Policy** used by future calculations.

```text
Salary Policy
 ├─ salary amount
 ├─ currency
 ├─ salary type
 ├─ working hours
 ├─ overtime multiplier
 ├─ Sunday paid
 ├─ holidays paid
 └─ effective/start date
```

The worker should not need to answer these policy questions again for every daily entry.

Policy changes must not silently rewrite closed historical salary periods.

---

## 7. Post-Save Confirmation

After successful Salary Setup save, show:

> ### Salary Setup Saved Successfully
>
> Thank you for setting up your salary information with Work Social.
>
> For the best experience and the most accurate salary record:
>
> - **Always add your overtime hours** whenever you work overtime.
> - **Check your daily attendance notification** and take the appropriate action.
> - Keep your attendance and overtime information up to date so Work Social can maintain an accurate salary record for you.
>
> Your saved salary settings will be used automatically for future salary and overtime calculations.

Action: **Got It**.

---

## 8. Salary Person Work House Mode / Daily Entry

Once Salary Person is configured, Work House should use a salary-oriented daily workflow rather than the contract/piece-work entry model.

Minimum daily entry:

- Date
- Attendance: Present / Absent / Leave
- Overtime hours
- Optional note

Salary Person should not require piece/size/quantity/rate as its primary earning input.

The saved Salary Policy supplies the calculation rules.

Sunday and holiday policy is a saved policy decision, not a question repeated every day.

---

## 9. Attendance Model

Supported daily attendance states:

- Present
- Absent
- Leave

Attendance should be date-based and idempotent: one effective attendance result per worker per date unless a future product rule explicitly supports revisions.

### Absence deduction

Automatic salary deduction for absence is **not frozen**. Do not invent an absence-deduction formula before that policy is explicitly approved.

Leave paid/unpaid behavior is likewise an open policy decision.

---

## 10. Saturday → Sunday Rule

### Saturday Present

If Saturday is recorded as Present:

```text
Saturday Present → Sunday Present automatically
```

### Saturday Leave

If Saturday is Leave, Sunday must not silently become Leave.

Show a confirmation notification:

> Saturday was marked as leave. Should Sunday also be counted as leave?

Actions:

- **Yes** → Sunday = Leave
- **No** → Sunday = Present

### Saturday Absent

Behavior for Saturday = Absent remains **open** and must be frozen before implementation.

---

## 11. Sunday Paid + Sunday Worked

When `Sunday Paid = Yes`, a normal Sunday is a paid off-day according to the saved policy.

If the worker actually works on Sunday:

- Sunday paid-off status and overtime remain separate concepts.
- Work Social does not automatically create overtime merely because the date is Sunday.
- The worker manually enters actual overtime hours.
- The saved overtime multiplier is then applied.

Example:

```text
Sunday Paid = Yes
Sunday worked
Manual overtime = 2h
        ↓
Calculate 2h using saved OT multiplier
```

---

## 12. Holiday Rule

The setup contains `Holidays Paid = Yes/No`.

Before implementation, freeze:

- holiday calendar/source
- country/region
- timezone
- automatic holiday recognition
- treatment when the worker works on a holiday
- whether working a holiday creates overtime/premium treatment

No holiday rule should be guessed in production code.

---

## 13. Overtime Calculation

If today's overtime is 2 hours, Work Social uses:

1. Saved salary amount.
2. Saved salary type.
3. Finalized salary-period working-day basis.
4. Saved working hours, when available.
5. Saved overtime multiplier.
6. Today's overtime hours.

Conceptual formula:

`Overtime Amount = Hourly Rate × Overtime Multiplier × Overtime Hours`

Conceptually:

`Hourly Rate = Daily Rate ÷ Working Hours Per Day`

`Daily Rate` must be derived from the selected salary type using the finalized salary-period rules.

### Formula blocker

The exact Daily/Weekly/15-Day/Monthly conversion is **not frozen**. In particular, the Monthly denominator must not be guessed and may depend on working-day/calendar rules.

Currency calculations should use deterministic numeric/Decimal handling rather than JavaScript floating-point arithmetic for persisted financial totals.

Daily overtime accumulates into the active salary period.

---

## 14. Salary Period and Salary Slip

Salary-period calculations should keep components separate and explainable.

Minimum salary-slip components:

- Salary period
- Base salary
- Attendance summary
- Paid/applicable days
- Leave/absence information
- Overtime hours
- Overtime amount
- Sunday treatment where applicable
- Holiday treatment where applicable
- Final calculated amount

Example:

```text
Today's OT: 2h
      ↓
Calculate OT amount
      ↓
Add to current salary period
      ↓
Salary slip shows accumulated OT
```

Historical salary slips must remain explainable after later policy changes.

---

## 15. Attendance Notification Lifecycle — To Be Discussed Separately

The notification generator is intentionally **not finalized by this update**. Its detailed design will be discussed separately before implementation.

Current requirements recorded for that future discussion:

- If required attendance has not been marked, a daily attendance notification may be generated.
- Notification actions include Present / Absent / Leave.
- Taking an attendance action completes/expires the notification.
- Reading alone does **not** complete it.
- Read + no action remains pending.
- If the worker does not react, reminders can continue.
- Maximum pending cycle: 15 attendance notifications.
- After #15, the 15 notification records remain in history.
- New attendance notification generation then turns off for that pending cycle.
- The paused state is conceptually vacation/paused notification state, not necessarily employee vacation/leave.
- The exact reset condition, timing/cutoff, and generator implementation remain open.

**No notification-generator implementation should be treated as frozen until the separate notification discussion is completed.**

---

## 16. Salary Calculation Architecture

```text
Salary Policy
   ↓
Attendance + Overtime Events
   ↓
Sunday/Holiday Rules
   ↓
Calculation Engine
   ↓
Salary Period Ledger
   ↓
Salary Slip
```

The calculation engine must be deterministic and independently testable.

UI components must not contain the authoritative salary formulas.

The calculation engine must remain independent of any future Dashboard.

---

## 17. Worker Type Changes and Historical Integrity

Worker Type is a business-state transition, not a destructive reset.

Required principles:

- Existing Contract records remain intact.
- Existing Salary records remain intact.
- Historical records retain their original work model.
- A new salary policy does not retroactively rewrite finalized salary periods.
- Historical salary periods retain enough policy information to explain their results.

Exact switching UX and confirmation requirements remain implementation decisions.

---

## 18. Data Model Direction

Salary data should be separated from contract/piece-work economics.

Conceptual model:

```text
worker_profiles
      ↓
salary_policies
      ↓
attendance_records
      ↓
overtime_records
      ↓
salary_periods / salary_slips
```

Potential Salary Policy fields:

- worker_profile_id
- salary_amount
- currency
- salary_type
- working_hours_per_day nullable
- overtime_multiplier
- sunday_paid
- holidays_paid
- effective_from
- created_at
- updated_at

Potential attendance fields:

- worker_profile_id
- attendance_date
- status
- source/action metadata
- created_at
- updated_at

Potential overtime fields:

- worker_profile_id
- work_date
- hours
- multiplier/policy reference or snapshot as appropriate
- calculated_amount
- note
- created_at
- updated_at

Final schema must be designed against the actual repository schema and Supabase/RLS conventions before migrations are created.

---

## 19. Security / RLS

Salary information is sensitive personal financial data.

Required principles:

- A worker can access only their own salary data unless a future authorized employer/team model explicitly grants access.
- RLS must enforce ownership at the database layer.
- Client-supplied worker IDs must not be trusted for authorization.
- Salary amounts must not be exposed through public Social profile APIs.
- Salary information must not enter public/social activity surfaces unless separately designed and authorized.

---

## 20. Recommended Code Separation

Suggested architecture after repository inspection:

```text
worker/
  salary/
    salaryPolicy.ts
    salaryCalculations.ts
    salaryPeriods.ts
    overtimeCalculations.ts
    attendanceRules.ts
    weekendHolidayRules.ts
    salarySlip.ts
    salaryNotifications.ts
  pages/
    SalarySetupPage.tsx
    SalarySlipPage.tsx
    SalaryDashboardPage.tsx   # NOT DESIGNED YET
  components/
    SalarySetupForm.tsx
    SalaryPrivacyNotice.tsx
    SalarySetupSavedDialog.tsx
    SalaryAttendanceEntry.tsx
    SalaryOvertimeEntry.tsx
```

These are architectural targets, not permission to create files before the design is frozen.

---

## 21. Validation Requirements

Salary Setup:

- Salary amount must be positive.
- Currency must be valid.
- Salary type must be one of the four supported values.
- Working hours, when supplied, must be valid.
- Overtime multiplier must be 1.0, 1.5, or 2.0.
- Sunday/holiday settings must be explicit booleans.
- Start/effective date must be valid when required.

Daily entry:

- Attendance date must be valid.
- Status must be Present, Absent, or Leave.
- Overtime cannot be negative.
- Overtime precision must be defined before implementation.

---

## 22. Edge Cases / Open Decisions

Do not silently decide these before coding:

1. Exact Daily-rate denominator for Monthly salary.
2. Weekly-to-daily conversion.
3. 15-Day salary calculation basis.
4. Working-day/calendar basis for each salary type.
5. Absence deduction policy.
6. Paid/unpaid Leave policy.
7. Saturday Absent → Sunday behavior.
8. Holiday calendar/source/timezone.
9. Holiday work treatment.
10. Sunday/holiday work representation.
11. Notification-generator reset condition after 15 reminders.
12. Notification generation timezone/cutoff.
13. Overtime precision and maximum daily hours.
14. Salary-policy editing/versioning.
15. Salary-period closing/finalization.
16. Currency rounding precision and rounding stage.
17. Currency conversion, which is otherwise out of scope.

These are blockers for an authoritative calculation implementation, not reasons to alter the existing Contract system.

---

## 23. Dashboard Status — NOT DECIDED

The Salary Person Dashboard is intentionally deferred.

Do **not** freeze or implement its:

- layout
- cards
- KPIs
- charts
- period selector
- attendance presentation
- salary breakdown
- salary-slip navigation

The core Salary Person data/calculation engine must remain dashboard-agnostic.

---

## 24. Implementation Sequence

### Phase A — Starting UI / Worker Type

1. Inspect the existing Worker Settings → Work Identity implementation.
2. Add Worker Type to the existing Work Identity form.
3. Persist Salary Person vs Work per Job / Contract without breaking Contract behavior.
4. Ensure switching does not delete historical records.

### Phase B — Salary Setup UX

5. Add Salary Person activation flow.
6. Add salary-data caution/privacy notice.
7. Add one-time Salary Setup Form.
8. Persist Salary Policy securely.
9. Add successful-save confirmation.

### Phase C — Formula and policy freeze

10. Freeze salary-type formulas.
11. Freeze working-day/calendar basis.
12. Freeze absence/leave policy.
13. Freeze Sunday/holiday behavior.
14. Freeze overtime formula, precision, and rounding.

### Phase D — Data/calculation foundation

15. Design salary policy schema.
16. Design attendance schema.
17. Design overtime schema.
18. Design salary-period/slip representation.
19. Add RLS/ownership policies.
20. Implement deterministic calculation logic and tests.

### Phase E — Daily Salary Person workflow

21. Add Salary Person daily entry.
22. Add attendance handling.
23. Add manual overtime entry.
24. Add Saturday/Sunday behavior after rules are frozen.
25. Add holiday behavior after rules are frozen.

### Phase F — Notification generator

26. **STOP and separately discuss/freeze the notification generator.**
27. Only after that discussion implement daily notifications, action semantics, 15-notification cap, pause state, and reset behavior.

### Phase G — Salary Slip

28. Aggregate salary-period records.
29. Build explainable salary slips.
30. Verify overtime accumulation.
31. Verify historical policy integrity.

### Phase H — Dashboard

32. **STOP and design the Dashboard separately.**
33. Implement it only after its UX is explicitly approved.

---

## 25. Testing Matrix

### Worker Type

- Salary Person selection works from existing Work Identity.
- Work per Job / Contract selection preserves existing flow.
- Existing Contract worker remains functional.
- Mode switching does not delete historical records.

### Salary Setup

- Salary amount validation.
- Currency validation.
- Daily / Weekly / 15 Days / Monthly selection.
- 8h / 12h / unset working hours.
- 1× / 1.5× / 2× overtime.
- Sunday Paid Yes/No.
- Holidays Paid Yes/No.
- Start-date validation when finalized.

### Daily Salary Person

- Present / Absent / Leave.
- Overtime entry.
- Optional note.
- Saved policy is reused automatically.
- Contract quantity/rate fields are not required for salary work.

### Sunday

- Sunday paid off behavior.
- Sunday unpaid behavior after formula freeze.
- Sunday worked does not automatically create overtime.
- Manual Sunday overtime uses saved multiplier.
- Saturday Present → Sunday Present.
- Saturday Leave → confirmation → Sunday Leave.
- Saturday Leave → confirmation → Sunday Present.

### Notifications

- Unmarked attendance can produce a notification.
- Read alone does not complete it.
- Attendance action completes it.
- Reminder cycle stops at 15.
- All 15 remain in history.
- Reset behavior tested only after final policy is frozen.

### Salary Calculation

- All salary types.
- Overtime 1× / 1.5× / 2×.
- Missing working-hours behavior.
- Overtime accumulation.
- Historical policy integrity.
- Deterministic currency arithmetic.

### Security

- User A cannot read User B's salary policy.
- User A cannot read User B's attendance.
- User A cannot read User B's overtime.
- User A cannot read User B's salary slip.
- Public Social profile does not expose salary data.

### Regression

- Existing Contract work entry remains unchanged.
- Existing Contract finance remains unchanged.
- Existing Worker identity remains intact.
- Worker provisioning remains unchanged.
- Offline AI unchanged.
- Online AI unchanged.

---

## 26. Non-Goals

This feature does not define or implement:

- Employer payroll administration.
- Tax calculation.
- Government deductions.
- Benefits administration.
- Bank payment execution.
- Currency conversion.
- Employer-side access unless separately designed.
- Team payroll.
- Advanced HR management.
- Final Salary Person Dashboard design.
- Changes to Contract Worker calculations.
- Offline AI or Online AI changes.

---

## 27. Definition of Done

Salary Person is truly end-to-end only when a worker can start at the existing Work Identity page and follow the complete approved journey:

```text
Existing Worker Settings
        ↓
Existing Work Identity
        ↓
Worker Type = Salary Person
        ↓
Salary Data Caution
        ↓
Continue to Salary Setup
        ↓
One-Time Salary Setup
        ↓
Saved Salary Policy
        ↓
Salary Person Work House mode
        ↓
Daily Attendance
        ↓
Manual Overtime
        ↓
Salary Period Calculation
        ↓
Explainable Salary Slip
```

At the same time:

```text
Worker Type = Work per Job / Contract
        ↓
Existing Contract Flow
        ↓
UNCHANGED
```

The feature is not complete if Salary Person exists only as a disconnected salary-calculation screen.

---

## 28. Current Design Freeze

### Frozen / Agreed Direction

- Salary Person starts from the existing Work Identity / Worker Settings page.
- Add Worker Type there.
- Choices are Salary Person and Work per Job / Contract.
- Contract behavior remains unchanged.
- Salary Person has a one-time Salary Setup.
- Saved salary settings drive future calculations.
- Salary data is intended for the user's private salary/attendance/overtime record, not public/social display.
- Daily Salary Person entry is attendance + overtime, not piece-work quantity/rate.
- Sunday paid-off status and manually entered Sunday overtime are separate.
- Saturday Present → Sunday Present.
- Saturday Leave → Sunday confirmation.
- Dashboard remains undecided/deferred.
- AI remains out of scope.

### Open / Must Be Frozen Before Relevant Implementation

- Exact salary-type conversion formulas.
- Working-day/calendar basis.
- Absence/leave pay policy.
- Saturday Absent behavior.
- Holiday calendar and holiday-work behavior.
- Overtime precision/rounding.
- Salary Start Date semantics.
- Historical policy version/snapshot strategy.
- Notification-generator details and reset condition.
- Exact Worker Type switching UX.

---

## 29. Golden Rule

**Do not code from assumptions.**

The authoritative product journey begins here:

> **Existing Work Identity → Worker Type → Salary Person → Salary Setup → Daily Work → Calculation → Salary Slip**

The existing **Work per Job / Contract** path is the protected regression boundary.

The notification generator will be discussed and finalized separately before that portion is implemented.
