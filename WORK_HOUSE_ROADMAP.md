# Work House Roadmap

## 1. Purpose / Why Work House Exists

Work House is the Work side of Work Social. Its purpose is to make real-world work easier to record, discover, coordinate, and connect across workers, contractors/team leaders, companies, and markets.

The core principle is **easy access and connection — not taking responsibility for the underlying deal**.

Work Social helps people discover opportunities, maintain useful work records, and connect beyond their existing personal networks. Actual employment, trade, order, delivery, payment settlement, product quality, and other commercial risks remain the responsibility of the parties involved.

## 2. Worker Value

A worker — including a garment worker or other skilled worker — should be able to:

- Maintain a personal job/work history.
- Keep salary history and current payment information.
- Record completed work and relevant work entries.
- Discover work opportunities through the Social side of Work Social.
- Stay connected with co-workers.
- Build a persistent work history instead of relying on paper registers or memory.
- Export their work record as a PDF when needed, including for purposes such as bank or loan applications and employment-related proof.

The distinction is intentional:

> Social profile: who I am and who I am connected to.
>
> Work record: what work I have done and what my work/payment history contains.

## 3. Contractor / Team Leader Value

Contractors and team leaders often depend on registers, notebooks, spreadsheets, or repeatedly asking workers for weekly production details.

Work House should make the work record flow continuously from the people doing the work.

A worker working under a team leader/contractor can submit work entries. The team leader should be able to see, in near real time where the product supports it:

- Each worker's entries.
- Total work/production.
- Quantity produced or completed.
- Calculated totals.
- Worker payment information.
- Team payment totals.
- Historical records.

The system should calculate totals from the recorded work/rate information rather than requiring the contractor to calculate everything manually.

### Entry integrity principle

A submitted worker entry must not be silently editable by the team leader/contractor. The team leader can view the worker's entries and totals, but permissions and auditability must protect the original submitted values.

The contractor should also accumulate a durable team/work history over time.

## 4. Company Owner Value

A company should not have to depend only on old contacts or personal relationships when it needs workers or contractors.

A company owner should be able to publish a work requirement such as:

- What type of work is needed.
- What kind of workers/teams/contractors are required.
- Relevant quantity, location, or job details.

Interested workers or contractors can discover the requirement and contact the company through Work Social.

This changes the discovery model from:

> "Do you know someone who can do this work?"

into:

> "Publish the requirement and let interested people discover it."

A company should also be able to receive appropriate production and payment-related visibility from the underlying work records, subject to role and permission boundaries.

## 5. Work + Social Opportunity Discovery

Social and Work have different responsibilities but reinforce each other.

- **Social** helps people discover and connect.
- **Work** records and organizes actual work relationships/activity.

Examples:

- A contractor needs workers -> publish a requirement -> interested workers contact the contractor.
- A company needs contractors -> publish the requirement -> interested contractors contact the company.
- A worker wants work -> discover opportunities through Social -> contact the relevant person/company.

The goal is to reduce dependence on existing personal networks and make opportunities easier to discover.

## 6. Company -> Market -> Shopkeeper Discovery

A company/business can publish information about newly launched products or products it wants the market to discover.

A shopkeeper should not be limited to suppliers they already know or companies in their own city.

Example:

> A shopkeeper in Karachi knows several Karachi companies. Work Social can expose products/businesses from Lahore, Multan, Larkana, Peshawar, and other participating locations.

The value is discovery:

- "There is another company making this product."
- "This product is also available from another city."
- "I did not know this business existed."

A business can therefore publish its products/business offering and let interested market participants discover it without the business having to personally visit every market to find buyers.

Interested parties can contact each other and make their own arrangements.

## 7. Platform Boundary / Responsibility

Work Social is an access, discovery, record, and connection platform.

Work Social does **not** take responsibility for:

- Orders as a contracting party.
- Delivery or logistics.
- Payment settlement between parties.
- Product quality.
- Employment agreements.
- Commercial losses.
- Whether a buyer or seller completes a deal.
- Whether a worker or contractor performs a contract successfully.

The platform can provide records, calculations, discovery, and communication features, but parties trade and work at their own risk and responsibility.

