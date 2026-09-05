# Work Social — Salary Person End-to-End Blueprint

**Status:** Design / formula discussion — NOT implementation-ready until open decisions are explicitly frozen.

**Scope:** Salary Person mode only. Existing Work per Job / Contract behavior must remain unchanged. Offline/Online AI is completely out of scope.

## 1. Existing Entry Point — Work Identity / Worker Settings

The Salary Person journey starts from the existing Work Identity / Worker Settings page.

```text
Worker Settings
    ↓
Work Identity
    ↓
Existing Worker Identity form
    ↓
Worker Type
       /       \
Salary Person   Work per Job / Contract
```

Add a clear Worker Type selector/switch to the existing Work Identity form:

- Salary Person
- Work per Job / Contract

Selecting Work per Job / Contract keeps the existing contract/piece-work system unchanged. Selecting Salary Person starts the Salary Person activation flow. Switching modes must not delete or silently rewrite historical records.

## 2. Product Goal

Salary Person adds a salary-based work model beside the existing contract/piece-work model.

**Configure once, calculate automatically thereafter.**

The saved Salary Policy drives attendance, overtime, salary-period calculation, salary slips, and salary-related notifications.

## 3. Pre-Form Salary Data Caution / Privacy Notice

Before Salary Setup opens, show an informational salary-data caution. It must not promise security/privacy guarantees beyond the actual implementation; database authorization and RLS remain mandatory.

Suggested copy:

> ### Your Salary Data Is Private
>
> Your salary information is used only to maintain your personal salary, attendance, and overtime records in Work Social.
>
> We do not use your salary data for public display or social sharing. It helps Work Social provide you with a clear, organized, and accurate record of your work and salary information.
>
> Please review your salary details carefully before continuing.

Action: **Continue to Salary Setup**.

## 4. One-Time Salary Setup Form

### 4.1 Salary

- Salary Amount
- Currency

### 4.2 Salary Type

- Daily
- Weekly
- 15 Days
- Monthly

The exact mathematical conversion between salary types must be frozen before implementation.

### 4.3 Working Hours

- 8 hours
- 12 hours
- Optional / not set

If omitted, the system must not invent an hourly basis for overtime.

### 4.4 Overtime Type

- Same as salary — 1.0×
- 1.5×
- 2.0×

### 4.5 Sunday Paid?

- Yes
- No

A normal Sunday off may be paid according to the saved policy. If the worker actually works Sunday, Sunday itself does not automatically create overtime; actual overtime is entered manually.

### 4.6 Holidays Paid?

- Yes
- No

Holiday calendar/source and holiday-work treatment remain open until explicitly frozen.

### 4.7 Attendance Notification Time

**When do you want to get attendance notification?**

- Time picker: 00:00 through 23:59
- No attendance notification

The selected time is the worker's requested daily attendance-notification trigger time and must use the worker's applicable/local timezone rather than a universal hard-coded 9:00 AM.

If disabled, no attendance reminder cycle is generated. Manual attendance, overtime, salary calculation, and Pay Date notifications remain available.

### 4.8 Pay Date — Notification Only

Optional Pay Date:

> Select your expected salary payment date. Purpose: only to notify you about your payment day.

If configured, the Notification Generator may create a payment-day notification. This is **not** payment confirmation, payroll processing, bank integration, or proof that money was received.

The exact Pay Date representation for Daily/Weekly/15-Day/Monthly salary frequencies remains open.

### 4.9 Salary Start Date

Recommended for salary-period boundaries and historical accuracy. Exact semantics remain open until explicitly finalized.

### 4.10 Additional Salary Rules — Optional / Expandable

The Salary Setup form must contain an **optional expandable section** for detailed salary-structure and employer-specific rules.

Collapsed state:

**＋ Additional Salary Rules (Optional)**

Clicking it opens structured fields. The user may fill only what applies and may skip the entire section.

The section should support, at minimum:

- **Total Salary**
- **Basic Salary**
- **Attendance Allowance**
- **Other Allowance** — optional
- **Absent Rule**
- **Salary deduction per absent day**
- **Allowance-loss rule**
- **Allowance loss after how many absences**
- **Leave treatment**
- **Other salary rule / note**

