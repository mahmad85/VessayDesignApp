# Backend and authentication decision review

Status: proposed v0.2, 2026-09-26. The user asked for comparison; no backend switch or final authentication selection is implied. No application code exists yet.

## Node versus Python/FastAPI

Recommendation: retain TypeScript/Node for the first application backend. Phase 1 mainly coordinates catalog/database operations, the chat provider, 3DLOOK and payment APIs. Keep a future Python inference service behind a typed API if a concrete model workload needs it.

FastAPI is a valid alternative. It provides typed request validation with Pydantic, OpenAPI/schema generation, dependency injection, asynchronous request handling and streaming/WebSocket facilities. It does not supply a finished chatbot, persistent conversation policy, tailoring rules, custom trained model, evaluation suite or durable workflow system automatically.

OpenAI provides official JavaScript/TypeScript and Python SDKs. Provider-hosted model calls, tool use and streaming are available in both ecosystems. Calling or fine-tuning a hosted model is distinct from developing and serving one's own model. Our architecture must not depend on a provider's chat-history storage as the sole source of state in either language.

| Concern | TypeScript/Node foundation | Python/FastAPI foundation |
| --- | --- | --- |
| React/3D application integration | Shared language and reusable typed schemas | Frontend still React/TypeScript; generate client types from OpenAPI |
| External AI/3DLOOK/payment calls | Suitable async API orchestration | Suitable async API orchestration |
| API contracts | Explicit Zod/JSON schemas and OpenAPI tooling | Pydantic/OpenAPI are framework strengths |
| Developing custom ML/inference | Use a specialist service when needed | Direct access to Python ML/data tooling |
| Operations with proposed Next.js UI | One initial full-stack deployment | Usually a frontend and API deployment with explicit auth/network contract |
| Decision driver | Small full-stack product team, API-based AI work | Python-skilled team or near-term substantial custom ML work |

Do not treat CPU-heavy model work as an ordinary async web request in either runtime. Model inference may need dedicated compute/GPU and a queue. FastAPI's in-process background tasks do not replace durable jobs that must survive restarts. The current Replit/GPU/provider assumptions must be revalidated if self-hosted models become scope.

If the user chooses FastAPI now, update ADR-001 and dependent data/auth/deployment contracts before coding. A reasonable Python variant is React/Next frontend, FastAPI/Pydantic API, SQLAlchemy/Alembic for PostgreSQL, and the same external 3DLOOK/payment boundaries. Do not operate competing Drizzle and Alembic ownership over the same schema without a deliberate migration plan.

## Authentication ownership

There are three distinct choices: a managed service such as Clerk; custom-branded/self-hosted authentication built on a maintained library; or homegrown password/token/session machinery. Recommend the second if the product owner wants to own the customer identity database and experience.

Preferred proposal for the retained Node stack: Better Auth, application-owned PostgreSQL identity/session tables, custom login UI, verified email and account-recovery workflows, and a transactional email provider. Clerk remains a valid managed alternative with lower infrastructure/maintenance ownership. The selection remains pending; this document supersedes the assumption that Clerk is settled.

Better Auth provides email/password and session/security capabilities, but the application still owns configuration, upgrades, abuse defenses, email deliverability, backup/recovery and incident handling. Do not promise zero operational cost or security simply because a library is used.

AUTH-001: If self-hosted authentication is accepted, use a maintained compatible authentication library and its supported password/session mechanisms. Do not implement new hashing, reset-token or session protocols from scratch. Store business customer IDs separately from library/provider identity IDs to preserve portability.

AUTH-002: Specify registration, email verification, login/logout, password reset, expiry, session revocation and account-deletion flows, including invalid/expired/reused tokens and duplicate-account handling. Reset responses must avoid account enumeration; tokens must be appropriately protected, time-limited and single-use. Define the exact session/token lifetime policy during the auth contract task.

AUTH-003: Use appropriate Secure/HttpOnly/SameSite cookies and CSRF/origin protections for the chosen architecture, HTTPS, server-side authorization, database-backed session revocation and shared rate-limit state across Autoscale instances. An in-memory limiter in one instance is not a global control. Configure trusted proxy headers for the deployed environment; do not blindly trust client-supplied IP headers.

AUTH-004: Require stronger authentication for privileged staff, with an approved recovery process. Customer MFA/passkeys may be introduced according to scope. Staff permissions remain application-owned and least-privilege. No role is granted solely because the client says it is an admin.

AUTH-005: Release self-hosted authentication only with recovery/email delivery tests, session/revocation checks, abuse controls, dependency update ownership, isolated environment secrets and a tested restore plan. Library tables/migrations must use the single controlled migration process. A custom login screen alone does not demonstrate a complete authentication implementation.

If FastAPI becomes the selected main backend, revisit the auth implementation deliberately. Better Auth is a TypeScript library; it must not be described as a native Python package or silently added as an unplanned extra auth service.

## Sources checked 2026-09-26

- [FastAPI features](https://fastapi.tiangolo.com/features/)
- [FastAPI async](https://fastapi.tiangolo.com/async/)
- [OpenAI TypeScript/JavaScript SDK](https://developers.openai.com/api/reference/typescript)
- [OpenAI Python SDK](https://developers.openai.com/api/reference/python)
- [Better Auth email/password](https://better-auth.com/docs/authentication/email-password)
- [Better Auth security](https://better-auth.com/docs/reference/security)
- [Better Auth rate limits](https://better-auth.com/docs/concepts/rate-limit)
- [OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP password recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
