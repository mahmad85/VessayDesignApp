# Specification change control

Status: proposed v0.2.

## Canonical information

DECISIONS.md owns accepted decisions and assumptions. PRD.md owns goals and product scope. UX files own customer interaction behavior. Domain files own catalog/measurement/order meaning. Architecture files own technical boundaries and internal contracts. 3DLOOK.md owns the vendor integration contract. ASSET-CONTRACT.md owns renderer/asset requirements. SECURITY-RELEASE.md owns operational controls. TRACEABILITY.md maps requirements to evidence without restating their meaning.

## Baseline procedure

Draft -> reviewed -> accepted baseline -> superseded. Record version, date, approving person, accepted decisions, unresolved questions, and what those questions block. Current v0.2 is draft; no reviewer approval is implied. A partial baseline may approve independent slices while clearly excluding unresolved dependencies.

## Change procedure

Describe problem, proposed change, affected requirement IDs/files, user-visible behavior, compatibility/data migration, costs, privacy/operational impact, acceptance changes and rollback. Update the decision log and canonical files in the same change. Do not leave conflicting copies across PRD and task descriptions.

Routine wording fixes and internal refactoring within approved behavior need no new product approval. Changes to scope, stack boundaries, required data, manufacturing interpretation, billing or customer promises need an explicit recorded decision. Current user instructions can authorize a change; do not ask for the same approval again merely because a template includes an approval field.

## Traceability and drift control

Each implementation change cites requirements and acceptance cases. Each requirement has a canonical source, proposed verification, implementation status and evidence reference. CI checks internal links, unknown requirement IDs, type/schema consistency and relevant tests once the repository exists. A manually checked Markdown box is not the sole enforcement mechanism.

Acceptance tests may change when the approved requirement changes. They must not be weakened to excuse a broken implementation. An agent discovering a genuine spec error should propose a correction with evidence rather than perpetuate it silently.

## Release evidence

Record commit, spec baseline, runtime/dependency versions, migration version, catalog/asset versions, prompt/model version, provider contract version and test environment. Mark evidence synthetic, sandbox or production. Keep credentials and sensitive customer data out of evidence attachments.
