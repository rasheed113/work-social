# Work Social — Salary Person End-to-End Blueprint

**Status:** Design / formula discussion — NOT implementation-ready until open decisions are explicitly frozen.

**Scope:** Salary Person mode only. Existing Work on Contract behavior must remain unchanged. Offline/Online AI is completely out of scope.

## 1. Product Goal

Work Social currently supports contract/piece-based work. Salary Person mode adds a second work model for people paid by salary.

The user selects **Salary Person** in Worker Settings. Before the setup form opens, Work Social shows a privacy/use notice. The user then completes a one-time Salary Setup Form. The saved salary policy becomes the basis for attendance, overtime, Sunday/holiday handling, salary-period calculations, salary slips, and notifications.

The key principle is:

> **Configure once, calculate automatically thereafter.**

Daily attendance entries should remain simple. The user should not repeatedly answer salary-policy questions.

---

## 2. Work Type Selection

Worker Settings exposes two mutually exclusive work modes:

- **Salary Person**
- **Work on Contract**

### Contract mode

Existing contract functionality remains intact and is not recalculated through the salary engine.

### Salary mode

Selecting Salary Person opens the one-time Salary Setup flow.

Switching modes must not delete or silently rewrite the other mode's historical records.

---

## 3. Pre-Form Privacy Notice

Before opening Salary Setup, show a professional caution explaining that salary data is retained to provide the user's personal salary/attendance/overtime record and is not intended for public/social display or sharing.

Approved wording:

> ### Your Salary Data Is Private
>
> Your salary information is used only to maintain your personal salary, attendance, and overtime records in Work Social.
>
> We do not use your salary data for public display or social sharing. It helps Work Social provide you with a clear, organized, and accurate record of your work and salary information.
>
> Please review your salary details carefully before continuing.

Primary action: **Continue to Salary Setup**.

This notice is informational; implementation must follow the application's actual privacy/security guarantees.

---

## 4. One-Time Salary Setup Form

The first Salary Person setup form currently contains:

### 4.1 Salary

- Amount: user-entered monetary value.
- Currency: required for monetary records/display.

### 4.2 Salary Type

Four options:

- Daily
- Weekly
- 15 Days
- Monthly

This determines the base salary period and therefore the salary-period calculation engine.

### 4.3 Working Hours

Optional:

- 8 hours
- 12 hours
- Not set / omitted

Working hours are required for exact hourly overtime-value calculation. If omitted, attendance can still be recorded, but the system must not invent an hourly basis.

### 4.4 Overtime Type

Options:

- Same as salary — `1.0 × hourly rate`
- `1.5 × hourly rate`
- `2.0 × hourly rate`

### 4.5 Sunday Paid?

- Yes
- No

Interpretation:

- If Yes, a normal Sunday off is still paid according to the salary policy.
- If No, normal Sunday off is not paid.
- Working on Sunday does **not** automatically create overtime. If the worker actually works overtime on Sunday, the worker manually adds the overtime hours and the selected overtime multiplier is used.

### 4.6 Holidays Paid?

- Yes
- No

The exact holiday calendar/source remains an implementation decision and must be defined before coding the holiday engine.

### 4.7 Salary Start Date

Recommended required field for period boundaries and historical accuracy. Exact UI treatment remains to be finalized.

---

## 5. Post-Save Confirmation

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

## 6. Daily Salary Entry

Salary Person's New Entry must not reuse the contract/piece-work fields as the primary salary workflow.

Minimum daily entry concept:

- Date
- Attendance: Present / Absent / Leave
- Overtime hours
- Optional note

The saved Salary Policy supplies the calculation rules.

### Important

Sunday/holiday paid status is a policy decision, not a daily question.

Sunday overtime is manually entered when the worker actually works extra hours.

---

## 7. Overtime Calculation

If today's overtime is 2 hours, Work Social uses:

1. Saved salary amount.
2. Saved salary type.
3. Applicable salary-period working-day basis.
4. Saved working hours, when available.
5. Saved overtime multiplier.
6. Today's overtime hours.

Conceptual formula:

`Overtime Amount = Hourly Rate × Overtime Multiplier × Overtime Hours`

Where:

`Hourly Rate = Daily Rate ÷ Working Hours Per Day`

and:

`Daily Rate` is derived from the saved salary amount and the selected salary type according to the finalized salary-period rules.

### Critical open formula decision

The exact conversion from Daily/Weekly/15-Day/Monthly salary to Daily Rate must be frozen before implementation. In particular, the Monthly denominator must not be guessed; it may depend on configured working days/calendar rules.

The engine must use deterministic Decimal/numeric arithmetic appropriate for currency and avoid JavaScript floating-point drift in persisted monetary values.

---

## 8. Salary Slip

