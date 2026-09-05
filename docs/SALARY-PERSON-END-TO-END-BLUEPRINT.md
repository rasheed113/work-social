# Work Social — Salary Person End-to-End Blueprint

**Status:** End-to-End Blueprint Completed / Product Design Frozen

**Scope:** Salary Person mode only. Existing Work per Job / Contract behavior remains unchanged. Offline/Online AI is completely out of scope.

## 1. Authoritative End-to-End Journey

```text
Existing Worker Settings
        ↓
Existing Work Identity
        ↓
Worker Type
   ┌────┴──────────────────────┐
Salary Person        Work per Job / Contract
   ↓                            ↓
Salary Data Caution      Existing Contract Flow
   ↓                            ↓
Salary Setup                  UNCHANGED
   ↓
Optional Additional Salary Rules
   ↓
Saved Salary Policy
   ↓
Salary Person Work House
   ↓
Daily Attendance + Overtime
   ↓
Bonus Records / Policy
   ↓
Salary Calculation
   ↓
Salary Period / Salary Slip
   ↓
Salary Person Dashboard
   ↓
Current Month + Grand Salary + Attendance + OT + Bonus + History
```

This document is the authoritative product/design blueprint for the Salary Person feature.

## 2. Worker Type

The existing Work Identity / Worker Settings flow gains a Worker Type selector:

- Salary Person
- Work per Job / Contract

Selecting Contract preserves the existing contract/piece-work system. Selecting Salary Person starts the salary flow.

Changing Worker Type is non-destructive. Historical Salary and Contract records remain intact and are never silently rewritten.

## 3. Salary Data Caution

Before Salary Setup:

> ### Your Salary Data Is Private
>
> Your salary information is used only to maintain your personal salary, attendance, overtime, bonus, and salary records in Work Social.
>
> We do not use your salary data for public display or social sharing. It helps Work Social provide you with a clear, organized, and accurate record of your work and salary information.
>
> Please review your salary details carefully before continuing.

Action: **Continue to Salary Setup**.

The UI wording must not promise privacy/security guarantees beyond the actual database authorization and RLS implementation.

## 4. One-Time Salary Setup

### 4.1 Salary

- Salary Amount
- Currency

### 4.2 Salary Type

- Daily
- Weekly
- 15 Days
- Monthly

### 4.3 Working Hours

- 8 hours
- 12 hours
- Optional / not set

If working hours are not configured, the system must not invent an hourly overtime basis.

### 4.4 Overtime Type

- Same as salary — 1.0×
- 1.5×
- 2.0×

### 4.5 Sunday Paid

- Yes
- No

A normal Sunday off follows the saved policy. Working Sunday does not automatically create overtime; actual overtime is entered manually.

### 4.6 Holidays Paid

- Yes
- No

Holiday calendar, timezone, and holiday-work treatment must follow the finalized runtime policy rather than an invented calendar.

### 4.7 Attendance Notification

- Configurable time from 00:00–23:59
- No attendance notification

The configured time uses the applicable worker/local timezone. There is no hard-coded universal 9:00 AM trigger.

### 4.8 Pay Date

Optional and **notification-only**.

Example:

> Today is your scheduled salary payment day.

It never confirms payment, processes payment, integrates with a bank, or proves receipt.

### 4.9 Salary Start Date

Used for salary-period boundaries and historical accuracy.

### 4.10 Additional Salary Rules — Optional / Expandable

Inside Salary Setup, provide:

**＋ Additional Salary Rules (Optional)**

The user may skip the entire section or fill only applicable fields.

Supported fields:

- Total Salary
- Basic Salary
- Attendance Allowance
- Other Allowance — optional
- Absent Rule
- Salary deduction per absent day
- Allowance-loss rule
- Allowance loss after X absences
- Leave treatment
- Custom salary rule/note

Absence deduction and attendance-allowance loss are separate policy components.

Example:

