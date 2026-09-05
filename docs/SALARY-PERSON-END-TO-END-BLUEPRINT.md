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

### 5.7 Attendance Notification Time

Add an explicit notification preference:

**When do you want to get attendance notification?**

- Time picker: `00:00` through `23:59`
- `No attendance notification`

The selected time is the worker's requested daily attendance-notification trigger time. It must be interpreted in the worker's configured/local timezone rather than using a universal hard-coded 9:00 AM rule.

If `No attendance notification` is selected, the system must not generate daily attendance notifications for that worker. This does **not** disable attendance recording, overtime entry, salary calculation, or future payment-day notifications.

This option supports workers whose arrangement does not require daily attendance reminders, including possible 24-hour-duty or fixed/monthly-paid arrangements.

### 5.8 Pay Date — Notification Only

Add an optional **Pay Date** preference.

Product meaning:

> **Pay Date**  
> Select your expected salary payment date.  
> *Purpose: Only to notify you about your payment day.*

If Pay Date is configured, the Notification Generator may generate a payment-day notification on that configured date.

**Payment notification is not payment confirmation.** Work Social must not claim that salary has been paid, verify a payment, or execute a payment merely because a Pay Date is configured.

If Pay Date is not configured, no payment-day notification is generated.

The exact Pay Date representation must match the selected salary frequency before implementation (for example, monthly day-of-month versus a weekly/15-day payment-day model).

### 5.9 Salary Start Date

A Salary Start Date is recommended for salary-period boundaries and historical accuracy. Exact UI/semantic treatment remains open until explicitly finalized.

---

## 6. Saved Salary Policy

After successful setup, the form values become a structured **Salary Policy** used by future calculations and notification preferences.

```text
Salary Policy
 ├─ salary amount
 ├─ currency
 ├─ salary type
 ├─ working hours
 ├─ overtime multiplier
 ├─ Sunday paid
 ├─ holidays paid
 ├─ attendance notification time / disabled
 ├─ pay date / payment notification preference
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

Attendance notifications are a separate reminder mechanism; disabling them does not disable manual attendance or overtime entry.

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

## 15. Central Notification Generator

Work Social already has working notifications for **Friend Requests, Comments, and Reactions**. Those existing notification producers are not to be replaced or redesigned by the Salary Person feature.

The new component is a dedicated **Notification Generator** for automatic/system-generated notifications, beginning with Salary Person attendance and payment-day notifications.

```text
Existing Notification System
│
├── Friend Request        → existing behavior unchanged
├── Comment               → existing behavior unchanged
├── Reaction              → existing behavior unchanged
│
└── Notification Generator
      │
      ├── Attendance notifications
      └── Payment-day notifications
```

The generator's responsibility is to decide when an automatic notification is due and create it through the existing notification infrastructure. It must not contain salary formulas, replace existing social notification logic, or become the attendance data store.

### 15.1 Attendance notification trigger

The trigger time comes from the worker's Salary Policy:

```text
Attendance Notification Time
        ↓
00:00–23:59 selected time
        OR
No attendance notification
```

There is therefore **no hard-coded universal 9:00 AM requirement**. If a worker selects 09:00, the daily trigger is 09:00 in that worker's applicable timezone.

At the selected time, the generator checks whether the required attendance for the relevant date has already been recorded.

If attendance is already recorded, no attendance reminder is generated.

If attendance is missing, the generator creates the attendance notification.

### 15.2 Notification presentation and actions

The attendance notification should appear through the existing notification UI and may also use a visible/flash notice where supported.

Actions:

- **Present**
- **Absent**
- **Leave**

The action must route into the authoritative attendance operation.

**Reading is not an action.** Opening/reading a notification does not complete its attendance obligation.

```text
Attendance notification
        ↓
Read only
        ↓
Still actionable / pending

Attendance action
        ↓
Present / Absent / Leave
        ↓
Attendance recorded
        ↓