The salary slip should keep components separate rather than hiding everything inside one total.

Minimum conceptual sections:

- Salary period
- Base salary
- Attendance summary
- Paid days / applicable days
- Leave/absence information
- Overtime hours
- Overtime amount
- Sunday/holiday treatment where applicable
- Adjustments, if introduced later
- Final calculated amount

Overtime is accumulated into the salary-period record as daily overtime is recorded.

Example:

`Today's OT: 2h → calculate OT amount → add to current salary period → salary slip shows accumulated OT.`

---

## 9. Attendance Model

Daily attendance states:

- Present
- Absent
- Leave

Attendance should be date-based and idempotent: one effective attendance result per worker per date unless the product explicitly supports revisions.

### No automatic salary deduction assumption

Do not automatically deduct salary merely because a worker is absent unless a future, explicit salary policy supports that rule. Attendance and salary calculation must remain separate enough to support different employer policies.

---

## 10. Saturday → Sunday Rule

A special weekend rule is required.

### Saturday Present

If Saturday is recorded as Present:

`Saturday Present → Sunday Present automatically`

Sunday does not require another manual attendance action under this rule.

### Saturday Leave

If Saturday is Leave, Work Social must **not silently assume** Sunday is Leave.

Instead, generate a Sunday confirmation notification:

> Saturday was marked as leave. Should Sunday also be counted as leave?

Actions:

- Yes → Sunday = Leave
- No → Sunday = Present

The exact treatment when Saturday is Absent remains an open business-rule decision and must be finalized before implementation.

---

## 11. Sunday Paid + Sunday Worked

Sunday can be a normal paid off-day when `Sunday Paid = Yes`.

This does not mean every Sunday automatically generates overtime.

If the worker actually works on Sunday:

- Normal Sunday policy remains applicable.
- Worker manually enters actual overtime hours.
- Overtime amount uses the selected overtime type.

Example:

`Sunday Paid = Yes + Sunday Worked + OT = 2h → calculate 2h using saved OT multiplier.`

No automatic overtime should be generated merely because the calendar date is Sunday.

---

## 12. Holiday Rule

If `Holidays Paid = Yes`, applicable holidays are paid according to the finalized calendar/policy.

If `Holidays Paid = No`, they are not treated as paid holidays.

The holiday source/calendar, timezone, country/region configuration, and treatment of a worker who actually works on a holiday are **open decisions** and must be frozen before implementation.

---

## 13. Attendance Notification Lifecycle

Attendance notifications are intended to make daily attendance reliable without creating infinite notification spam.

### Daily notification

If required attendance has not been recorded, create an attendance notification with actions:

- Present
- Absent
- Leave

### Reaction/action lifecycle

A notification is considered completed when the user takes an attendance action.

`Action → attendance saved → notification expires/completes`

Reading alone does not complete the notification.

### Read but no action

`Read + no action = still pending`

### Unread/no action reminder cycle

If the user does not take action, reminders continue up to a maximum of 15 attendance notifications for the pending cycle.

Conceptually:

`#1 → #2 → ... → #15`

After the 15-notification cycle is exhausted:

- The 15 notification records remain in notification history.
- New attendance notifications are switched off for that user/cycle.
- The notification system enters the agreed paused/vacation-like state.
- The system must not continue generating unlimited reminders.

The exact reset condition for this paused state is an open implementation/business decision and must be frozen before coding.

### Important terminology

The word **“vacation”** here is a notification-system pause state, not necessarily employee vacation/leave.

---

## 14. Notification Action Semantics

Attendance actions must be explicit and auditable.

Recommended event model:

`notification_created → notification_seen/read (optional) → attendance_action → notification_completed`

A notification should not disappear simply because it was opened.

The system should retain enough metadata to explain why a reminder was generated and whether an action was applied.

---

## 15. Salary Calculation Architecture

Recommended conceptual separation:

```text
Salary Policy
   ├── salary amount
   ├── salary type
   ├── working hours
   ├── overtime multiplier
   ├── Sunday paid policy
   └── holiday paid policy
          ↓
Attendance + Overtime Events
          ↓
Calculation Engine
          ↓
Salary Period Ledger
          ↓
Salary Slip
```

The calculation engine should be deterministic and testable independently of UI.

UI components must not contain the authoritative salary formulas.

---

## 16. Recommended Code Separation

Implementation should use separate modules/files by responsibility rather than one large component.

Suggested boundaries (exact paths may be adjusted after repository inspection):

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
    SalaryDashboardPage.tsx        # NOT DESIGNED YET
    SalarySlipPage.tsx
  components/
    SalarySetupForm.tsx
    SalaryPrivacyNotice.tsx
    SalarySetupSavedDialog.tsx
    SalaryAttendanceEntry.tsx
    SalaryOvertimeEntry.tsx
