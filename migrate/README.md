# Migration Kit — Lovable Cloud → Your Supabase + Cloudflare Workers

Target project: `pwjybjpsvojmrdbdmssq` (https://pwjybjpsvojmrdbdmssq.supabase.co)

## Files in this kit

| File | What it is |
|---|---|
| `schema.sql` | All tables, types, RLS policies, functions, triggers (public schema) |
| `data.sql` | All row data as INSERT statements |
| `users.json` | 18 auth users (id, email, phone, metadata) — passwords NOT included |
| `storage-export/` | All bucket files (cv-uploads, payment-assets, etc.) |
| `import-users.mts` | Script to recreate users in your Supabase + send reset emails |
| `import-storage.mts` | Script to upload files to your Supabase storage |

## Step-by-step

### 1. Import the schema (5 min)

Open https://supabase.com/dashboard/project/pwjybjpsvojmrdbdmssq/sql → paste contents of `schema.sql` → Run.

If you see errors about extensions, run these first in a separate query:
```sql
create extension if not exists "pgcrypto";
create extension if not exists "pg_net";
```

### 2. Import the data (2 min)

Same SQL editor → paste `data.sql` → Run. (FKs are deferred via `--disable-triggers`.)

### 3. Recreate users + send reset emails (1 min)

```bash
cd /path/to/migration
bun add @supabase/supabase-js
TARGET_URL=https://pwjybjpsvojmrdbdmssq.supabase.co \
TARGET_SERVICE_KEY=eyJhbGc...q24Pviu... \
SITE_URL=https://amzsolution.site \
bun run import-users.mts
```

Each of the 18 users gets a password-reset email. **User IDs are preserved**, so all FKs (profiles, roles, KYC, wallets, tasks) stay valid.

### 4. Upload storage files (1 min)

```bash
TARGET_URL=https://pwjybjpsvojmrdbdmssq.supabase.co \
TARGET_SERVICE_KEY=eyJhbGc...q24Pviu... \
bun run import-storage.mts
```

### 5. Configure your Cloudflare Worker

Pull this Lovable project to GitHub (top-right → GitHub → Connect), then in your Cloudflare Worker dashboard set these env vars:

```
VITE_SUPABASE_URL=https://pwjybjpsvojmrdbdmssq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3anlianBzdm9qbXJkYmRtc3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NTY5NzUsImV4cCI6MjA5MjMzMjk3NX0.oDTPnUCAZBkN0mF9F1imd2_6njRc6Cj47u-VeHy6y-8
VITE_SUPABASE_PROJECT_ID=pwjybjpsvojmrdbdmssq
SUPABASE_URL=https://pwjybjpsvojmrdbdmssq.supabase.co
SUPABASE_PUBLISHABLE_KEY=<same as VITE_SUPABASE_PUBLISHABLE_KEY>
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...q24Pviu...
ZEPTOMAIL_API_TOKEN=PHtE6r0OFru9g2F88RYBs/TtEc+lNYx4qL80KQZFs4ZFCKQCHk0B/Yh4xzeyoh4sXKRGQqGTyIppsbvK5+PRd2zoNmxKCWqyqK3sx/VYSPOZsbq6x00UtVkddUTZU4Xme9Rr1y3Uv96X
ZEPTOMAIL_FROM_EMAIL=info@amzsolution.site
ZEPTOMAIL_FROM_NAME=AMZ.jobs
CRON_SECRET=<generate any random string>
```

You also need to override `src/integrations/supabase/client.ts` since Lovable auto-rewrites it. Easiest: pin those 3 values directly in that file before deploying:

```ts
const SUPABASE_URL = "https://pwjybjpsvojmrdbdmssq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGc...oDTPnUC...";
```

Then `wrangler deploy` from your machine.

### 6. Point amzsolution.site DNS at your Worker

Cloudflare → Workers → your-worker → Triggers → Custom Domains → add `amzsolution.site`.

## What about the Lovable Cloud backend?

Leave it running. If everything works on your Cloudflare deployment for a week, you can disable it from Connectors. **Do NOT delete it before then** — you have no other backup of the data.

## Caveats

- **Cron jobs** (`pg_cron` invoking `/api/public/hooks/*`) need to be re-created in your Supabase. The `invoke_cron_hook` function in `schema.sql` references the Lovable URL — edit it to point at your Worker URL before re-running.
- **Vault secrets** (`cron_secret`) are not exported. Re-add via `select vault.create_secret('your-cron-secret', 'cron_secret');`.
- **Storage RLS policies** on `storage.objects` are not in `schema.sql` (different schema). Re-create them from the Lovable migrations under `supabase/migrations/` in the repo.