Example record:

```text
Total Salary:              Rs. 150,000
Basic Salary:              Rs. 145,000
Attendance Allowance:      Rs.   5,000
Allowance loss threshold:  3 absences
Absence deduction:         1 day's salary per absence
```

This is intentionally configurable rather than hard-coded. Some salary arrangements include an attendance allowance inside the stated total salary; others have separate basic and allowance components. The system must record these components separately so the resulting salary calculation remains explainable.

**Important distinction:** absence salary deduction and attendance-allowance loss are separate policy components. For example, one absence may cause a one-day salary deduction while the attendance allowance may remain eligible until a configured absence threshold is reached. Approved Leave must not automatically be treated as Absent unless the finalized leave policy explicitly says so.

The optional section is for both record-keeping and calculation policy. Blank fields mean the corresponding special rule is not configured; the system must not invent a rule.

## 5. Saved Salary Policy

After successful setup, the form values become a structured Salary Policy:

```text
Salary Policy
 ├─ total/base salary amount
 ├─ currency
 ├─ salary type
 ├─ working hours
 ├─ overtime multiplier
 ├─ Sunday paid
 ├─ holidays paid
 ├─ attendance notification time / disabled
 ├─ pay date / payment notification preference
 ├─ effective/start date
 └─ optional additional salary rules
      ├─ basic salary
      ├─ attendance allowance
      ├─ other allowance
      ├─ absence rule
      ├─ absence deduction
      ├─ allowance-loss rule/threshold
      ├─ leave treatment
      └─ custom rule/note
```

Policy changes must not silently rewrite closed historical salary periods. Historical calculations must retain enough policy information/snapshot/version information to remain explainable.

## 6. Post-Save Confirmation

After successful setup, show:

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

## 7. Salary Person Work House Mode / Daily Entry

Daily Salary Person entry is salary-oriented rather than piece-work-oriented:

- Date
- Attendance: Present / Absent / Leave
- Overtime hours
- Optional note

Piece/size/quantity/rate are not required as the primary earning input.

Sunday and holiday policy comes from the saved Salary Policy. Attendance reminders are separate from manual attendance and overtime entry.

## 8. Attendance Model

Supported states:

- Present
- Absent
- Leave

Attendance should be date-based and idempotent: one effective attendance result per worker/date unless a future revision rule is explicitly approved.

### Absence and allowance policy

The optional Additional Salary Rules section may define:

- whether absence causes a daily salary deduction;
- the applicable daily deduction basis;
- whether attendance allowance is affected by absence;
- whether allowance is lost after any absence or after a configured number of absences;
- whether allowance loss is full or partial;
- how Leave affects salary/allowance.

These rules are **not hard-coded** until the exact policy is frozen. Attendance-allowance loss and daily absence deduction must remain separate calculations.

## 9. Saturday → Sunday Rule

### Saturday Present

Saturday Present → Sunday Present automatically.

### Saturday Leave

If Saturday is Leave, show:

> Saturday was marked as leave. Should Sunday also be counted as leave?

- Yes → Sunday Leave
- No → Sunday Present

### Saturday Absent

Behavior remains open and must be frozen before implementation.

## 10. Sunday Paid + Sunday Worked

If Sunday Paid = Yes, a normal Sunday off is paid according to the policy.

If the worker actually works Sunday:

- Sunday paid-off status and overtime remain separate.
- Sunday alone does not automatically create overtime.
- Actual overtime hours are entered manually.
- The saved OT multiplier is applied.

## 11. Holiday Rule

The setup contains Holidays Paid = Yes/No.

Before implementation, freeze:

- holiday calendar/source;
- country/region;
- timezone;
- automatic holiday recognition;
- holiday-work treatment;
- whether holiday work receives overtime/premium treatment.

## 12. Overtime Calculation

Conceptually:

`Overtime Amount = Hourly Rate × Overtime Multiplier × Overtime Hours`

`Hourly Rate = Daily Rate ÷ Working Hours Per Day`

Daily Rate must be derived from the selected salary type using finalized salary-period rules.

The exact Daily/Weekly/15-Day/Monthly conversion is not yet frozen. Monthly denominator and working-day/calendar basis must not be guessed.