```

These are architectural targets, not permission to create these files yet.

---

## 17. Data Model Direction

The existing `worker_profiles` remains the Worker identity anchor.

Salary Person should add a dedicated salary/employment policy model rather than overloading contract `work_entries` with salary semantics.

Conceptual entities:

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

Potential policy fields:

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
- multiplier snapshot or policy reference as appropriate
- calculated_amount
- note
- created_at
- updated_at

Final schema must be designed against the actual repository schema and Supabase/RLS conventions before migration creation.

---

## 18. Historical Integrity

Salary calculations should not unexpectedly change historical salary slips when a user edits their current salary policy.

Recommended principle:

> A finalized salary period must retain the policy values required to explain its calculation.

At minimum, the implementation must decide whether historical periods reference the effective policy version or snapshot the relevant rates/inputs.

Do not retroactively recalculate closed salary periods merely because current settings changed.

---

## 19. Security / RLS Requirements

Salary data is private user/work data.

Required principles:

- Authenticated user can access only their own salary policy and salary records unless a future authorized employer/team model explicitly grants access.
- RLS must be based on the user's Worker profile ownership.
- No salary amount should be exposed through Social public profile APIs.
- No salary information should be sent to social/feed/activity surfaces unless explicitly designed and authorized.
- Server/database calculations should enforce ownership rather than trusting client-supplied worker IDs.

Existing Worker RLS/ownership patterns should be reused after inspection.

---

## 20. Validation Requirements

Salary Setup:

- Salary amount must be positive.
- Currency must be valid.
- Salary type must be one of the four supported values.
- Working hours, if supplied, must be a supported positive value.
- Overtime multiplier must be one of 1.0, 1.5, 2.0.
- Sunday/holiday values must be explicit booleans.
- Effective/start date must be valid.

Daily entry:

- Attendance date must be valid.
- Only supported attendance statuses are accepted.
- Overtime hours cannot be negative.
- Overtime precision must be defined (for example quarter-hour or minute precision) before implementation.

---

## 21. Edge Cases To Resolve Before Coding

The following are intentionally **not silently decided** in this blueprint:

1. Exact daily-rate denominator for Monthly salary.
2. Exact weekly-to-daily conversion for Weekly salary.
3. Exact 15-day salary calculation basis.
4. Whether Daily/Weekly/15-Day salary can have non-working days and how those are represented.
5. Whether absence reduces salary and under which explicit policy.
6. Whether Leave is paid, unpaid, or configurable.
7. What happens when Saturday is Absent rather than Leave.
8. Holiday calendar source and timezone.
9. Whether a holiday worked by the employee creates ordinary hours, overtime, or a special multiplier.
10. Whether Sunday/holiday work is represented by attendance, overtime, or both.
11. Exact notification reset condition after the 15-reminder pause.
12. Notification generation timezone/cutoff.
13. Overtime precision and maximum daily hours.
14. Salary policy editing and historical versioning.
15. Salary-period closing/finalization rules.
16. Rounding precision and rounding stage for currency.
17. Currency conversion is out of scope unless explicitly added.

These are blockers for a mathematically authoritative implementation, not reasons to alter the current Contract system.

---

## 22. Dashboard Status — INTENTIONALLY UNDECIDED

**Do not implement or freeze the Salary Person dashboard yet.**

The dashboard layout, cards, KPIs, charts, period selector, salary breakdown, attendance presentation, and salary-slip navigation have **not been decided**.

This blueprint must therefore treat the dashboard as a future design phase.

The calculation engine and data model should expose clean data that can support multiple dashboard designs later.

Do not allow dashboard assumptions to leak into the core formula engine.

---

## 23. Implementation Sequence

Recommended implementation order:

### Phase A — Formula specification

1. Freeze salary-type formulas.
2. Freeze working-day/calendar basis.
3. Freeze absence/leave policy.
4. Freeze Sunday/holiday behavior.
5. Freeze overtime formula and rounding.
6. Freeze notification reset semantics.

### Phase B — Data foundation

7. Design salary policy schema.
8. Design attendance schema.
9. Design overtime schema.
10. Design salary period/slip representation.
11. Add RLS and ownership policies.

### Phase C — Pure calculation logic

12. Implement salary-period calculations.
13. Implement hourly-rate calculation.
14. Implement overtime calculation.
15. Implement attendance/payability rules.
16. Implement Sunday/holiday rules.
17. Add deterministic unit tests.

### Phase D — Setup UX

18. Add Salary Person selection.
19. Add privacy notice.
20. Add Salary Setup Form.
21. Persist policy.
22. Add saved confirmation dialog.

### Phase E — Daily workflow

23. Add Salary New Entry.
24. Add attendance action handling.
25. Add overtime entry.
26. Add Saturday/Sunday confirmation flow.

### Phase F — Notifications

27. Add daily attendance notification.
28. Add read/action semantics.
29. Add 15-notification cap.
30. Add paused/vacation-like state.
31. Add reset behavior after the final policy decision.

### Phase G — Salary Slip

32. Build salary-period aggregation.
33. Build salary slip data.
34. Verify overtime accumulation.
35. Verify historical integrity.

### Phase H — Dashboard

36. **STOP and design dashboard separately.**
37. Only after dashboard UX is approved, implement dashboard UI against the already-defined calculation/data APIs.

---

## 24. Testing Matrix

At minimum, automated tests should cover:

### Salary types

- Daily salary.
- Weekly salary.
- 15-day salary.
- Monthly salary.

### Working hours

- 8h.
- 12h.
- Missing working hours.

### Overtime

- 1×.
- 1.5×.
- 2×.
- 0 hours.
- fractional hours once precision is finalized.

### Attendance

- Present.
- Absent.
- Leave.
- Duplicate same-day entry.
- Corrected attendance.

### Sunday

- Sunday paid + normal off.
- Sunday unpaid + normal off.
- Sunday worked + manually entered overtime.
- Saturday Present → Sunday Present.
- Saturday Leave → confirmation → Sunday Leave.
- Saturday Leave → confirmation → Sunday Present.

### Holidays

- Paid holiday.
- Unpaid holiday.
- Holiday work behavior after rule is finalized.

### Notifications

- No attendance → notification.
- Read only → remains pending.
- Action → notification completes/expires.
- 15 reminders → no further new reminders.
- Existing 15 remain in history.
- Pause/reset behavior after final rule is frozen.

### Security

- User A cannot read User B's salary policy.
- User A cannot read User B's attendance.
- User A cannot read User B's overtime.
- Public Social profile does not expose salary data.

### Regression

- Existing Contract Worker creation works.
- Existing Contract Work Entry works.
- Existing Contract Finance works.
- Existing Worker identity remains intact.
- Offline AI unchanged.
- Online AI unchanged.

---

## 25. Non-Goals

This phase does **not** define or implement:

- Employer payroll administration.
- Tax calculation.
- Government deductions.
- Benefits administration.
- Bank payment execution.
- Currency conversion.
- Employer-side access to employee salary data.
- Team payroll.
- Advanced HR management.
- Final Salary Person dashboard design.
- Changes to Contract Worker calculations.
- Changes to Offline AI or Online AI.

These may be future phases.

---

## 26. Definition of Done

Salary Person is not considered complete until:

- User can select Salary Person.
- Privacy notice appears before setup.
- Salary Setup can be completed once and persisted.
- Saved policy drives calculations without repeated policy questions.
- Daily attendance can be recorded.
- Overtime can be manually recorded and calculated.
- Overtime appears correctly in the salary slip.
- Sunday paid/off behavior follows saved policy.
- Sunday work does not automatically create overtime.
- Saturday/Sunday special rule works exactly as approved.
- Holiday policy follows the approved calendar/rules.
- Attendance notification lifecycle respects action/read/15-reminder behavior.
- Salary calculations are deterministic and tested.
- Historical salary records remain explainable after policy changes.
- RLS protects all salary data.
- Contract Worker behavior is unchanged.
- Dashboard is implemented only after its separate UX is approved.

---

## 27. Current Design Freeze

### Frozen

- Salary Person is a separate work mode from Work on Contract.
- One-time Salary Setup Form.
- Salary amount + four salary types.
- Optional 8h/12h working hours.
- OT multiplier choices: 1× / 1.5× / 2×.
- Sunday Paid Yes/No.
- Holidays Paid Yes/No.
- Daily attendance: Present / Absent / Leave.
- Manual overtime entry.
- Overtime flows into salary slip.
- Sunday paid-off does not automatically mean Sunday overtime.
- Sunday work requires manual OT entry.
- Saturday Present → Sunday Present automatically.
- Saturday Leave → Sunday confirmation.
- Notification action completes/expires the notification.
- Read without action does not complete it.
- Maximum 15 reminder notifications in the pending cycle.
- After 15, new attendance notifications stop and the 15 remain in history.
- Dashboard is **not yet decided**.

### Not Frozen

All formula/calendar/rounding/history questions listed in Section 21 remain open until explicitly decided.

---

## 28. Golden Rule for Implementation

**Do not code from assumptions.**

Before each implementation phase, compare the proposed code against this blueprint. If a formula or policy is not frozen here, stop and resolve it before writing production calculation logic.

The core engine must remain independent from the UI so that the eventual Salary Person dashboard can be designed later without changing salary mathematics.
