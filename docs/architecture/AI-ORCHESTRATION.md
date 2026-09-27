# Consultation orchestration

Status: draft v0.2. Requirements AI-001 to AI-006.

AI-001: The assistant MUST interpret preferences and explain recommendations while deterministic application services own product validity, price, measurement readiness and order transitions. It cannot invent inventory or declare a paid/submitted order without a successful authorized command.

## Consultation context

Each turn includes the current accepted configuration/revision, structured preferences, relevant catalog results, remaining decisions, and a bounded conversation summary. Store canonical conversation and preferences in the application database. A provider conversation ID is supplemental, not the only source of state.

Proposed tools: SearchCompatibleFabrics, GetProductOptions, ExplainOption, ProposeChange, ApplyAuthorizedSelection, GetRemainingDecisions. Tools call the same domain services used by direct controls. Keep order submission and payment under explicit customer actions with exact review revisions. Automated review produces structured findings; a deterministic application policy controls checkout eligibility. AI must not waive measurement/manufacturing blockers or mark payment successful.

AI-002: Tools MUST validate argument schema, customer authorization, catalog existence, compatibility and expected revision. Strict structured outputs enforce shape, not truth or business correctness. Tool results identify committed revision and errors. Unsupported requests return available alternatives or a clarification question.

AI-003: Suggested options MUST remain pending until accepted. Explicit commands such as use this fabric authorize the identified draft change. Ambiguous requests must be clarified. A category change that removes accepted options requires a clear impact confirmation.

AI-004: The assistant MUST retain multiple preferences expressed together, avoid repeating answered questions, and ask one useful missing question at a time. Questions about budget/deadline should occur early when those constraints could invalidate recommendations. Explanations use verified catalog attributes and customer preferences, not demographic assumptions.

## Reliability and cost

Bound each turn by tool count, timeout and token budget selected during evaluation. Tool failures produce a recoverable response, not invented success. Allow direct-control continuation during provider failure. Version prompts, tool schemas and model configuration; changing model/prompt requires regression evaluation.

AI-005: Catalog text, user uploads and chat content MUST be treated as untrusted data, not instructions permitting tool escalation. Only allowlisted application operations execute. Avoid giving the assistant unrestricted SQL, shell, production admin access or raw body-photo access for styling consultation.

AI-006: Maintain an evaluation set covering multi-intent input, corrections, contradictions, unknown fabrics, budget conflict, unavailable stock, stale response, provider failure and attempts to override catalog/permission rules. Assess task completion, correct extraction, grounded recommendations, latency and cost. Model choice remains configurable and must be justified by evidence.

## Sources checked 2026-09-26

- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

The proposed API is Responses through the official JavaScript SDK. No specific model is frozen by this document; model evaluation is an implementation preparation task.