Use deterministic numeric/Decimal handling rather than JavaScript floating-point arithmetic for persisted financial totals.

Daily overtime accumulates into the active salary period.

## 13. Salary Period and Salary Slip

Minimum explainable components:

- Salary period
- Base salary
- Basic salary, where configured
- Attendance allowance, where configured
- Other allowance, where configured
- Attendance summary
- Paid/applicable days
- Leave/absence information
- Absence deductions, where applicable
- Allowance adjustments, where applicable
- Overtime hours
- Overtime amount
- Sunday treatment
- Holiday treatment
- Final calculated amount

Historical salary slips must remain explainable after later policy changes.

## 14. Central Notification Generator

Existing Friend Request, Comment, and Reaction notifications are already working and remain unchanged.

A new dedicated Notification Generator handles automatic/system-generated Salary Person notifications:

```text
Existing Notification System
├── Friend Request  → unchanged
├── Comment         → unchanged
├── Reaction        → unchanged
└── Notification Generator
    ├── Attendance notifications
    └── Payment-day notifications
```

The generator decides when an automatic notification is due and creates it through the existing notification infrastructure. It must not contain salary formulas, replace existing social notification logic, or become the attendance data store.

### 14.1 Attendance trigger

Worker-configured time:

```text
00:00–23:59 selected time
        OR
No attendance notification
```

At the selected local/applicable time, check whether required attendance is already recorded. If yes, do not generate a reminder. If missing, generate the attendance notification.

### 14.2 Attendance notification actions

The notification appears through the existing notification UI and may also appear as a flash notice where supported.

Actions:

- Present
- Absent
- Leave

Reading/opening is not an action. The authoritative attendance operation is responsible for recording the selected state.

### 14.3 Fifteen-calendar-day action window

The agreed model is a **15-calendar-day action window**, not a maximum of 15 notifications.

The active attendance notification cycle remains actionable for up to 15 calendar days. Daily reminders may occur at the configured time during the active window, subject to idempotency and duplicate prevention.

Once the user chooses Present/Absent/Leave, the relevant attendance obligation is completed and further reminders for that obligation stop.

### 14.4 Cycle end

If no attendance action is taken during the complete 15-day window, the cycle closes automatically and exactly one dedicated cycle-end notification is generated.

It explains that the action window expired, previous notifications remain in history, the cycle is closed/paused, and the user can reset attendance notifications.

Action:

**Reset Attendance Notifications**

The cycle-end notification must not itself mark Present, Absent, or Leave.

### 14.5 Reset

Previous notification records remain in history. Reset is explicit and user-initiated.

```text
15-day window expires
        ↓
Cycle-end notification
        ↓
Cycle paused/closed
        ↓
User selects Reset Attendance Notifications
        ↓
Previous cycle retained as history
        ↓
New cycle activated
```

Reset must not delete notification history, rewrite historical attendance, or fabricate an attendance result.

### 14.6 No attendance notification mode

If disabled:

- no daily attendance reminder;
- no 15-day attendance cycle;
- no cycle-end notification for that disabled preference;
- manual attendance remains available;
- manual overtime remains available;
- salary calculation remains available;
- Pay Date notifications remain independently controlled.

### 14.7 Pay Date notification

If Pay Date is configured, generate a payment-day notification on the applicable date.

Example:

```text
Pay Date configured
      ↓
Payment date arrives
      ↓
"Today is your scheduled salary payment day."
```

Notification only. It is not payment confirmation, payment processing, bank integration, or proof of receipt.

### 14.8 Generator boundaries

Must:

- be authoritative for automatic notification generation;
- be idempotent;
- use applicable worker timezone;
- preserve notification history;
- distinguish notification state from attendance state;
- distinguish attendance reminders from payment-day reminders.

Must not:

- calculate salary;
- mark attendance without an explicit attendance action or separately approved automatic rule;
- alter Friend Request/Comment/Reaction behavior;
- delete notification history;
- expose salary amounts through public/social notification surfaces.

### 14.9 Scheduler

Backend-authoritative scheduling is required/recommended; frontend-only scheduling is not reliable. Exact backend scheduler, retry, locking, idempotency, and timezone implementation must be frozen against the actual repository/Supabase runtime before implementation.

