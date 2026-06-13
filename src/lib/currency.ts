// Currency utilities for the AMZ.Jobs.
// Salaries and earnings are paid in INR. The KYC processing/security-deposit
// fee is quoted in USD ($10) with an INR conversion shown alongside.

const toNumber = (amount: number | string | null | undefined): number => {
  const n = Number(amount ?? 0);
  return Number.isFinite(n) ? n : 0;
};

// Format a number as Indian Rupees, e.g. 12500 -> "₹12,500"
export function inr(amount: number | string | null | undefined, opts: { decimals?: boolean } = {}): string {
  const n = toNumber(amount);
  const formatted = n.toLocaleString("en-IN", {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  });
  return `₹${formatted}`;
}

// Format a number as US Dollars, e.g. 79 -> "$79"
export function usd(amount: number | string | null | undefined, opts: { decimals?: boolean } = {}): string {
  const n = toNumber(amount);
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  });
  return `$${formatted}`;
}

// Conversion rate (USD -> INR). Static fallback when the live FX feed is
// unavailable. Live rate is fetched via `useUsdInrRate()` server-side.
export const USD_TO_INR_RATE = 95;

// KYC fee in USD and its INR equivalent (rounded to nearest 10).
export const KYC_FEE_USD = 10;
export const KYC_FEE_INR = Math.round((KYC_FEE_USD * USD_TO_INR_RATE) / 10) * 10;

// Convert a USD amount to INR using the current rate.
export function usdToInr(amount: number): number {
  return Math.round((amount * USD_TO_INR_RATE) / 10) * 10;
}

// Combined display: "$10 (≈ ₹950)"
export function priceWithInr(amountUsd: number): string {
  return `${usd(amountUsd)} (≈ ${inr(usdToInr(amountUsd))})`;
}

// Convenience for the KYC fee everywhere.
export function kycFeeDisplay(): string {
  return priceWithInr(KYC_FEE_USD);
}

// Backward-compat: KYC_FEE used to be the INR amount. Keep export pointing to
// the INR-equivalent so older imports keep compiling, but new code should use
// KYC_FEE_USD or kycFeeDisplay().
export const KYC_FEE = KYC_FEE_INR;