Notification/cycle action completed
```

### 15.3 Fifteen-day attendance action window

The agreed model is a **15-calendar-day action window**, not a maximum of 15 notifications.

A generated attendance notification/cycle remains actionable for up to 15 calendar days if the user does not take an attendance action.

During the active window, the generator may produce the configured daily reminder at the user's selected notification time. The implementation must prevent uncontrolled duplicate notifications for the same attendance obligation/day.

The worker can take the Present/Absent/Leave action during the window. Once the action is taken, the relevant attendance obligation is completed and further reminders for that obligation stop.

### 15.4 Cycle end

If the worker takes no attendance action during the complete 15-day window, the cycle ends automatically.

At cycle end, generate **one dedicated cycle-end notification** explaining why the attendance notification cycle ended and how the user can receive attendance notifications again.

Suggested content:

> ### Attendance Notification Cycle Ended
>
> Your attendance notification action window ended because no attendance action was taken within 15 days.
>
> Your previous attendance notifications remain in notification history.
>
> Attendance notifications for this cycle are now paused.
>
> To receive attendance notifications again, reset attendance notifications below.

Primary action:

**[ Reset Attendance Notifications ]**

The cycle-end notification itself is not an attendance result. It must not automatically mark the worker Present, Absent, or Leave.

### 15.5 Reset behavior

After 15 days, the previous notifications are retained in history. The reset trigger makes the attendance notification action available again for a **new notification cycle**.

```text
15-day window expires
        ↓
Cycle-end notification generated
        ↓
Attendance notification cycle paused
        ↓
User selects Reset Attendance Notifications
        ↓
Previous cycle remains historical
        ↓
New cycle activated
        ↓
Next configured attendance trigger can generate a new notification
```

Reset must be explicit/user-initiated. It must not silently delete notification history or rewrite historical attendance.

The reset action must not itself fabricate an attendance status.

### 15.6 No-attendance-notification mode

If the Salary Policy says `No attendance notification`:

- No daily attendance notification is generated.
- No 15-day attendance reminder cycle is created.
- No cycle-end notification is generated for that disabled preference.
- Manual attendance remains available.
- Manual overtime remains available.
- Salary calculation remains available.
- Payment-day notifications remain independently controlled by Pay Date.

This supports workers whose pay arrangement does not require daily attendance reminders, including possible 24-hour-duty or fixed/monthly-paid arrangements.

### 15.7 Pay Date notification

If Pay Date is configured, the generator creates a payment-day notification on the applicable payment date.

Example:

```text
Configured Pay Date
        ↓
Payment date arrives
        ↓
Payment-day notification
        ↓