```text
Total Salary:             Rs. 150,000
Basic Salary:             Rs. 145,000
Attendance Allowance:     Rs.   5,000
Allowance loss threshold: 3 absences
Absence deduction:        1 day's salary per absence
```

Blank optional fields mean that the corresponding special rule is not configured; the calculation engine must not invent one.

## 5. Saved Salary Policy

The setup becomes a structured, versionable Salary Policy containing:

- salary amount / total salary
- currency
- salary type
- working hours
- overtime multiplier
- Sunday paid
- holidays paid
- attendance notification preference
- Pay Date preference
- effective/start date
- optional basic salary
- attendance allowance
- other allowance
- absence rule/deduction
- allowance-loss rule/threshold
- leave treatment
- custom rule/note
- bonus policy where configured

Closed historical salary periods retain the policy/version/snapshot information needed to explain their calculations.

## 6. Post-Save Confirmation

After successful setup:

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

## 7. Salary Person Work House / Daily Entry

Salary Person daily entry is salary-oriented:

- Date
- Attendance: Present / Absent / Leave
- Overtime hours
- Optional note

Piece/size/quantity/rate are not required as primary earning inputs.

## 8. Attendance

Supported states:

- Present
- Absent
- Leave

Attendance is date-based and idempotent: one effective result per worker/date unless an explicit revision mechanism is later required.

### Saturday → Sunday

- Saturday Present → Sunday Present automatically.
- Saturday Leave → confirmation:
  - Yes → Sunday Leave
  - No → Sunday Present
- Saturday Absent follows the finalized attendance policy.

### Sunday

Sunday paid-off status and Sunday overtime are separate:

- Sunday Paid = Yes → normal Sunday off may be paid.
- Sunday work does not automatically mean overtime.
- Actual overtime is entered manually.
- Saved overtime multiplier is applied.

### Holiday

Holiday paid/unpaid behavior follows the configured policy and approved calendar/source. Holiday work must be represented separately from normal Sunday/off-day treatment.

## 9. Overtime

Conceptual formula:

`Overtime Amount = Hourly Rate × Overtime Multiplier × Overtime Hours`

`Hourly Rate = Daily Rate ÷ Working Hours Per Day`

Daily Rate is derived from the selected salary type according to the finalized salary-period policy.

Financial arithmetic must be deterministic; persisted monetary calculations must not depend on JavaScript floating-point accumulation.

Overtime accumulates into the applicable salary period.

## 10. Bonus System — Frozen

Bonus is a separate earning component from normal salary.

### Bonus Frequency

- Yearly → **1 expected bonus month**
- Every 6 Months → **2 expected bonus months**
- Every 3 Months → **4 expected bonus months**
- Custom → **user-defined number of expected bonus months**

The system must enforce the configured expected-month count for Custom rather than assuming a hard-coded schedule.

### Bonus Amount

- Half Salary
- Full Salary
- Fixed Amount

If Fixed Amount is selected, the user supplies the Fixed Bonus Amount.

### Bonus rules

- Bonus is stored separately from base salary.
- Expected bonus months are policy-driven.
- Actual received bonus records are stored separately from expected/scheduled bonus occurrences.
- Historical bonus records retain the policy information needed to explain the amount.
- Bonus must not be silently added to ordinary salary until the applicable bonus event is recorded/recognized according to the finalized policy.

## 11. Salary Calculation

```text
Salary Policy
   ↓
Attendance + Overtime
   ↓
Sunday / Holiday Rules
   ↓
Absence + Allowance Rules
   ↓
Bonus Rules / Recorded Bonuses
   ↓
Deterministic Calculation Engine
   ↓
Salary Period Ledger
   ↓
Salary Slip
```

The calculation engine is authoritative. UI components must not contain authoritative salary formulas.

Salary calculations must remain explainable through their source attendance, overtime, adjustment, allowance, and bonus records.

## 12. Salary Period / Salary Slip

