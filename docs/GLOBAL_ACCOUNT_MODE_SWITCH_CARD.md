# Global Account / Work Mode Switch Card

The existing Worker Settings mode switch is now shared as the single Account / Work Mode card.

Supported modes:
- Salary Person
- Work per Job / Contract
- Contractor

The card is rendered on Worker Settings and Contractor Settings. Salary Person and Work per Job / Contract continue to use the existing `setWorkerType` persistence path. Contractor remains a separate settings surface and does not change the Worker `worker_type` enum.

Switching away from Contractor does not delete Contractor setup data. Returning to Contractor opens the Contractor Settings surface when setup exists, or the existing setup flow when it does not.

This change does not introduce Master Contracts, Teams, memberships, payments, commission calculations, Finance integration, or AI behavior.
