# Coding-agent operating contract

Status: active. User authorized implementation on 2026-09-26 by accepting the proposed Node/TypeScript and Better Auth approach. Implement the approved foundation and customer journey; live vendor/commercial gates remain in OPEN-QUESTIONS.md.

## Start every task

1. Read README.md, docs/product/DECISIONS.md, docs/product/OPEN-QUESTIONS.md, and the assigned task.
2. Read the canonical specifications and acceptance cases referenced by that task. Do not rely only on summaries or chat history.
3. Identify the approved baseline version, requirement IDs, in-scope changes, dependencies, and verification evidence expected.
4. If implementation is not authorized, work only on specifications and review artifacts. Do not scaffold an application or install its dependencies.

## Authority and conflicts

Follow current explicit user instructions first. Record decisions changing the baseline in the decision log. Within the approved baseline, each canonical owner listed in TRACEABILITY.md owns its requirements. An approved scoped ADR can supersede a documented technical choice only when it names that choice and the affected files are updated.

If canonical documents conflict, do not silently choose the easiest implementation. Record the conflict, resolve routine editorial issues, and request a product decision only if behavior, scope, cost, privacy, or architecture materially changes. Draft suggestions are not approved requirements. Do not mark your own product decisions approved.

## Implementation boundaries once authorized

- Implement only the assigned approved slice and necessary supporting changes.
- Keep route handlers and UI components thin; business rules belong in their modules.
- Chat and direct controls must use the same configuration commands.
- Validate inputs and authorization server-side. Model-generated arguments are untrusted input.
- Use actual catalog IDs. Do not fabricate fabric stock, pricing, delivery dates, vendor endpoints, confidence scores, or body measurements.
- Preserve measurement and order revisions. Do not overwrite historical accepted specifications.
- Keep provider SDKs behind adapters. Do not leak provider payloads into UI or domain entities.
- No paid order, production release, message to a customer, or real scan submission during development unless authorized for that task/environment.
- Test fixtures must be synthetic and clearly labeled. Demo providers must be impossible to enable accidentally in production.
- Use the dependency and migration policies in SECURITY-RELEASE.md. Do not add a library or replace a framework merely for convenience.
- Existing code, tests, and unrelated user work must be preserved.

## Verification and completion

For each task, report changed requirement IDs, implementation scope, tests actually executed, relevant screenshots or recordings, remaining dependencies, and known limitations. A test name or unchecked checklist is not evidence of a passing test.

UI tasks require visual inspection at the specified viewport sizes and keyboard testing. Integration tasks require verified contract fixtures and error-path evidence; a local mock alone does not prove the live integration works. Important business invariants require automated checks.

If acceptance criteria fail, fix the implementation or raise a change proposal. Do not weaken tests or edit requirements merely to make a task appear complete. Do not silently substitute a screenshot for interactive 3D, a scripted chat for catalog-connected AI, or placeholder data for live measurement results.

## Allowed autonomy

Routine refactoring, internal naming, and reversible implementation choices within an approved task do not need repeated permission. Document material deviations before merging them into the baseline. Continue unrelated approved work when a vendor dependency blocks one slice.

## Task handoff

Use docs/templates/TASK.md. Keep one small task's evidence together. Update the traceability matrix and implementation status. Distinguish implemented, locally verified, externally verified, and released. A coding agent may propose completion; it cannot invent external approval or production validation.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