Minimum components:

- Salary period
- Base salary
- Basic salary where configured
- Attendance allowance where configured
- Other allowance where configured
- Attendance summary
- Present/Absent/Leave information
- Paid/applicable days
- Absence deductions where applicable
- Allowance adjustments where applicable
- Overtime hours
- Overtime amount
- Bonus amount and applicable bonus records
- Sunday treatment
- Holiday treatment
- Final calculated amount

Historical salary slips remain explainable after later policy changes.

## 13. Central Notification Generator

Existing notification producers remain unchanged:

```text
Friend Request  → unchanged
Comment         → unchanged
Reaction        → unchanged
```

A dedicated Salary Person Notification Generator is additive and handles:

- Attendance notifications
- Attendance action lifecycle
- Attendance 15-calendar-day cycles
- Payment-day notifications

It does not calculate salary and does not replace the existing notification infrastructure.

### Attendance notification lifecycle

At the configured local time:

1. Identify eligible Salary Person users.
2. Check whether the relevant attendance obligation is already completed.
3. If completed, generate nothing.
4. If missing, generate the attendance notification.
5. Present/Absent/Leave actions call the authoritative attendance operation.
6. Reading/opening the notification is not completion.

### 15-calendar-day action window

The attendance cycle is a **15-calendar-day action window**, not a maximum of 15 notifications.

Daily reminders may occur during the active window subject to idempotency and duplicate prevention.

Once an attendance action is completed, further reminders for that obligation stop.

### Cycle expiry

If no action occurs during the full 15-calendar-day window:

- close/pause the cycle;
- retain all previous notifications;
- generate exactly one cycle-end notification;
- do not fabricate an attendance result.

The cycle-end notification provides:

**Reset Attendance Notifications**

### Reset

Reset is explicit and user initiated:

```text
Cycle expires
   ↓
Cycle-end notification
   ↓
Cycle closed/paused
   ↓
User chooses Reset
   ↓
Previous history retained
   ↓
New cycle activated
```

Reset never deletes notification history, rewrites historical attendance, or fabricates attendance.

### Disabled attendance notifications

If the user selects No attendance notification:

- no attendance reminder cycle;
- no cycle-end notification;
- manual attendance remains available;
- manual overtime remains available;
- salary calculation remains available;
- Pay Date notifications remain independent.

### Pay Date

Pay Date notifications are informational only and never claim payment confirmation.

### Scheduler requirements

The generator must be backend-authoritative, idempotent, timezone-aware, retry-safe, and protected against duplicate generation. The exact scheduler implementation is an engineering decision against the actual repository/runtime and must preserve the frozen product behavior above.

## 14. Dashboard — Salary Person Summary

The Salary Person Dashboard is now functionally frozen as a summary-first dashboard.

### 14.1 Current Month Salary Card

Default view: **This Month**.

Show:

- Month
- Base Salary
- Overtime
- Adjustments
- Bonus
- Final Salary

Tap/click opens the detailed monthly salary view.

### 14.2 Grand Salary Card

Shows accumulated salary across **completed/finalized salary months only**:

- Total completed salary months
- Total Base Salary
- Total Overtime
- Total Bonuses
- Total Adjustments
- **Grand Total Salary**

Future or unfinished salary months are not counted as earned/finalized salary.

### 14.3 Attendance Card

Show:

- Present Days
- Absent Days
- Leave Days
- Paid Days
- Attendance Percentage

### 14.4 Overtime Card

Show:

- Total Overtime Hours
- Total Overtime Amount

### 14.5 Bonus Card

Show:

- Bonuses received
- Total bonus amount
- Expected/next bonus information according to the saved bonus policy
- Bonus frequency/type where useful

The card must distinguish expected/scheduled bonus information from bonuses actually received.

### 14.6 Salary History

Show month-by-month history, for example:

