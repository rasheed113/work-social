# Work Social Phase 2 — Hardcoded Visual Drift Map

- **Base:** `9b5af765f10cc172d0f6a5c945cf2d889dd691fc`
- **Audit only:** no application source/CSS changed.
- **Reference DNA:** primary `#2563EB`, background `#FFFFFF`, surface `#F8F9FA`, text `#111827`, Poppins, 44px controls, 12px cards / 8px buttons / 999px pills, spacing 4/8/16/24px.
- **Notation:** line numbers refer to the exact base commit above. Long CSS declarations are summarized to the offending value(s), not copied wholesale. Values are flagged where they diverge from or bypass the approved tokens; semantic status colors and decorative visualization colors are also noted where the page palette is not uniform.

## Page-local hardcoded drift

| File:line | Current value(s) | Drift / note |
|---|---|---|
| `src/app/pages/HomePage.tsx:103` | `linear-gradient(135deg, #6d5dfc, #22c1dc, #ff5ca8)` | Legacy purple/cyan/pink accent gradient; not the single primary blue. |
| `src/app/pages/HomePage.tsx:116` | `min-height: 42px` | Action control below 44px target. |
| `src/app/pages/HomePage.tsx:119` | `border-radius: 15px` | Does not match 8px button radius. |
| `src/app/pages/HomePage.tsx:121` | `color: #17202a` | Legacy text value instead of `#111827` token. |
| `src/app/pages/HomePage.tsx:135` | `border-radius: 999px` | Pill radius is aligned; its gradient at line 136 is not. |
| `src/app/pages/HomePage.tsx:136` | `linear-gradient(180deg, #22c1dc, #6d5dfc, #ff5ca8)` | Legacy multi-accent badge/decorative gradient. |
| `src/features/worker/pages/WorkerOverviewPage.tsx:29` | `#070b17`, `#0c1020`, cyan/purple radial glows; `#eef6ff` text | Full dark page background and light text conflict with approved light background/text DNA. |
| `src/features/worker/pages/WorkerOverviewPage.tsx:29` | `.wo-hero,.wo-card`: 24px radius; dark glass gradients | Page-specific card material/radius bypasses shared card tokens. |
| `src/features/worker/pages/WorkerOverviewPage.tsx:29` | `.wo-set,.wo-btn`: 38px or 42px minimum height; 12px radius | Below 44px and button radius 8px target. |
| `src/features/worker/pages/WorkerOverviewPage.tsx:31` | `.wo-field`: 28px radius; dark starfield gradients | Decorative data visualization uses bespoke geometry and dark palette. |
| `src/features/worker/pages/WorkerOverviewPage.tsx:32` | `.wo-prism`: 24px radius; navy/cyan/violet gradients | Second bespoke visualization palette and geometry. |
| `src/features/worker/pages/WorkerOverviewPage.tsx:33` | `.wo-finbox`: 14px radius; dark translucent surface | Local finance cards differ from approved 12px card radius and light surface. |
| `src/features/contractor/pages/ContractorOverviewPage.tsx:48` | `color: #172033`; `#f8fbff`, `#f5f7fb`; blue/violet radial gradients | Light overall surface but uses hardcoded text/background and violet accent. |
| `src/features/contractor/pages/ContractorOverviewPage.tsx:49` | `.co5-create-team`: 38px height; violet/cyan gradient; 12px radius | Button height and accent drift. |
| `src/features/contractor/pages/ContractorOverviewPage.tsx:49` | `.co5-settings`: 38px height; 12px radius; `#4338ca` text | Button height/radius/color drift. |
| `src/features/contractor/pages/ContractorOverviewPage.tsx:49` | `.co5-hero`: 22px radius; `.co5-card` family has 19px radius | Card geometry differs from 12px approved radius. |
| `src/features/contractor/pages/ContractorOverviewPage.tsx:49` | `#4f46e5`, `#3730a3`, `#06b6d4`, `#6366f1`, `#7c3aed`, `#4338ca` | Hardcoded indigo/violet/cyan palette across headings/actions. |
| `src/features/contractor/pages/ContractorFinancePage.tsx:11` | blue/violet radial gradients; `rgba(124,58,237,.13)` | Personal Finance accent palette differs from Team Finance and global primary. |
| `src/features/contractor/pages/ContractorFinancePage.tsx:12` | `borderRadius: 18`; white/near-white gradient; `rgba(255,255,255,.78)` border | Card radius and locally authored card surface. |
| `src/features/contractor/pages/ContractorFinancePage.tsx:29` | error text `#64748b` and locally styled buttons | Slate hardcoded text and local control styling; review all finance modal/metric styles in file lines 48–57 too. |
| `src/features/contractor/pages/ContractorFinancePage.tsx:48` | `#2563eb`, `#eff6ff`, `rgba(59,130,246,.24)`, `#7c3aed` | Blue is close to primary but inconsistent casing/value and violet remains hardcoded. |
| `src/features/contractor/pages/ContractorTeamFinancePage.tsx:37` | dark/navy background with `rgba(99,102,241,.16)` indigo and `rgba(6,182,212,.…)` cyan glow | Entire Team Finance shell remains dark while Personal Finance is light. |
| `src/features/worker/pages/WorkerWorkHistoryPage.tsx:53` | `--ink:#172033; --muted:#64748b; --blue:#2563eb; --violet:#635bdb; --teal:#0f9f95` | Local palette duplicates global tokens and adds violet/teal. |
| `src/features/worker/pages/WorkerWorkHistoryPage.tsx:54` | blue/teal radial gradients | Page background decoration bypasses shared surface token. |
| `src/features/worker/pages/WorkerWorkHistoryPage.tsx:55` | `border-radius: 16px`; `#ffffff`, `#f8fafc`, `#f1f5ff` | Explicit 16px radius; grey/blue surface is not `#F8F9FA`. |
| `src/features/worker/pages/WorkerWorkHistoryPage.tsx:57` | `#ffffff`, `#f7faff`, `#eef3ff`; violet border | Hero has separate light-blue/violet treatment. |
| `src/features/worker/pages/WorkerWorkHistoryPage.tsx:59` | back button `min-height: 34px`; 10px radius | Below 44px and uses nonstandard radius. |
| `src/features/worker/pages/WorkerWorkHistoryPage.tsx:63` | title `#18233b` and white/slate text shadows | Heading uses hardcoded text/shadow styling. |
| `src/features/worker/pages/WorkerWorkHistoryPage.tsx:65` | segment control `border-radius: 13px` and `#e9edf…` surface | Custom segmented-control surface/radius. |
| `src/features/worker/pages/WorkerWorkHistoryPage.tsx:67` | daily row 10px radius; blue gradient | Local row shape and accent. |
| `src/features/worker/pages/WorkerWorkHistoryPage.tsx:69` | Load More `min-height: 38px`; 10px radius | Below 44px and not the approved 8px button radius. |
| `src/features/contractor/pages/ContractorAccountPage.tsx:19` | green radial gradient with blue/violet tones | Contractor account/setup background is different from global light surface and Contractor Overview. |
| `src/features/contractor/pages/ContractorAccountPage.tsx:21` | input `minHeight: 44`, `borderRadius: 12`, `color: #172033`, near-white background | Height aligned; text color and input radius drift from `#111827` / 8px button-control target. |
| `src/features/contractor/pages/ContractorAccountPage.tsx:43` | info card `borderRadius: 14`; green/blue gradient `#ecfdf5`, `#eff6ff` | Card radius and accent/surface drift. |
| `src/features/contractor/pages/ContractorAccountPage.tsx:44` | Choice button has bespoke styles and 44px minimum height | Height aligned, but styling does not use shared Button token/component. |
| `src/app/pages/ProfilePage.tsx:12` | `color: #17202a` | Legacy text color. |
| `src/app/pages/ProfilePage.tsx:21` | purple/blue/cyan/pink gradient | Multi-accent palette not using primary token. |
| `src/app/pages/ProfilePage.tsx:33` | `border-radius: 22px` | Explicit 22px radius. |
| `src/app/pages/ProfilePage.tsx:99` | button `min-height: 38px`; line 101 radius 999px | Button height below target; pill radius may be intentional for pill controls. |
| `src/app/pages/ProfilePage.tsx:133` | `border-radius: 17px` | Nonstandard card/surface radius. |
| `src/app/pages/ProfilePage.tsx:170` | button `min-height: 36px` | Below 44px target. |
| `src/app/pages/ProfilePage.tsx:181` | `border-radius: 19px` | Nonstandard card radius. |
| `src/app/pages/ProfilePage.tsx:183` | all profile buttons `min-height: 36px` | Explicit override below the global target. |

