## Pull Request Title

<!-- Format: <type>: [UTB-<n>] <Ticket Summary> (e.g. feat: [UTB-13] Checkout, orders and payment webhooks) -->

## Summary of Changes

<!-- High-level bulleted summary of features, fixes, or configurations implemented. -->

## Database & Migration Audit (Mandatory)

<!-- Explicitly list ALL database changes. Document exactly what migrations were run and detail schema changes line-by-line. If none, write "None". -->

- **Migrations Run:**
- **Schema Changes:**

## Seed Data

<!-- Clearly list what database seeds were added, updated, or modified during the ticket. If none, write "None". -->

## Proof of Work

<!-- Paste command outputs demonstrating passing verification. -->

### 1. Verification Commands

- `pnpm lint`:
- `pnpm typecheck`:
- `pnpm test`:
- `pnpm build`:

### 2. Architecture Visualization (`pnpm graphify`)

```text
<!-- Paste graphify output here -->
```

### 3. UI Screenshots / Verification

<!-- If applicable, paste UI screenshots or terminal curl / health verification -->

## README Updates

- [ ] Task / module-specific README created or updated
- [ ] Relevant parent README updated (e.g. `apps/README.md`, `packages/README.md`, `infra/README.md`)
- [ ] Global root `README.md` maintained and up to date

## Definition of Done Checklist

- [ ] All ticket acceptance criteria met.
- [ ] Lint, typecheck, unit, and integration tests pass in CI.
- [ ] Migrations apply and revert cleanly; `db:check` passes.
- [ ] Workspace architecture updated (`pnpm graphify` runs cleanly).
- [ ] No new dependency added without a one-line justification.
- [ ] No `TODO` without a ticket key; no dead code or commented-out blocks.
- [ ] Protected endpoints adhere to security guards and Zod contract validation.
- [ ] Reviewed and approved by module owner.