## 15. Salary Calculation Architecture

```text
Salary Policy
   ↓
Attendance + Overtime Events
   ↓
Sunday/Holiday Rules
   ↓
Absence + Allowance Rules
   ↓
Calculation Engine
   ↓
Salary Period Ledger
   ↓
Salary Slip
```

The calculation engine must be deterministic and independently testable. UI components must not contain authoritative salary formulas.

## 16. Worker Type Changes and Historical Integrity

Worker Type is a business-state transition, not a destructive reset.

- Existing Contract records remain intact.
- Existing Salary records remain intact.
- Historical records retain their original work model.
- New salary policies do not retroactively rewrite finalized salary periods.
- Historical salary periods retain enough policy information to explain their results.

## 17. Data Model Direction

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

notification_generator
      ↓
existing notifications infrastructure
```

Potential Salary Policy fields:

- worker_profile_id
- salary_amount / total salary
- currency
- salary_type
- working_hours_per_day nullable
- overtime_multiplier
- sunday_paid
- holidays_paid
- attendance_notification_time nullable
- attendance_notifications_enabled
- pay_date / payment notification preference
- effective_from
- optional basic_salary
- optional attendance_allowance
- optional other_allowance
- optional absence_rule
- optional absence_deduction_rule
- optional allowance_loss_rule/threshold
- optional leave_rule
- optional custom salary-rule note
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
- multiplier/policy reference or snapshot
- calculated_amount
- note
- created_at
- updated_at

Automatic notification lifecycle fields, subject to the existing schema:

- notification type/category
- recipient
- related attendance date/obligation identifier
- cycle identifier
- cycle start/deadline
- action state
- reminder date/sequence where required
- generated_at
- completed_at/expired_at
- reset/cycle metadata

Final schema must be designed against the actual repository and Supabase/RLS conventions before migrations.

## 18. Security / RLS

Salary information is sensitive personal financial data.

- Worker can access only their own salary data unless a future authorized employer/team model grants access.
- RLS enforces ownership at the database layer.
- Client-supplied worker IDs are not trusted for authorization.
- Salary amounts are not exposed through public Social profile APIs.
- Salary data does not enter public/social activity surfaces unless separately designed and authorized.
- Notification-generator records obey the same ownership/privacy boundary.
- Payment-day notifications do not expose salary amounts unless separately approved.

## 19. Recommended Code Separation

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
    SalaryDashboardPage.tsx
  components/
    SalarySetupForm.tsx
    SalaryPrivacyNotice.tsx
    SalarySetupSavedDialog.tsx
    SalaryAttendanceEntry.tsx
    SalaryOvertimeEntry.tsx
```

These are architectural targets, not permission to create files before the design is frozen.

## 20. Dashboard Functional Requirement

The full visual design remains separate/deferred, but the following functional behavior is now specified:

- User gets a **Salary Card** on Dashboard.
- Default view is **This Month**.
- Clicking/tapping the Salary Card opens the detailed monthly salary/attendance view.
- The detail view includes at minimum:
  - Month / salary period
  - Attendance days
  - Present days
  - Absent days
  - Leave days
  - Overtime hours
  - Overtime amount
  - Base salary
  - Applicable adjustments
  - Final calculated salary
- A **Previous** button moves backward exactly one calendar month at a time.

Example:

```text
September 2026
      ↓ Previous
August 2026
      ↓ Previous
July 2026
      ↓ Previous
June 2026
      ↓ ...
```

This freezes the functional navigation behavior, not the visual layout, charts, colors, card styling, or complete Dashboard UX.

## 21. Validation Requirements

Salary Setup:

- salary amount positive when required;
- currency valid;
- salary type one of Daily/Weekly/15 Days/Monthly;
- working hours valid when supplied;
- overtime multiplier 1.0/1.5/2.0;
- Sunday/Holiday settings explicit;
- attendance notification either disabled or valid 00:00–23:59;
- Pay Date valid for selected frequency when configured;
- optional additional salary fields validated when supplied;
- basic + allowance components must be internally explainable against total salary when the user provides all of them;
- absence/allowance thresholds must be non-negative and semantically valid;
- start/effective date valid when required.