```text
September 2026
Final Salary: Rs. xxx,xxx
Present: 24 | Absent: 1 | Leave: 2
OT: 6h
Bonus: —

August 2026
Final Salary: Rs. xxx,xxx
Present: 23 | Absent: 2 | Leave: 1
OT: 4h
Bonus: Rs. xx,xxx
```

### 14.7 Monthly Detail Navigation

The Current Month Salary Card opens monthly detail.

Default: current calendar month.

**Previous** moves backward exactly one calendar month:

```text
September 2026
   ↓ Previous
August 2026
   ↓ Previous
July 2026
   ↓ Previous
June 2026
```

Monthly detail includes at minimum:

- Month / salary period
- Attendance days
- Present days
- Absent days
- Leave days
- Overtime hours
- Overtime amount
- Base salary
- Applicable adjustments
- Bonus
- Final calculated salary

Full visual styling, charts, colors, and card aesthetics are implementation/UI details and do not change this functional contract.

## 15. Data Model Direction

Conceptual model:

```text
worker_profiles
      ↓
salary_policies
      ├── bonus_policy
      ↓
attendance_records
      ↓
overtime_records
      ↓
bonus_records
      ↓
salary_periods / salary_slips

notification_generator
      ↓
existing notifications infrastructure
```

Salary Policy should support version/effective-date history.

Attendance records include worker, date, status, source/action metadata, and timestamps.

Overtime records include worker, work date, hours, applicable multiplier/policy reference, calculated amount, note, and timestamps.

Bonus records include worker, bonus occurrence/date, frequency/policy reference or snapshot, amount basis, actual amount, and timestamps as required by the implementation.

Automatic notification lifecycle records must support recipient, notification category, related attendance obligation, cycle identifier, cycle dates/deadline, action state, generated/completed/expired state, and reset metadata as required by the existing notification schema.

Final schema must follow the repository's actual Supabase conventions.

## 16. Security / RLS

Salary, attendance, overtime, and bonus data are sensitive personal financial/work data.

- A worker can access only their own records unless an explicitly authorized employer/team model is introduced later.
- RLS is authoritative at the database layer.
- Client-supplied worker IDs are not trusted for authorization.
- Salary data is not exposed through public Social profiles.
- Salary data does not enter public/social activity surfaces without separate authorization.
- Notification-generator records obey the same ownership boundary.
- Payment-day notifications do not expose salary amounts unless explicitly approved.

## 17. Code Separation

Recommended boundaries:

