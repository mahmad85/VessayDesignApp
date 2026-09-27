# Acceptance scenarios

Status: proposed v0.2. These scenarios are NOT executed tests. Each implementation task adds executable cases and records actual evidence. Requirement mapping is in TRACEABILITY.md.

| ID | Given | When | Expected result and evidence |
| --- | --- | --- | --- |
| AC-01 | Customer has a saved multi-garment draft | Reload, sign in, switch device where supported, or resume later | Ownership remains correct; accepted choices and active revisions persist; stale commercial data refreshes |
| AC-02 | Same valid garment and fabric catalog | Accept a chat recommendation, then change a swatch directly | Tags, controls, preview, quote and review show one committed configuration; no duplicate independent state |
| AC-03 | AI response is pending against revision 4 | User saves another choice at revision 5 | Late revision-4 mutation is rejected/reconciled; revision 5 is not silently overwritten |
| AC-04 | Customer supplies occasion, garment, color, climate and budget together | Assistant processes the message | Extracted preferences are correct; next question addresses missing information; advice uses real compatible IDs |
| AC-05 | No item meets the stated constraints, or catalog text includes instructions | Assistant searches/recommends | Explain conflict without invented stock/prices; untrusted content cannot execute privileged commands |
| AC-06 | Required design choices are missing or suggested only | Customer continues to measurement | Gate explains missing decisions; accepted defaults work; unaccepted suggestions do not become manufacturing choices |
| AC-07 | Selected options become incompatible after category/fabric change | Apply the proposed change | Impact is clear; preserve compatible data; explicit acceptance before removing selected options; server rules enforce result |
| AC-08 | Customer uses keyboard, zoom or small viewport | Complete each essential screen and edit a measurement | Focus/navigation/error announcements work; no essential drag-only control; readable layouts, labels and fallback views |
| AC-09 | Provider access and synthetic/authorized test identity are available | Start and complete a real sandbox capture | Verified launch flow returns mapped values to correct capture/customer; original source and units preserved |
| AC-10 | Scan expires, fails, is abandoned, or provider is unavailable | Customer leaves, resumes or requests retry | Draft persists; actual status shown; retry obeys provider billing/identity rules; no false success or fake progress |
| AC-11 | Duplicate/out-of-order result or forged callback | Process event | Verify authenticity/authoritative retrieval; deduplicate; preserve correct capture revision and newer edits |
| AC-12 | Verified measurement dictionary and results | Change units, edit values, select fields, save and retake | No rounding drift; correct anatomical path; source/revisions visible; missing values block completeness; previous values retained |
| AC-13 | Provider model absent or cannot be adapted | Open measurement review/final avatar | Approved fallback clearly labeled; numeric results usable; no claim of personalized reconstruction, fit or garment draping |
| AC-14 | Selected construction, materials and styling-only items | Inspect front/back/detail views and final review | Geometry/material mapping is correct; included items match specification; styling-only items excluded from order/price |
| AC-15 | Review is complete, then design/measurement/price availability changes | Submit old review | Stale/incomplete submission rejected with targeted recovery; no old approval reused for changed order |
| AC-16 | Valid review snapshot and an explicit customer action | Submit for review or checkout, double-click, retry after timeout, refresh | Exactly one intended snapshot/attempt per action; review submission, verified payment and production states remain distinct |
| AC-17 | Submitted order and later catalog/measurement changes | Export or request amendment | Historical snapshot/export remains unchanged; amendment has new version, actor and time; structured/readable outputs match |
| AC-18 | Customer, catalog admin, tailor and support roles | Access own/other drafts, photos, orders and staff controls | Authorization matrix enforced server-side; unauthorized records and sensitive assets not exposed |
| AC-19 | Incomplete catalog item or missing asset mapping | Save draft and attempt publication | Draft allowed; incomplete customer-visible publication blocked; historic published versions preserved |
| AC-20 | Consent absent, appearance upload skipped/removed, or deletion requested | Start capture/use appearance feature/delete data | Required consent enforced; appearance remains optional; purpose separation and verified retention/deletion workflow operate |
| AC-21 | Application restarts after committing pending external work | Resume dispatcher and job handling | Work eventually dispatches safely; retries do not duplicate external actions; status recovers from durable records |
| AC-22 | Staging production-shaped environment | Run migrations, restore test backup, exercise streaming/upload/callbacks and load budget | Evidence captured; no secrets/private data in logs; pool/caching/isolation settings verified |
| AC-23 | AI service timeout or streaming interruption | Continue configuration and resend safely | Direct controls remain usable; unsent text/accepted state preserved; no invented completion or runaway retries |
| AC-24 | Proposed measurement/pattern coverage and tailor-approved protocol | Compare representative provider results and physical reference measurements | Report metric-level error/repeatability/missing coverage; tailor decides acceptability; marketing accuracy is not pass evidence |
| AC-25 | Current design/measurement snapshot and versioned review rules | Run automated review with missing, conflicting, unsupported and valid inputs | Structured findings are grounded; required failed checks cannot pass; customer corrections trigger recheck; only policy-eligible snapshots proceed |
| AC-26 | Customer selects human review | Submit, edit later, receive clarification, pass deadline or receive approval | Reviewed revision remains explicit; 24-hour clock/awaiting-customer terms visible; overdue case escalates; no automatic approval or charge |
| AC-27 | Current review approval and quote | Customer confirms checkout, or attempts stale/altered/duplicate checkout | Server validates snapshot/price/currency/availability; explicit payment consent; one intended checkout action; blocked or stale review cannot pay |
| AC-28 | Payment is pending or callback is duplicated/late/forged | Return from provider or receive events | Redirect alone is not success; authenticity/amount/currency/order checked; deduplicate and reconcile unknown status before another attempt |
| AC-29 | Paid specification and later expert clarification | Propose material change, higher/lower price or unfulfillable order | Paid snapshot preserved; customer accepts amendment; additional charge separately authorized; refund/hold policy applied; no false production claim |
| AC-30 | Self-hosted auth with configured email delivery | Register, verify, reset, reuse/expire a token, revoke session or recover access | Library-supported secure flows work; enumeration protections; reset tokens single-use/time-limited; revoked sessions no longer authorize |
| AC-31 | Multiple app instances and customer/staff roles | Attempt abuse, forged proxy headers, cross-account access or missing staff MFA | Shared abuse controls/session revocation and server authorization hold; trusted proxy policy works; privileged recovery is controlled |
| AC-32 | Tailor-labeled review cases and proposed SLA | Evaluate review misses/escalations and rehearse manual queue | Tailor approves thresholds/coverage; no unsupported accuracy claims; operational owner can support promised service or revises copy before release |
| AC-33 | Human-review approval/clarification or payment completion | Notification is delivered, duplicated, delayed or fails | Correct secure link and current status; minimal personal data; deduplication/retry; in-app case remains accessible; no lost approval or duplicate payment |

## Evidence requirements

Unit tests cover rules and conversion/idempotency logic. Integration tests cover persistence, authorization and verified provider contracts. Playwright covers key customer journeys and error recovery. Visual evidence covers supported assets, viewports and keyboard behavior. AI evaluation uses fixed scenario inputs and scored outputs, with prompt/model versions recorded.

Mocks enable development but cannot satisfy AC-09 or the real-provider portions of AC-10/11. Production-readiness review distinguishes passing local tests from external integration verification and fit-validation evidence.

## Definition of done for a slice

Assigned acceptance cases pass; changed requirements are linked; migration/rollback implications documented; screenshots or recordings inspected where UI changed; no unresolved blocker is hidden; and actual implementation status is updated. Approval and deployment follow the scope already authorized by the user.