Daily entry:

- valid attendance date;
- Present/Absent/Leave only;
- overtime non-negative;
- overtime precision defined before implementation.

Notification generator:

- repeated scheduler runs cannot create duplicates;
- only eligible Salary Person users receive Salary Person attendance notifications;
- disabled attendance reminders create no attendance cycle;
- read does not complete;
- Present/Absent/Leave action completes the relevant obligation;
- action window is exactly 15 calendar days after final start/deadline semantics are frozen;
- exactly one cycle-end notification at expiry;
- notification history retained;
- reset explicit and starts a new cycle;
- Pay Date reminders only when configured;
- payment reminders never claim payment confirmation;
- existing Friend Request/Comment/Reaction notifications remain unchanged.

## 22. Edge Cases / Open Decisions

Do not silently decide these before coding:

1. Exact Daily-rate denominator for Monthly salary.
2. Weekly-to-daily conversion.
3. 15-Day salary calculation basis.
4. Working-day/calendar basis for each salary type.
5. Exact absence deduction calculation.
6. Paid/unpaid Leave policy.
7. Exact attendance-allowance loss behavior and threshold semantics.
8. Partial versus full allowance loss when a rule is configured.
9. Whether allowance is included inside Total Salary or represented as an additive component when both are entered.
10. Saturday Absent → Sunday behavior.
11. Holiday calendar/source/timezone.
12. Holiday work treatment.
13. Sunday/holiday work representation.
14. Overtime precision and maximum daily hours.
15. Salary-policy editing/versioning.
16. Salary-period closing/finalization.
17. Currency rounding precision and rounding stage.
18. Currency conversion, otherwise out of scope.
19. Exact Pay Date representation for each salary frequency.
20. Exact attendance-cycle start/deadline semantics.
21. Exact backend scheduler mechanism and retry/locking strategy.
22. Exact worker timezone source and timezone-change behavior.
23. Exact notification-state mapping onto existing notification schema.
24. Exact Worker Type switching UX.

The following direction is agreed: optional expandable Additional Salary Rules inside Salary Setup; configurable salary components; absence and allowance rules captured separately; configurable attendance notification time or disabled; 15-calendar-day attendance action window; cycle-end notification; history retention; explicit reset; Pay Date notification-only behavior; protected existing social notifications.

## 23. Implementation Sequence

### Phase A — Worker Type

1. Inspect existing Worker Settings → Work Identity.
2. Add Worker Type.
3. Persist Salary Person vs Work per Job / Contract without breaking Contract behavior.
4. Preserve historical records on switching.

### Phase B — Salary Setup UX

5. Add Salary Person activation flow.
6. Add salary-data caution.
7. Add one-time Salary Setup.
8. Add Attendance Notification Time / No attendance notification.
9. Add optional Pay Date.
10. Add optional expandable Additional Salary Rules.
11. Persist Salary Policy securely.
12. Add save confirmation.

### Phase C — Formula / Policy Freeze

13. Freeze salary-type formulas.
14. Freeze working-day/calendar basis.
15. Freeze absence and allowance rules.
16. Freeze leave policy.
17. Freeze Sunday/holiday behavior.
18. Freeze overtime formula, precision, and rounding.

### Phase D — Data / Calculation Foundation

19. Design salary-policy schema.
20. Design attendance schema.
21. Design overtime schema.
22. Design salary-period/slip representation.
23. Add RLS/ownership policies.
24. Implement deterministic calculation logic and tests.

### Phase E — Daily Salary Person Workflow

25. Add daily Salary Person entry.
26. Add attendance handling.
27. Add manual overtime.
28. Add Saturday/Sunday behavior after rules are frozen.
29. Add holiday behavior after rules are frozen.
30. Implement absence/allowance adjustments only after policy freeze.

### Phase F — Notification Generator

31. Inspect existing notification infrastructure.
32. Preserve Friend Request, Comment, Reaction producers unchanged.
33. Implement backend-authoritative configurable attendance trigger.
34. Implement No attendance notification mode.
35. Implement Present/Absent/Leave actions.
36. Implement 15-calendar-day action window.
37. Implement one cycle-end notification.
38. Retain notification history.
39. Implement explicit Reset Attendance Notifications/new-cycle activation.
40. Implement Pay Date notification-only generation.
41. Add idempotency, timezone, retry, and scheduler safeguards.