```text
worker/
  salary/
    salaryPolicy.ts
    salaryCalculations.ts
    salaryPeriods.ts
    overtimeCalculations.ts
    attendanceRules.ts
    weekendHolidayRules.ts
    bonusRules.ts
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

These are architectural boundaries; implementation must first inspect existing repository structure and reuse existing conventions where appropriate.

## 18. Validation

Salary Setup:

- positive required salary amount;
- valid currency;
- valid salary type;
- valid working hours when supplied;
- overtime multiplier limited to 1×/1.5×/2×;
- explicit Sunday/Holiday settings;
- attendance notification disabled or valid 00:00–23:59;
- valid Pay Date for the selected frequency;
- optional salary-rule fields validated when supplied;
- supplied salary components must remain internally explainable;
- thresholds must be semantically valid;
- valid effective/start date.

Bonus:

- frequency must be Yearly, 6 Months, 3 Months, or Custom;
- expected month count is 1/2/4 respectively or user-defined for Custom;
- bonus amount basis must be Half Salary, Full Salary, or Fixed Amount;
- Fixed Amount requires a valid fixed bonus amount;
- expected and received bonuses remain distinguishable.

Daily entry:

- valid attendance date;
- Present/Absent/Leave only;
- overtime non-negative;
- financial precision deterministic.

Notifications:

- repeated scheduler execution cannot create uncontrolled duplicates;
- only eligible Salary Person users receive Salary Person reminders;
- disabled reminders create no attendance cycle;
- read does not complete;
- actions complete the relevant obligation;
- action window is exactly 15 calendar days;
- exactly one cycle-end notification at expiry;
- reset is explicit;
- history is retained;
- Pay Date remains notification-only;
- existing Friend Request/Comment/Reaction behavior remains unchanged.

## 19. Testing Matrix

### Worker Type

- Salary Person selection works from Work Identity.
- Contract selection preserves existing flow.
- Switching does not delete historical records.

### Salary Setup

- Salary amount/currency.
- Daily/Weekly/15 Days/Monthly.
- 8h/12h/unset.
- 1×/1.5×/2× overtime.
- Sunday/Holiday settings.
- Attendance notification time/disabled mode.
- Pay Date notification-only semantics.
- Additional Salary Rules expand/collapse and optional fields.

### Attendance

- Present/Absent/Leave.
- Saturday Present → Sunday Present.
- Saturday Leave confirmation.
- Saturday Absent policy.
- Sunday paid-off behavior.
- Sunday worked with manual overtime.
- Holiday rules.

### Overtime

- Correct hourly basis for each finalized salary type.
- Correct multiplier.
- Missing working-hours behavior.
- Accumulation and deterministic rounding.

### Bonus

- Yearly → one expected month.
- 6 Months → two expected months.
- 3 Months → four expected months.
- Custom → exact user-defined month count.
- Half Salary.
- Full Salary.
- Fixed Amount.
- Bonus remains separate from normal salary.
- Historical bonus records remain explainable.

### Notifications

- Configured local trigger.
- Disabled mode.
- Missing attendance reminder.
- Present/Absent/Leave actions.
- Read does not complete.
- 15-calendar-day action window.
- Reminders stop after action.
- Exactly one cycle-end notification.
- History retention.
- Explicit reset/new cycle.
- Pay Date notification-only behavior.
- Idempotency/timezone/retry safeguards.
- Existing social notification producers unchanged.

### Dashboard

- Salary Card exists for Salary Person.
- This Month is default.
- Card opens monthly detail.
- Previous moves exactly one calendar month backward.
- Grand Salary counts only completed/finalized salary months.
- Attendance Card shows present/absent/leave/paid days and percentage.
- Overtime Card shows hours and amount.
- Bonus Card distinguishes received from expected.
- Salary History renders monthly records correctly.

### Security / Regression

- User A cannot read User B's salary/attendance/overtime/bonus/slip data.
- Public Social profile does not expose salary data.
- Contract flow remains unchanged.
- Existing Friend Request/Comment/Reaction notifications remain unchanged.
- Worker provisioning remains unchanged.
- Offline AI remains unchanged.
- Online AI remains unchanged.

## 20. Implementation Sequence

The product/design sequence is complete. Engineering implementation follows this order:

1. Inspect existing Worker Settings / Work Identity and notification/database conventions.
2. Add Worker Type without breaking Contract mode.
3. Implement Salary Person caution and Salary Setup.
4. Implement optional Additional Salary Rules.
5. Persist versioned Salary Policy securely.
6. Implement attendance and overtime records.
7. Implement finalized salary formulas and deterministic calculation engine.
8. Implement bonus policy/records and calculation integration.
9. Implement salary periods and explainable salary slips.
10. Implement backend-authoritative Salary Person Notification Generator.
11. Implement attendance action window, expiry, history, and reset.
12. Implement Pay Date notification-only behavior.
13. Implement Salary Person Dashboard cards and monthly navigation.
14. Apply RLS/security and full regression testing.

Implementation must not invent product rules that are already frozen here and must not modify protected Contract, social-notification, or AI behavior.

## 21. Definition of Done

The Salary Person feature is considered end-to-end complete when the following chain is functional:

```text
Work Identity
   ↓
Worker Type = Salary Person
   ↓
Salary Data Caution
   ↓
One-Time Salary Setup
   ↓
Optional Salary Rules
   ↓
