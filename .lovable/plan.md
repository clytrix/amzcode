## Plan

### 1. Revert OTP / email changes (auth.functions.ts)
Restore `createAndSendOtp` to its previous form: remove the 60-second cooldown and 5/hour burst limit added recently. Keep the rest of the auth flow exactly as it was. No other email subsystem changes.

### 2. Fix admin support tickets not displaying
Root cause: `admin.tickets.tsx` query uses `profiles:user_id(...)` embed which fails because there is no FK between `tickets.user_id` and `profiles.id`. Fix by:
- Fetching tickets without the embed, then loading profile rows separately by `user_id` and merging client-side.
- Same fix for ticket messages where applicable.

### 3. Salary slip — 60-day expiry + admin delete
- The `purge_old_salary_slips()` function already exists. Add a daily cron job to call it.
- In `dashboard.salary-slips.tsx`: hide / disable download for slips older than 60 days and show "Expired" badge.
- In `admin.salary-slips.tsx`: add a Delete (trash) action wired to a new `adminDeleteSalarySlip` server function (admin-only).

### 4. Cron — guarantee daily data-entry pool rotation + salary purge
Schedule (or replace) cron jobs that call existing SECURITY DEFINER functions:
- `rollover_data_entry_pool()` — daily 00:05 IST
- `accrue_daily_salary()` — daily 00:10 IST
- `purge_old_salary_slips()` — daily 03:00 IST
Use `pg_cron` with direct SQL calls (Option 1 — no HTTP needed).

### 5. UPI QR — delete option in admin settings
In `admin.settings.tsx`, add a "Remove QR image" button next to the upload that clears the stored URL in `platform_settings` and deletes the file from the `payment-assets` bucket.

### 6. Admin re-KYC option
In `admin.employees.$userId.tsx` (and KYC admin page), add a "Reset / Request re-KYC" action: server function flips that user's KYC submission back to `not_started` (or creates a new submission row) and clears review fields. Audit-logged.

### 7. Bank accounts in user profile (add/remove + KYC seed)
- Trigger `seed_bank_account_from_kyc` already exists.
- Add a "Bank accounts" section in `dashboard.profile.tsx`:
  - List user's `bank_accounts`
  - Add new bank account form (label, holder, bank name, account number, IFSC, UPI, set as primary)
  - Delete account button (cannot delete the only primary)
  - "Set as primary" action (uses existing `enforce_single_primary_bank_account` trigger)

### 8. Change email & password in profile
In `dashboard.profile.tsx`:
- "Change password" form — uses `supabase.auth.updateUser({ password })`.
- "Change email" form — uses `supabase.auth.updateUser({ email })` (Supabase sends confirmation to new email automatically).

### 9. Expanded job application form + admin display
Update `dashboard.applications.tsx` (apply form) to collect:
- Required: contact email OR contact whatsapp (validated by existing `validate_job_application` trigger), CV upload (to `cv-uploads` bucket → `cv_path`), expected salary
- Optional: GitHub URL, LinkedIn URL, cover letter, experience

Update `admin.applications.tsx` to display all of these plus a download link for the CV (signed URL).

### 10. Wallet / income / withdrawal hardening
- Withdrawals: minimum already enforced by `validate_withdrawal_minimum` trigger. Add server-side checks in withdrawal create function:
  - KYC must be `approved`
  - Sufficient balance in chosen wallet (salary or incentive)
  - Bank account or UPI must exist (use primary bank account by default)
- Admin withdrawals page: approve action debits wallet via `wallet_transactions` (atomic), reject action just updates status — both use admin server functions and write audit log entries.

### 11. Import legacy data
Run the provided INSERT statements via the database insert tool. Notes:
- `auth.users` rows for these UUIDs must exist; if not, those `profiles` inserts fail silently due to FK. We'll first attempt a direct insert; for any user IDs that fail, we'll create minimal `auth.users` shells via the admin API in a one-off server script and retry.
- Skip `fx_rates` SQL as written (column names don't match current schema — `from_currency`/`to_currency` vs `base`/`quote`); insert a corrected row instead.
- KYC document storage files are NOT in this DB; references will exist as paths only (broken until files are re-uploaded). User has been informed of this in their migration note.

### 12. Security scan
Re-run security scan after changes; fix any new "warn" findings introduced.

### Technical notes
- Migrations needed: new server functions (`adminDeleteSalarySlip`, `adminResetKyc`, withdrawal validation), cron job creation SQL.
- Files touched (estimate):
  - `src/server/auth.functions.ts` (revert)
  - `src/server/admin.functions.ts` (+ deleteSlip, resetKyc, qrDelete, withdrawal approve/reject)
  - `src/server/wallet.functions.ts` (withdrawal create hardening)
  - `src/routes/admin.tickets.tsx` (fix join)
  - `src/routes/admin.settings.tsx` (QR delete)
  - `src/routes/admin.salary-slips.tsx` (delete button)
  - `src/routes/admin.employees.$userId.tsx` (reset KYC)
  - `src/routes/admin.applications.tsx` (display new fields + CV)
  - `src/routes/admin.withdrawals.tsx` (approve/reject hardening)
  - `src/routes/dashboard.profile.tsx` (bank accounts, change email/password)
  - `src/routes/dashboard.applications.tsx` (expanded apply form)
  - `src/routes/dashboard.salary-slips.tsx` (60-day expiry UI)
  - One migration for cron jobs
  - Data import via insert tool

Proceed?