### Phase G — Salary Slip

42. Aggregate salary-period records.
43. Build explainable salary slips.
44. Verify overtime accumulation.
45. Verify historical policy integrity.

### Phase H — Dashboard

46. Implement the approved functional Salary Card flow: This Month default → monthly detail → Previous month navigation.
47. Keep visual Dashboard design independently scoped until explicitly approved.

## 24. Testing Matrix

### Worker Type

- Salary Person selection works from Work Identity.
- Contract selection preserves existing flow.
- Contract workers remain functional.
- Switching does not delete historical records.

### Salary Setup

- Salary amount/currency validation.
- Daily/Weekly/15 Days/Monthly.
- 8h/12h/unset working hours.
- 1×/1.5×/2× overtime.
- Sunday/Holiday settings.
- Attendance notification time and disabled mode.
- Pay Date notification-only semantics.
- Expand/collapse Additional Salary Rules.
- Optional Basic/Total/Allowance fields.
- Optional absence rule and allowance-loss threshold.
- Optional leave/custom rules.
- Internal consistency of supplied salary components.

### Daily Salary Person

- Present/Absent/Leave.
- Overtime entry.
- Optional note.
- Saved policy reused automatically.
- Contract quantity/rate fields not required.

### Sunday

- Sunday paid-off behavior.
- Sunday worked does not automatically create overtime.
- Manual Sunday overtime uses saved multiplier.
- Saturday Present → Sunday Present.
- Saturday Leave → confirmation → Sunday Leave/Present.

### Notifications

- Configured time triggers at applicable local time.
- Disabled mode produces no attendance notification.
- Missing attendance can produce reminder.
- Existing Friend Request/Comment/Reaction notifications remain unchanged.
- Flash/notification-box presentation works through existing infrastructure where supported.
- Read alone does not complete.
- Present/Absent/Leave records attendance and completes the obligation.
- Action works within 15-calendar-day window.
- Reminders stop after action.
- Exactly one cycle-end notification at expiry.
- History retained.
- Reset starts a new cycle without fabricating attendance or deleting history.
- Pay Date reminder generated only when configured.
- Payment reminder does not claim payment confirmation.
- Repeated scheduler execution produces no duplicates.
- Timezone and retry/locking boundaries tested.

### Salary Calculation

- All salary types.
- Overtime 1×/1.5×/2×.
- Missing working-hours behavior.
- Overtime accumulation.
- Absence deduction policy.
- Attendance allowance thresholds.
- Basic/allowance/total salary component handling.
- Leave treatment.
- Historical policy integrity.
- Deterministic currency arithmetic.

### Dashboard

- Salary Card exists for Salary Person.
- This Month is default.
- Card opens monthly detail.
- Attendance and salary details are shown.
- Previous moves exactly one calendar month backward.
- Repeated Previous navigation reaches older months correctly.

### Security

- User A cannot read User B's salary policy, attendance, overtime, or salary slip.
- Public Social profile does not expose salary data.
- Notification-generator records obey ownership/privacy boundaries.

### Regression

- Existing Contract work entry/finance unchanged.
- Existing Worker identity/provisioning unchanged.
- Friend Request notifications unchanged.
- Comment notifications unchanged.
- Reaction notifications unchanged.
- Offline AI unchanged.
- Online AI unchanged.

## 25. Non-Goals

This feature does not define or implement:

- employer payroll administration;
- tax calculation;
- government deductions;
- benefits administration;
- bank payment execution;
- currency conversion;
- employer-side access unless separately designed;
- team payroll;
- advanced HR management;
- changes to Contract Worker calculations;
- changes to existing Friend Request/Comment/Reaction notifications;
- Offline AI or Online AI changes.

## 26. Definition of Done

Salary Person is end-to-end only when the approved flow works:

