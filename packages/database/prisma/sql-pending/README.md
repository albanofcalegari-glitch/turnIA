# sql-pending

SQL files in this folder are **not** auto-applied by `prisma migrate`.
They are staged for manual execution at a later phase, once the
application code that depends on them is also ready.

## branches_phase2.sql — DEPRECATED

The phase 2 SQL has been moved into a real Prisma migration:

```
prisma/migrations/20260407120100_add_branches_phase2/migration.sql
```

Apply it the normal way:

```bash
npx prisma migrate dev      # local
npx prisma migrate deploy   # CI / prod
```

Both phases (phase 1 backfill + phase 2 NOT NULL + new unique) will
run in order automatically. Do NOT execute the file in this folder
manually anymore — it is kept only as a historical placeholder.