This boundary must remain explicit as Work features grow.

## 8. Online + Offline Direction

Work House is intended to be a hybrid online + offline experience.

The offline requirement matters because real-world work can happen in factories, workshops, markets, shops, warehouses, and field environments where connectivity may be unreliable.

The eventual architecture should support:

- Local access to appropriate previously synced work data.
- Recording supported work activity while offline.
- A reliable pending-change/sync mechanism.
- Safe retry and idempotency.
- Conflict handling.
- Server-side validation and permissions when synchronized.

**Do not implement this entire sync architecture prematurely.** It must be designed carefully before core Work mutations are built around it.

## 9. Product Principles

1. **Real data only** — no fake projects, fake totals, fake payments, or mock success paths.
2. **Worker ownership of submitted work entries** — original submitted values need integrity and auditability.
3. **Role-based visibility** — workers, team leaders, companies, and market participants should see only what their relationship permits.
4. **Discovery beyond existing connections** — Work Social should reduce dependence on personal networks.
5. **Social and Work are connected but separate domains** — Social discovers/connects; Work manages work records and Work-specific experiences.
6. **Platform, not guarantor** — Work Social provides access and tools but does not become responsible for private/commercial deals.
7. **Online + offline by design** — offline support must be part of the eventual architecture rather than an afterthought.
8. **Incremental vertical slices** — build and verify one real capability at a time.
9. **No premature features** — only build a Work feature when its purpose, permissions, data ownership, and offline behavior are understood.
10. **Separate Work pages** — Work House is the shell; individual Work rooms/pages should remain independently maintainable.

## 10. Work House Navigation Direction

Current entry model:

- Social side: `Dashboard` is the door into Work House.
- Work side: the same header control switches back to `Social`.
- Work House has its own footer/navigation boundary and must not render Social's footer navigation.

The Work House is a dedicated page/shell. Future Work rooms should be separate pages/routes rather than being placed into one monolithic component.

## 11. Suggested Roadmap

### Phase 0 — Product Foundation

- Lock the Work WHY and platform boundaries.
- Define user types and relationships.
- Define Work domain terminology.
- Define data ownership and permission rules.
- Design the online/offline model before implementing core mutations.

### Phase 1 — Worker Work Identity

- Worker Work profile.
- Employment/work history.
- Work-entry model.
- Salary/payment history model.
- Work-record history view.
- PDF export design.

### Phase 2 — Team Leader / Contractor

- Team relationships.
- Worker-to-team association.
- Worker work-entry visibility.
- Automatic production calculations.
- Payment calculations.
- Team totals.
- Immutable/auditable submitted-entry model.
- Team history.

### Phase 3 — Work Opportunities

- Company/contractor/worker opportunity publishing.
- Discovery beyond existing connections.
- Relevant visibility rules.
- Contact/response flow through existing Social communication where appropriate.

### Phase 4 — Company Work Operations

- Company structure.
- Contractor/team relationships.
- Production visibility.
- Payment-related reporting/records.
- Historical work records.
- Role-based access across company, contractor, and worker levels.

### Phase 5 — Product & Market Discovery

- Business/company product posts.
- Market/shopkeeper discovery.
- Product/business information pages.
- Contact flow for interested parties.
- Keep order, delivery, and payment responsibility with the trading parties.

### Phase 6 — Offline + Sync Hardening

- Local Work data layer.
- Pending changes.
- Synchronization.
- Retry/idempotency.
- Conflict handling.
- Offline UX states.
- Server reconciliation and security validation.

### Phase 7 — Expansion

Potential future Work rooms should be added only after their real-world need is established. Examples may include richer business operations, reporting, documents, inventory-related workflows, or other domain-specific tools — but these are intentionally not committed features yet.

## 12. Current Status

The Work House entry and navigation foundation already exist in the application:

- `/work` is the dedicated Work House route.
- Work House has its own page/file.
- Work has its own navigation boundary.
- Social footer navigation does not belong inside Work House.
- The header contains a two-way Social <-> Work switch.

The next Work implementation should begin from the product foundation above, not from mock dashboards or a generic project-management template.