```text
Existing Worker Settings
        ↓
Existing Work Identity
        ↓
Worker Type = Salary Person
        ↓
Salary Data Caution
        ↓
Salary Setup
        ↓
Optional Additional Salary Rules
        ↓
Saved Salary Policy
        ↓
Salary Person Work House
        ↓
Daily Attendance
        ↓
Manual Overtime
        ↓
Salary Period Calculation
        ↓
Explainable Salary Slip
        ↓
Dashboard Salary Card
        ↓
This Month → Monthly Detail → Previous Month
```

Notification journey:

```text
Configured Attendance Notification Time
        ↓
Attendance trigger
        ↓
Attendance missing?
   ┌────┴────┐
  NO        YES
  ↓          ↓
Nothing    Attendance notification
           + Present/Absent/Leave
              ↓
        Attendance recorded

No action for 15 calendar days
              ↓
       Cycle-end notification
              ↓
       User explicitly resets
              ↓
       New notification cycle
```

Payment reminder:

```text
Pay Date configured
        ↓
Payment date arrives
        ↓
Payment-day notification
        ↓
Notification only
```

At the same time:

```text
Worker Type = Work per Job / Contract
        ↓
Existing Contract Flow
        ↓
UNCHANGED
```

## 27. Current Design Freeze

### Frozen / Agreed Direction

- Salary Person starts from existing Work Identity / Worker Settings.
- Worker Type choices are Salary Person and Work per Job / Contract.
- Contract behavior remains unchanged.
- Salary Person uses one-time Salary Setup.
- Saved policy drives future calculations.
- Additional Salary Rules is an optional expandable section inside Salary Setup.
- The optional section can capture Total Salary, Basic Salary, Attendance Allowance, Other Allowance, Absent Rule, salary deduction, allowance-loss rule/threshold, Leave treatment, and custom notes.
- Users may skip the optional section or fill only applicable fields.
- Basic salary, allowance, absence deduction, and allowance-loss rules are separate policy components.
- Attendance allowance loss may be threshold-based; the threshold is configurable rather than hard-coded.
- Daily attendance entry is Present/Absent/Leave plus overtime.
- Sunday paid-off status and manually entered Sunday overtime are separate.
- Saturday Present → Sunday Present.
- Saturday Leave → Sunday confirmation.
- Attendance notification time is configurable 00:00–23:59 or disabled.
- Attendance notification is a reminder/action mechanism, not an attendance result.
- Actions are Present/Absent/Leave.
- Reading alone does not complete the obligation.
- Action window is 15 calendar days.
- Expiry produces one cycle-end notification.
- Previous notifications remain in history.
- Reset is explicit and starts a new cycle without deleting history or fabricating attendance.
- Pay Date is notification-only.
- Existing Friend Request, Comment, and Reaction notifications remain unchanged.
- Notification Generator is additive and backend-authoritative.
- Dashboard functional Salary Card behavior is frozen: This Month default, tap for monthly detail, Previous moves one month backward. Full visual Dashboard design remains separately deferred.
- AI remains out of scope.

### Open / Must Be Frozen Before Relevant Implementation

- Exact salary-type conversion formulas.
- Working-day/calendar basis.
- Absence/allowance/leave calculation semantics.
- Saturday Absent behavior.
- Holiday calendar and holiday-work behavior.
- Overtime precision/rounding.
- Salary Start Date semantics.
- Historical policy version/snapshot strategy.
- Exact Pay Date representation for each salary frequency.
- Exact attendance-cycle start/deadline semantics.
- Exact backend scheduler mechanism.
- Retry/locking/idempotency implementation against the actual runtime.
- Worker timezone source and timezone-change behavior.
- Mapping of generator state onto the existing notification schema.
- Exact Worker Type switching UX.

## 28. Golden Rule

**Do not code from assumptions.**

The authoritative journey is:

> **Existing Work Identity → Worker Type → Salary Person → Salary Setup → Optional Salary Rules → Daily Work → Notification/Attendance → Calculation → Salary Slip → Dashboard Monthly View**

The existing **Work per Job / Contract** path is the protected regression boundary.

The existing **Friend Request / Comment / Reaction notification system** is also a protected regression boundary.

The new Notification Generator is an automatic notification layer, not a replacement for the existing notification system and not a salary-calculation engine.