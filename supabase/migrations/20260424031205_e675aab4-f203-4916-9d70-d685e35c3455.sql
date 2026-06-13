
-- Switch defaults to INR (₹) and Indian KYC fee (₹799)
ALTER TABLE public.kyc_submissions ALTER COLUMN fee_amount SET DEFAULT 799;
ALTER TABLE public.jobs ALTER COLUMN salary_currency SET DEFAULT 'INR';

-- Backfill existing data so users see consistent values
UPDATE public.kyc_submissions SET fee_amount = 799 WHERE fee_amount = 79 OR fee_amount IS NULL;
UPDATE public.jobs SET salary_currency = 'INR' WHERE salary_currency = 'USD' OR salary_currency IS NULL;