Bonus Policy (when configured)
   ↓
Saved Salary Policy
   ↓
Salary Person Work House
   ↓
Daily Attendance
   ↓
Manual Overtime
   ↓
Bonus Records
   ↓
Salary Calculation
   ↓
Salary Period
   ↓
Explainable Salary Slip
   ↓
Salary Person Dashboard
   ├── Current Month Salary
   ├── Grand Salary
   ├── Attendance
   ├── Overtime
   ├── Bonus
   └── Salary History
```

Notification chain:

```text
Configured Attendance Time
        ↓
Missing Attendance Check
        ↓
Attendance Notification
        ↓
Present / Absent / Leave
        ↓
Attendance Recorded
```

Or:

```text
No action for 15 calendar days
        ↓
Exactly one cycle-end notification
        ↓
Explicit Reset
        ↓
New cycle
```

Payment reminder:

```text
Pay Date configured
        ↓
Payment date arrives
        ↓
Informational payment-day notification
        ↓
No payment confirmation
```

Protected Contract boundary:

```text
Worker Type = Work per Job / Contract
        ↓
Existing Contract Flow
        ↓
UNCHANGED
```

## 22. Final Design Freeze

The following are now frozen as product behavior:

- Salary Person begins from existing Work Identity / Worker Settings.
- Worker Type is Salary Person or Work per Job / Contract.
- Contract behavior is protected and unchanged.
- Salary Setup is one-time and policy-driven.
- Additional Salary Rules are optional and expandable.
- Total/Basic/Attendance Allowance/Other Allowance and absence/allowance rules are separate policy components.
- Attendance is Present/Absent/Leave.
- Saturday Present → Sunday Present.
- Saturday Leave requires confirmation for Sunday.
- Sunday paid-off status is separate from manually entered overtime.
- Attendance notification time is configurable or disabled.
- Attendance notifications are action mechanisms, not attendance results.
- The attendance action window is 15 calendar days.
- Expiry produces exactly one cycle-end notification.
- Notification history is retained.
- Reset is explicit and non-destructive.
- Pay Date is notification-only.
- Existing Friend Request/Comment/Reaction notifications remain unchanged.
- Bonus frequency is Yearly = 1, 6 Months = 2, 3 Months = 4, Custom = user-defined expected months.
- Bonus amount basis is Half Salary, Full Salary, or Fixed Amount.
- Bonus is a separate earning component.
- Grand Salary counts completed/finalized salary months only.
- Dashboard contains Current Month Salary, Grand Salary, Attendance, Overtime, Bonus, and Salary History cards.
- Current Month defaults to the current month.
- Monthly detail supports Previous-month navigation one calendar month at a time.
- Historical salary/bonus calculations remain explainable through policy/version snapshots.
- Salary data is protected by database authorization/RLS.
- AI is out of scope.

## 23. Engineering Guardrails

The blueprint is product-complete, but implementation must still validate repository-specific engineering details such as:

- existing Supabase schema and RLS conventions;
- exact salary-period arithmetic implementation;
- exact holiday source available to the application;
- scheduler/runtime mechanism;
- timezone source;
- existing notification schema;
- migration and rollback strategy;
- repository-specific file/component conventions.

These are implementation mechanics, not permission to change the frozen Salary Person product behavior.

## 24. Golden Rule

**Do not code from assumptions. Implement the frozen product contract above against the actual repository architecture.**

The authoritative Salary Person journey is:

> **Existing Work Identity → Worker Type → Salary Person → Salary Setup → Optional Salary Rules → Bonus Policy → Daily Work → Notification/Attendance → Overtime → Calculation → Salary Slip → Salary Person Dashboard → Monthly History**

The authoritative regression boundaries are:

> **Existing Work per Job / Contract behavior — unchanged**
>
> **Existing Friend Request / Comment / Reaction notifications — unchanged**
>
> **Offline AI / Online AI — unchanged and out of scope**
