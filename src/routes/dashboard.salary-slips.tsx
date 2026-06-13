import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { inr } from "@/lib/currency";
import { JobRequiredGate } from "@/components/job-required-gate";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const Route = createFileRoute("/dashboard/salary-slips")({
  component: () => (
    <JobRequiredGate feature="Salary slips">
      <SlipsPage />
    </JobRequiredGate>
  ),
});

function SlipsPage() {
  const { user } = useAuth();
  const [slips, setSlips] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<{ salary: number; incentive: number }>({ salary: 0, incentive: 0 });

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      supabase.from("salary_disbursements").select("*").eq("user_id", user.id).order("period_year", { ascending: false }).order("period_month", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("wallets").select("salary_balance, incentive_balance").eq("user_id", user.id).maybeSingle(),
    ]).then(([s, p, w]) => {
      setSlips(s.data || []);
      setProfile(p.data);
      setWallet({
        salary: Number((w.data as any)?.salary_balance || 0),
        incentive: Number((w.data as any)?.incentive_balance || 0),
      });
    });
  }, [user]);

  const downloadPdf = (slip: any) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();

    // Header band
    doc.setFillColor(19, 26, 34);
    doc.rect(0, 0, pageW, 70, "F");
    doc.setTextColor(255, 153, 0);
    doc.setFontSize(22).setFont("helvetica", "bold");
    doc.text("AWZ", 40, 42);
    doc.setTextColor(255, 255, 255);
    doc.text(".Jobs", 78, 42);
    doc.setFontSize(11).setFont("helvetica", "normal");
    doc.text("SALARY SLIP / PAYSLIP", pageW - 40, 42, { align: "right" });

    // Period band
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14).setFont("helvetica", "bold");
    doc.text(`Pay period: ${MONTHS[slip.period_month - 1]} ${slip.period_year}`, 40, 100);
    doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(110);
    doc.text(`Generated: ${new Date(slip.created_at).toLocaleDateString("en-IN")}`, pageW - 40, 100, { align: "right" });

    // Employee details table
    autoTable(doc, {
      startY: 115,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [243, 244, 246], textColor: 30, fontStyle: "bold" },
      head: [["Employee details", ""]],
      body: [
        ["Name", profile?.full_name || "—"],
        ["Email", profile?.email || "—"],
        ["Phone", profile?.phone || "—"],
        ["Employee ID", (user?.id || "").slice(0, 8).toUpperCase()],
      ],
      columnStyles: { 0: { cellWidth: 140, fontStyle: "bold" } },
    });

    // Earnings/deductions invoice-style
    const startY = (doc as any).lastAutoTable.finalY + 12;
    autoTable(doc, {
      startY,
      theme: "striped",
      styles: { fontSize: 10, cellPadding: 7 },
      headStyles: { fillColor: [19, 26, 34], textColor: 255, fontStyle: "bold" },
      head: [["Description", "Amount (INR)"]],
      body: [
        ["Basic salary", fmt(slip.basic_salary)],
        ["Bonus / Incentive", fmt(slip.bonus)],
        ["Deductions (PF / TDS)", `- ${fmt(slip.deductions)}`],
      ],
      columnStyles: { 1: { halign: "right" } },
      foot: [["Net pay", fmt(slip.net_amount)]],
      footStyles: { fillColor: [255, 153, 0], textColor: 0, fontStyle: "bold", halign: "right" },
    });

    // Wallet breakdown
    const y2 = (doc as any).lastAutoTable.finalY + 12;
    autoTable(doc, {
      startY: y2,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
      head: [["Current wallet balance", "Amount (INR)"]],
      body: [
        ["Salary wallet (locked, payout via salary cycle)", fmt(wallet.salary)],
        ["Incentive wallet (withdrawable after KYC)", fmt(wallet.incentive)],
        ["Total available", fmt(wallet.salary + wallet.incentive)],
      ],
      columnStyles: { 1: { halign: "right" } },
    });

    if (slip.notes) {
      const y3 = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(9).setFont("helvetica", "bold");
      doc.text("Notes:", 40, y3);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(slip.notes, pageW - 80);
      doc.text(lines, 40, y3 + 14);
    }

    // Footer
    doc.setFontSize(8).setTextColor(120);
    doc.text(
      "This is a computer-generated salary slip and does not require a signature.",
      pageW / 2,
      doc.internal.pageSize.getHeight() - 30,
      { align: "center" },
    );

    doc.save(`salary-slip-${MONTHS[slip.period_month - 1]}-${slip.period_year}.pdf`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Salary Slips</h1>

      {/* Wallet breakdown card */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border bg-card p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-muted-foreground">Salary wallet</div>
          <div className="mt-1 text-2xl font-bold">{inr(wallet.salary, { decimals: true })}</div>
          <div className="text-[11px] text-muted-foreground">Released via monthly salary disbursement</div>
        </div>
        <div className="rounded-md border bg-card p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-muted-foreground">Incentive wallet</div>
          <div className="mt-1 text-2xl font-bold text-success">{inr(wallet.incentive, { decimals: true })}</div>
          <div className="text-[11px] text-muted-foreground">Withdrawable after KYC approval</div>
        </div>
        <div className="rounded-md border bg-card p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-muted-foreground">Total balance</div>
          <div className="mt-1 text-2xl font-bold">{inr(wallet.salary + wallet.incentive, { decimals: true })}</div>
        </div>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        {slips.length === 0 && <div className="p-6 text-sm text-muted-foreground">No salary slips yet. Slips appear here after each monthly salary cycle.</div>}
        {slips.map((s) => {
          const ageDays = Math.floor((Date.now() - new Date(s.created_at).getTime()) / 86400000);
          const expired = ageDays > 60;
          return (
            <div key={s.id} className="flex items-center justify-between border-b px-4 py-3 last:border-0">
              <div>
                <div className="font-bold">
                  {MONTHS[s.period_month - 1]} {s.period_year}
                  {expired && <span className="ml-2 rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive align-middle">Expired (60d)</span>}
                </div>
                <div className="text-xs text-muted-foreground">Net: <span className="font-bold text-success">{inr(s.net_amount)}</span> · Bonus: {inr(s.bonus)} · Deductions: {inr(s.deductions)}</div>
              </div>
              {expired ? (
                <span className="text-xs text-muted-foreground">Download unavailable</span>
              ) : (
                <AzButton size="sm" variant="brand" onClick={() => downloadPdf(s)}>Download PDF</AzButton>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmt(n: any) {
  return Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