"Today is your scheduled salary payment day."
```

This notification is **for notification only**. It is not payment confirmation, payroll processing, bank integration, or proof that money was received.

If Pay Date is absent, no payment-day notification is generated.

### 15.8 Notification generator boundaries

The generator must:

- be authoritative for automatic notification generation;
- be idempotent so repeated scheduler execution cannot create duplicates;
- use the worker's applicable timezone for scheduled times;
- preserve notification history;
- distinguish notification state from attendance state;
- distinguish attendance notifications from payment-day notifications;
- reuse the existing notification delivery/storage infrastructure where appropriate.

The generator must not:

- calculate salary;
- mark attendance without an explicit attendance action or separately approved automatic attendance rule;
- alter Friend Request, Comment, or Reaction notification behavior;
- delete notification history;
- expose salary amounts in public/social notification surfaces.

### 15.9 Scheduler recommendation

The generator should be **backend-authoritative**, with a scheduled backend trigger and frontend notification presentation/action handling.

The frontend must not be the only generator because browser/app-open state is not a reliable daily scheduler.

The exact backend scheduler mechanism, retry behavior, lock/idempotency strategy, and timezone implementation must be frozen against the repository's actual Supabase/runtime architecture before code is written.

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

notification_generator
      ↓
existing notifications infrastructure
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
- attendance_notification_time nullable
- attendance_notifications_enabled
- pay_date / payment_notification preference
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

Potential automatic-notification lifecycle fields, subject to actual existing notification schema:

- notification type/category
- worker/user recipient
- related attendance date or obligation identifier
- cycle identifier
- cycle start date/time
- action deadline/expiry date
- action state
- reminder sequence/date where required
- generated_at
- completed_at/expired_at
- reset/cycle metadata where required

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
- Notification-generator records containing salary-policy-derived metadata must obey the same ownership/privacy boundary.
- Payment-day notifications must not expose salary amounts unless separately approved.

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

The existing Friend Request, Comment, and Reaction notification producers remain outside the new Salary Person notification-generator scope.

---

## 21. Validation Requirements

Salary Setup:

- Salary amount must be positive.
- Currency must be valid.
- Salary type must be one of the four supported values.
- Working hours, when supplied, must be valid.
- Overtime multiplier must be 1.0, 1.5, or 2.0.
- Sunday/holiday settings must be explicit booleans.
- Attendance notification time must be either disabled or a valid `00:00–23:59` time.
- Pay Date must be valid for the selected salary frequency when configured.
- Start/effective date must be valid when required.

Daily entry:

- Attendance date must be valid.
- Status must be Present, Absent, or Leave.
- Overtime cannot be negative.
- Overtime precision must be defined before implementation.

Notification generator:

- Re-running the scheduler must not create duplicate notifications for the same obligation/time window.
- Only eligible Salary Person workers receive Salary Person attendance notifications.
- Disabled attendance notifications produce no attendance reminder.
- Reading does not complete an attendance obligation.
- Present/Absent/Leave action completes the relevant obligation.
- The active action window is exactly 15 calendar days after its defined start/deadline semantics are frozen.
- Exactly one cycle-end notification is produced when the active cycle expires.
- Previous notification history remains intact.
- Reset is explicit and starts a new cycle without fabricating attendance.
- Pay Date notifications are generated only when configured.
- Payment notifications never claim payment confirmation.
- Existing Friend Request, Comment, and Reaction notifications remain unchanged.

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
11. Overtime precision and maximum daily hours.
12. Salary-policy editing/versioning.
13. Salary-period closing/finalization.
14. Currency rounding precision and rounding stage.
15. Currency conversion, which is otherwise out of scope.
16. Exact Pay Date representation for each salary frequency.
17. Exact attendance-cycle start/deadline semantics for the 15-calendar-day window.
18. Exact backend scheduler mechanism and retry/locking strategy.
19. Exact timezone source/configuration for each worker.
20. Exact notification-state fields/mapping onto the existing notification schema.

The following notification behavior is now agreed direction rather than an open product concept: configurable daily trigger time, optional no-notification mode, 15-calendar-day action window, one cycle-end notification, history retention, explicit reset, and Pay Date notification-only behavior.

These remaining items are blockers for authoritative implementation details, not reasons to alter the existing Contract system.

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
8. Add Attendance Notification Time with `00:00–23:59` or `No attendance notification`.
9. Add optional Pay Date with notification-only semantics.
10. Persist Salary Policy securely.
11. Add successful-save confirmation.

### Phase C — Formula and policy freeze

12. Freeze salary-type formulas.
13. Freeze working-day/calendar basis.
14. Freeze absence/leave policy.
15. Freeze Sunday/holiday behavior.
16. Freeze overtime formula, precision, and rounding.

### Phase D — Data/calculation foundation

17. Design salary policy schema.
18. Design attendance schema.
19. Design overtime schema.
20. Design salary-period/slip representation.
21. Add RLS/ownership policies.
22. Implement deterministic calculation logic and tests.

### Phase E — Daily Salary Person workflow

23. Add Salary Person daily entry.
24. Add attendance handling.
25. Add manual overtime entry.
26. Add Saturday/Sunday behavior after rules are frozen.
27. Add holiday behavior after rules are frozen.

### Phase F — Notification Generator

28. Implement backend-authoritative Notification Generator only after repository inspection of the existing notification infrastructure.
29. Preserve existing Friend Request, Comment, and Reaction producers unchanged.
30. Implement configurable attendance trigger time.
31. Implement `No attendance notification` mode.
32. Implement attendance action semantics: Present / Absent / Leave.
33. Implement 15-calendar-day action window.
34. Implement one cycle-end notification at expiry.
35. Retain all historical notifications.
36. Implement explicit Reset Attendance Notifications action and new-cycle activation.
37. Implement Pay Date notification-only generation.
38. Add idempotency, timezone handling, retries, and scheduler safeguards.
39. Verify the generator cannot mark attendance or payment as completed without the appropriate authoritative action.

### Phase G — Salary Slip

40. Aggregate salary-period records.
41. Build explainable salary slips.
42. Verify overtime accumulation.
43. Verify historical policy integrity.

### Phase H — Dashboard

44. **STOP and design the Dashboard separately.**
45. Implement it only after its UX is explicitly approved.

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
- Attendance notification time validation.
- No attendance notification mode.
- Pay Date validation and notification-only semantics.
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

- Configured attendance time triggers the generator at the worker's applicable local time.
- `No attendance notification` produces no attendance notification.
- Missing attendance can produce the daily notification.
- Existing Friend Request, Comment, and Reaction notifications continue to work unchanged.
- Flash notice/notification-box presentation is available through the existing UI infrastructure where supported.
- Read alone does not complete the attendance obligation.
- Present / Absent / Leave action records attendance and completes the relevant notification/cycle action.
- Action can be taken within the 15-calendar-day window.
- Reminder generation stops after the action is taken.
- Exactly one cycle-end notification is generated when the 15-day window expires without action.
- Previous notification history remains visible/retained.
- Reset action activates a new attendance-notification cycle.
- Reset does not fabricate attendance or delete history.
- Pay Date notification is generated only when configured.
- Payment notification does not claim payment confirmation.
- Repeated scheduler execution does not create duplicates.
- Timezone boundaries are tested.
- Retry/locking behavior is tested.

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
- Notification-generator records obey ownership/privacy boundaries.

### Regression

- Existing Contract work entry remains unchanged.
- Existing Contract finance remains unchanged.
- Existing Worker identity remains intact.
- Worker provisioning remains unchanged.
- Existing Friend Request notifications remain unchanged.
- Existing Comment notifications remain unchanged.
- Existing Reaction notifications remain unchanged.
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
- Changes to existing Friend Request, Comment, or Reaction notification behavior.
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

Notification journey:

```text
Saved Attendance Notification Time
        ↓
