# Work Social — Salary Person Bonus Rules

**Status:** Frozen design requirement. Implementation remains gated by the broader Salary Person formula/policy freeze.

## Bonus — Optional / Expandable Salary Setup Section

The Salary Setup form must contain an **optional expandable Bonus section**. It behaves like the optional Additional Salary Rules section: collapsed by default, opens on click/tap, and may be skipped entirely when no bonus applies.

### Bonus Frequency / Type

When Bonus is enabled, the user selects the bonus frequency:

- **Yearly** → exactly **1 Expected Bonus Month**
- **Every 6 Months** → exactly **2 Expected Bonus Months**
- **Every 3 Months** → exactly **4 Expected Bonus Months**
- **Custom** → user-defined bonus schedule; exact custom-frequency semantics remain subject to the broader formula freeze.

The UI must dynamically enforce the required number of Expected Bonus Month selections for the predefined frequencies. A user cannot select fewer or more months than the selected frequency requires.

Examples:

```text
Yearly
Expected Bonus Month: December
```

```text
Every 6 Months
Expected Bonus Months: June, December
```

```text
Every 3 Months
Expected Bonus Months: March, June, September, December
```

### Bonus Amount

The user selects:

- **Half Salary**
- **Full Salary**
- **Fixed Amount**

When **Fixed Amount** is selected, show:

- **Fixed Bonus Amount** — user enters the bonus amount.

The fixed amount uses the Salary Setup currency.

### Bonus Is a Separate Earning

Bonus must remain a separate earning component and must not be silently merged into the normal base salary policy.

Conceptually:

```text
Base Salary
+ Attendance / Absence Adjustments
+ Overtime
+ Bonus
= Final Salary / Salary Period Result
```

A bonus should be visible and explainable as a separate line item in applicable salary records/slips.

### Expected Bonus Month Semantics

Expected Bonus Month is a scheduling/expectation setting. It does not mean that Work Social has confirmed that the employer paid the bonus.

The system may use the configured expected month(s) for bonus-related reminders/records when that notification behavior is later implemented and frozen. It must not claim payment confirmation, bank receipt, or employer payment without an authoritative payment record.

### Historical Integrity

Bonus policy changes must not silently rewrite historical bonus records or finalized salary periods. Applicable bonus calculations/records must retain enough policy/version information to remain explainable.

### Frozen Examples

| Frequency | Required Expected Months | Example |
|---|---:|---|
| Yearly | 1 | December |
| Every 6 Months | 2 | June + December |
| Every 3 Months | 4 | March + June + September + December |

## Data Model Direction

The Salary Policy should eventually support bonus configuration, subject to final schema design:

- bonus_enabled
- bonus_frequency
- expected_bonus_months
- bonus_amount_type
- fixed_bonus_amount nullable

The exact Custom frequency representation and any future bonus eligibility rules remain open until explicitly frozen. No arbitrary bonus formula should be invented.

## Scope Boundary

- Salary Person only.
- Existing Work per Job / Contract behavior remains unchanged.
- Existing Friend Request / Comment / Reaction notifications remain unchanged.
- Offline AI and Online AI remain out of scope.
