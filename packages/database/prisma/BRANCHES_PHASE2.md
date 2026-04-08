# Stage 1 — Branches, Phase 2 execution guide

Phase 1 added the branches infrastructure as **nullable + backfilled**.
Phase 2 promotes those columns to **NOT NULL**, adds the missing FKs and
secondary indexes, and rewires the slot engine + appointments service to
respect the new sucursal scoping.

This guide is the canonical "what to run, in what order" reference for
deploying phase 2.

## TL;DR

1. Make sure phase 1 is applied (`prisma migrate status` says
   `20260407120000_add_branches_phase1` is applied).
2. Pull the latest code so the API knows how to populate `branchId` on
   every insert.
3. Run `pnpm --filter @turnia/database prisma migrate dev` (local) or
   `prisma migrate deploy` (CI/prod). Phase 2
   (`20260407120100_add_branches_phase2`) will run automatically.
4. Restart the API process so the new code paths take effect at the
   same moment the schema is enforced.
5. Run the test suite + smoke test below to validate.

## Why a single ordered sequence

Phase 2 is **load-bearing**: the `SET NOT NULL` statements will fail
loudly if any row in `work_schedules`, `appointments` or `resources`
still has a NULL `branchId`. That is intentional — if phase 1 left a
hole, we want to know **before** the application starts assuming
non-nullability and silently dropping rows on insert.

It also matters that the application code is updated **before** phase 2
runs, because the migration drops the old `(tenantId, professionalId,
dayOfWeek)` unique on `work_schedules` and adds the new
`(branchId, professionalId, dayOfWeek)` one. Old code that inserted
work-schedule rows without a branchId would crash on insert; new code
populates branchId via `BranchesService.resolveBranchId`.

## Ordered checklist

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 1. PRE-FLIGHT                                                        │
├──────────────────────────────────────────────────────────────────────┤
│ a. git pull (you're already reading the new code)                    │
│ b. pnpm install                                                      │
│ c. pnpm --filter @turnia/database prisma migrate status              │
│    → must show 20260407120000_add_branches_phase1 as APPLIED         │
│ d. Sanity check no NULL branchId remains:                            │
│       SELECT COUNT(*) FROM work_schedules WHERE "branchId" IS NULL;  │
│       SELECT COUNT(*) FROM appointments   WHERE "branchId" IS NULL;  │
│       SELECT COUNT(*) FROM resources      WHERE "branchId" IS NULL;  │
│    All three must return 0. If not, re-run phase 1's backfill.       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ 2. APPLY THE MIGRATION                                               │
├──────────────────────────────────────────────────────────────────────┤
│ Local (dev):                                                         │
│   pnpm --filter @turnia/database prisma migrate dev                  │
│                                                                      │
│ CI / production:                                                     │
│   pnpm --filter @turnia/database prisma migrate deploy               │
│                                                                      │
│ Prisma will run 20260407120100_add_branches_phase2 in a single       │
│ transaction. If the SET NOT NULL fails, the whole migration rolls    │
│ back and the schema stays in phase-1 state — safe to retry after     │
│ fixing the offending NULL rows.                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ 3. RESTART THE API                                                   │
├──────────────────────────────────────────────────────────────────────┤
│ pnpm --filter @turnia/api start  (or whatever your process manager   │
│ uses). The new code paths require the new schema to be in place.    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ 4. VALIDATE                                                          │
├──────────────────────────────────────────────────────────────────────┤
│ a. Unit tests:                                                       │
│    pnpm --filter @turnia/api test                                    │
│    Pay attention to:                                                 │
│      - branches.service.spec.ts (resolveBranchId helpers)            │
│      - schedules.slots.spec.ts  (branch scoping + cross-branch guard)│
│      - appointments.service.spec.ts → "branch handling" describe     │
│      - appointments.reschedule.spec.ts → "branch handling" describe  │
│                                                                      │
│ b. Smoke test on a single-branch tenant — should keep working        │
│    without sending branchId at all:                                  │
│      curl 'https://api.local/api/v1/schedules/PRO_ID/slots?\         │
│            date=2026-04-15&serviceIds=SVC_ID' \                      │
│           -H 'X-Tenant-Slug: my-tenant'                              │
│      → 200, response.branchId === default branch id                  │
│                                                                      │
│ c. Smoke test on a multi-branch tenant — must FAIL without branchId  │
│    and SUCCEED with one:                                             │
│      curl '...slots?date=...&serviceIds=...' → 400                   │
│      curl '...slots?date=...&serviceIds=...&branchId=BR_ID' → 200    │
│                                                                      │
│ d. Cross-branch double-booking guard — book appointment at branch A, │
│    then try the same time at branch B for the same pro:             │
│      → second request returns 409 ConflictException                  │
└──────────────────────────────────────────────────────────────────────┘
```

## Roll-back plan

If something goes wrong **after** the migration applied:

1. The schema can be rolled back by running phase 1 in reverse — but
   honestly the safer fallback is to restore from the backup snapshot
   you took before step 2.
2. The application code is backwards-compatible with phase 1 in the
   sense that `branchId` is always populated. Code-only rollback (revert
   the API deployment) is safe **as long as** the schema is also rolled
   back, otherwise old code will try to insert rows without branchId
   and the new NOT NULL constraint will reject them.
3. Always: run a `pg_dump` before step 2 in production. The phase 2
   migration is small but irreversible without that snapshot.

## Where the new behavior lives

- `BranchesService.resolveBranchId` (single source of truth for branch
  resolution + single-branch fallback)
- `BranchesService.requireProfessionalInBranch` (auth check used by both
  the slot engine and the appointments writes)
- `SchedulesService.getAvailableSlots` (now branch-scoped for
  WorkSchedule lookup, branch-agnostic for the busy-appointment query)
- `AppointmentsService.create` and `.reschedule` (branchId resolved,
  validated, persisted)
- `AppointmentsService.findAll` (optional branchId filter for the
  agenda view)

The critical correctness rule — **busy appointments are queried by
professionalId only, never by branchId** — is asserted by tests in both
`schedules.slots.spec.ts` and `appointments.service.spec.ts` so a future
refactor that "tightens" the filter will fail the suite immediately.