Configured daily trigger
        ↓
Attendance missing?
   ┌────┴────┐
  NO        YES
  ↓          ↓
Nothing    Attendance notification
           + action options
              ↓
       Present / Absent / Leave
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

Payment reminder journey:

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
- Attendance notification time is user-configurable from `00:00–23:59` or can be disabled with `No attendance notification`.
- Attendance notification is a reminder/action mechanism and does not itself mark attendance.
- Attendance notification action options are Present / Absent / Leave.
- Reading alone does not complete the attendance obligation.
- Attendance action completes the relevant notification/cycle obligation.
- The attendance action window is 15 calendar days.
- If the 15-day window expires without action, one cycle-end notification is generated.
- Previous notifications remain in history.
- The cycle enters a paused state until the user explicitly selects Reset Attendance Notifications.
- Reset starts a new attendance notification cycle and does not fabricate attendance or delete history.
- Pay Date is optional and exists for notification-only payment-day reminders.
- Pay Date notification is not payment confirmation or payment processing.
- Existing Friend Request, Comment, and Reaction notifications are already working and remain unchanged.
- The new Notification Generator is for automatic/system-generated notifications and is separate from existing social notification producers.
- Backend-authoritative scheduling is the recommended generator architecture.
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
- Exact Pay Date representation for each salary frequency.
- Exact attendance-cycle start/deadline semantics.
- Exact backend scheduler mechanism.
- Retry/locking/idempotency implementation against the actual runtime.
- Worker timezone source and timezone-change behavior.
- Mapping of the new generator state onto the existing notification schema.
- Exact Worker Type switching UX.

---

## 29. Golden Rule

**Do not code from assumptions.**

The authoritative product journey begins here:

> **Existing Work Identity → Worker Type → Salary Person → Salary Setup → Daily Work → Notification/Attendance → Calculation → Salary Slip**

The existing **Work per Job / Contract** path is the protected regression boundary.

The existing **Friend Request / Comment / Reaction notification system** is also a protected regression boundary.

The new Notification Generator is an automatic notification layer, not a replacement for the existing notification system and not a salary-calculation engine.