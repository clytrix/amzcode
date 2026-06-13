// Cron-triggered endpoint that generates monthly salary_disbursements rows
// for every active employment_packages user. Idempotent per (user, year, month).
//
// If the user's KYC is not approved, the row is created with status `held` and
// `hold_reason = 'KYC not approved'`. Overtime credits in `incentive_pocket`
// (still unclaimed for that month) are rolled in as `overtime_amount` and
// marked claimed by setting their `notes` to reference the disbursement.

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { sendEmailViaZepto } from "@/server/email";

const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://amzsolution.site").replace(/\/$/, "");

const OVERTIME_HOURLY_RATE = Number(process.env.OVERTIME_HOURLY_RATE || 100);

function shell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f3f3f3;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e7e7e7;border-radius:8px;overflow:hidden">
    <div style="background:#131A22;padding:18px 24px"><div style="color:#FF9900;font-weight:700;font-size:20px">AWZ<span style="color:#fff">.Jobs</span></div></div>
    <div style="padding:28px 24px"><h1 style="margin:0 0 12px;font-size:20px">${title}</h1>${body}</div>
    <div style="background:#f7f8fa;padding:14px 24px;border-top:1px solid #e7e7e7;font-size:12px;color:#565959;text-align:center">© AMZ.Jobs</div>
  </div></body></html>`;
}

export const Route = createFileRoute("/api/public/hooks/generate-salary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 });
        }
        const supabase = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Optional override: { year, month } in body — defaults to previous month.
        let bodyJson: { year?: number; month?: number } = {};
        try { bodyJson = await request.json(); } catch { /* empty body is fine */ }

        const today = new Date();
        const target = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const year = bodyJson.year ?? target.getFullYear();
        const month = bodyJson.month ?? target.getMonth() + 1;

        // Active packages
        const { data: packages, error } = await supabase
          .from("employment_packages")
          .select("id, user_id, monthly_salary, currency")
          .eq("is_active", true);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        if (!packages || packages.length === 0) {
          return new Response(JSON.stringify({ ok: true, generated: 0 }));
        }

        const userIds = packages.map((p) => p.user_id);
        const [{ data: kycRows }, { data: profiles }, { data: incentives }] = await Promise.all([
          supabase.from("kyc_submissions").select("user_id, status").in("user_id", userIds),
          supabase.from("profiles").select("id, email, full_name").in("id", userIds),
          supabase
            .from("incentive_pocket")
            .select("id, user_id, hours, amount, source, date, notes")
            .in("user_id", userIds)
            .gte("date", `${year}-${String(month).padStart(2, "0")}-01`)
            .lt(
              "date",
              `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`,
            ),
        ]);

        const kycMap = new Map((kycRows || []).map((k: any) => [k.user_id, k.status]));
        const pMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        const incMap = new Map<string, { hours: number; amount: number; ids: string[] }>();
        (incentives || []).forEach((row: any) => {
          if (row.notes && row.notes.startsWith("claimed:")) return;
          const cur = incMap.get(row.user_id) || { hours: 0, amount: 0, ids: [] };
          cur.hours += Number(row.hours || 0);
          cur.amount += Number(row.amount || 0);
          cur.ids.push(row.id);
          incMap.set(row.user_id, cur);
        });

        let generated = 0;
        const errors: string[] = [];
        for (const pkg of packages) {
          const inc = incMap.get(pkg.user_id) || { hours: 0, amount: 0, ids: [] };
          const overtimeAmount = inc.amount > 0 ? inc.amount : Math.round(inc.hours * OVERTIME_HOURLY_RATE);
          const basic = Number(pkg.monthly_salary);
          const net = basic + overtimeAmount;
          const kycOk = kycMap.get(pkg.user_id) === "approved";
          const status = kycOk ? "pending" : "held";
          const hold = kycOk ? null : "KYC not approved";

          const { error: insErr } = await supabase
            .from("salary_disbursements")
            .upsert(
              {
                user_id: pkg.user_id,
                package_id: pkg.id,
                period_year: year,
                period_month: month,
                basic_amount: basic,
                overtime_amount: overtimeAmount,
                bonus: 0,
                deductions: 0,
                net_amount: net,
                status,
                hold_reason: hold,
              },
              { onConflict: "user_id,period_year,period_month" },
            );
          if (insErr) {
            errors.push(`${pkg.user_id}: ${insErr.message}`);
            continue;
          }

          if (inc.ids.length > 0) {
            await supabase
              .from("incentive_pocket")
              .update({ notes: `claimed:${year}-${month}` })
              .in("id", inc.ids);
          }

          // Email notification
          const profile: any = pMap.get(pkg.user_id);
          if (profile?.email) {
            const periodLabel = new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
            try {
              if (kycOk) {
                await sendEmailViaZepto({
                  to: profile.email,
                  toName: profile.full_name || undefined,
                  subject: `Your ${periodLabel} salary is ready`,
                  html: shell(
                    `Salary for ${periodLabel}`,
                    `<p>Hi ${profile.full_name || "there"},</p>
                     <p>Your salary for <strong>${periodLabel}</strong> is ready:</p>
                     <ul>
                       <li>Base: ₹${basic.toLocaleString("en-IN")}</li>
                       <li>Overtime / incentives: ₹${overtimeAmount.toLocaleString("en-IN")}</li>
                       <li><strong>Net: ₹${net.toLocaleString("en-IN")}</strong></li>
                     </ul>
                     <p><a href="${SITE_URL}/dashboard/salary-slips" style="color:#FF9900;font-weight:bold">View salary slip →</a></p>`,
                  ),
                });
              } else {
                await sendEmailViaZepto({
                  to: profile.email,
                  toName: profile.full_name || undefined,
                  subject: `Action needed — ${periodLabel} salary on hold (KYC incomplete)`,
                  html: shell(
                    `Salary on hold — complete KYC`,
                    `<p>Hi ${profile.full_name || "there"},</p>
                     <p>Your salary of ₹${net.toLocaleString("en-IN")} for <strong>${periodLabel}</strong> is on hold because your KYC verification is not yet approved.</p>
                     <p><a href="${SITE_URL}/dashboard/withdrawals" style="color:#FF9900;font-weight:bold">Complete KYC to release payment →</a></p>`,
                  ),
                });
              }
            } catch (e: any) {
              errors.push(`mail ${pkg.user_id}: ${e?.message || "send failed"}`);
            }
          }
          generated++;
        }

        return new Response(JSON.stringify({ ok: true, generated, year, month, errors }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