## Shared stylesheet / shell drift

| File:line | Current value(s) | Drift / note |
|---|---|---|
| `src/app/premium-visual-unification.css:3` | `--ws-dna-bg-0:#07111f; --ws-dna-bg-1:#0a1730; --ws-dna-bg-2:#0c1d3b` | Legacy dark DNA remains declared in the earlier shared stylesheet. |
| `src/app/premium-visual-unification.css:6` | `--ws-dna-blue:#3b82f6; --ws-dna-cyan:#22d3ee; --ws-dna-violet:#7c83ff` | Non-primary accent variables remain in the earlier sheet. |
| `src/app/premium-visual-unification.css:7` | `--ws-dna-text:#eaf6ff; --ws-dna-text-soft:#a9c4df; --ws-dna-muted:#7894b1` | Dark-theme text variables conflict with approved light text DNA unless overridden by cascade. |
| `src/app/universal-components.css:7–24` | `--ws-ui-control-h:42px`, compact 36px, radii 12/16/22px; defaults include dark translucent surfaces and `#3b82f6`/`#22d3ee`/`#7c83ff` | Shared component system itself still carries legacy dark defaults and control heights below 44px. |
| `src/app/universal-components.css:42–44` | cards use dark linear gradients and radius `var(--ws-ui-radius-lg)` | Shared card selectors do not default to the approved `#F8F9FA` surface/12px radius. |
| `src/app/universal-components.css:63–88` | buttons use dark gradients; primary is cyan→blue→violet; compact control is 36px | Not yet a light-blue single-primary button system. |
| `src/app/universal-components.css:101–119` | form controls dark background; border/text overridden with `!important`; options `#0b1d38` | Legacy dark form styles can override page-local light styling. |
| `src/app/universal-components.css:131–170` | tabs, active states, badges, filters and menu items use cyan/violet/dark surfaces; several 32/36/38px controls | Shared interactive controls still diverge from approved token geometry/palette. |
| `src/app/universal-components.css:232–253` | approved light variables are declared, including `--primary:#2563EB`, `--bg:#FFFFFF`, `--surface:#F8F9FA`, `--text:#111827` | Tokens exist, but many rules above use hard-coded values instead of these tokens. |
| `src/app/styles.css:95–96` | `height:42px !important; max-height:42px !important` | Shared rule forces some controls below 44px. |
| `src/app/styles.css:136` | `border-radius:14px !important; color:#5146e5 !important` | Legacy violet and nonstandard radius. |
| `src/app/styles.css:157` | `min-height:46px !important` | Above target but inconsistent with exact 44px baseline. |
| `src/app/styles.css:160` | `border-radius:15px !important` | Nonstandard radius. |
| `src/app/styles.css:167` | `color:#17202a !important` | Legacy text color. |
| `src/app/styles.css:195` | `min-height:52px !important`; line 198 radius 14px | Nonstandard control height/radius. |
| `src/app/styles.css:214–215` | `min-height:48px !important`; `border-radius:16px !important` | Nonstandard height/radius. |
| `src/app/styles.css:230–236` | `min-height:68px !important`; radius 16px; `#17202a` | Large legacy control/text rule. |
| `src/app/styles.css:267–270` | `#6d5dfc`, `#22c1dc`, `#4f46e5` accents | Legacy violet/cyan values. |
| `src/app/styles.css:340–342` | `min-height:70px !important`; `border-radius:16px !important` | Nonstandard control geometry. |
| `src/app/Router.tsx: inline style block` | header uses navy/dark gradients and violet logo; header action 40px; bottom nav 48px buttons and 22px outer radius | Shell navigation can make light pages feel like a separate dark app. Exact source is the embedded `<style>` string and inline nav styles in Router.tsx. |

## Fonts

- `src/app/styles.css:1` and `index.html` establish the app base/font loading for Poppins in Phase 1.
- No page-local `Inter` declaration was found in the reviewed target-page files listed above. This is **not** a claim that no Inter reference exists anywhere in the repository; search/extend the audit before changing typography globally.

## Repeated implementation pattern

The audited pages mostly define visual elements directly with inline style objects, embedded CSS strings, or page-specific stylesheets instead of a shared Card/Button component. Therefore, duplicate styling is structural rather than just a different class name: the pages each independently define card surfaces, radii, borders, button heights, colors, and modal appearance.

## Implementation guardrail

Use this map as a prioritized checklist, not a mandate to replace every color blindly. Preserve semantic status colors and chart/visualization data encodings when needed, but align page shells, ordinary cards, buttons, inputs, typography, spacing, and navigation to the approved tokens. Any implementation must be **className/CSS-only** for the protected logic mapped in `phase2-page-inventory.md`.
