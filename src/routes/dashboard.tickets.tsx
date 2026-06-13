import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/dashboard/tickets")({ component: TicketsPage });

function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [creating, setCreating] = useState(false);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [subject, setSubject] = useState(""); const [category, setCategory] = useState("general"); const [firstMsg, setFirstMsg] = useState("");

  const load = async () => {
    if (!user) return;
    const [{ data: ts }, { data: k }] = await Promise.all([
      supabase.from("tickets").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("kyc_submissions").select("status").eq("user_id", user.id).maybeSingle(),
    ]);
    setTickets(ts || []);
    setKycStatus(k?.status || null);
  };
  useEffect(() => { void load(); }, [user]);
  useEffect(() => {
    if (!open) return;
    void supabase.from("ticket_messages").select("*").eq("ticket_id", open).order("created_at").then(({ data }) => setMessages(data || []));
  }, [open]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { data: t, error } = await supabase.from("tickets").insert({ user_id: user.id, subject, category: category as any }).select().single();
    if (error || !t) return toast.error(error?.message || "Failed");
    await supabase.from("ticket_messages").insert({ ticket_id: t.id, sender_id: user.id, message: firstMsg, is_admin_reply: false });
    toast.success("Ticket created!");
    setCreating(false); setSubject(""); setFirstMsg("");
    void load();
  };

  const sendMsg = async () => {
    if (!user || !open || !newMsg.trim()) return;
    await supabase.from("ticket_messages").insert({ ticket_id: open, sender_id: user.id, message: newMsg, is_admin_reply: false });
    setNewMsg("");
    const { data } = await supabase.from("ticket_messages").select("*").eq("ticket_id", open).order("created_at");
    setMessages(data || []);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <AzButton variant="brand" onClick={() => setCreating(!creating)}>{creating ? "Cancel" : "+ New ticket"}</AzButton>
      </div>

      {kycStatus && kycStatus !== "approved" && kycStatus !== "documents_submitted" && kycStatus !== "fee_paid" && (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-primary/30 bg-[var(--gradient-hero)] p-5 text-primary-foreground shadow-[var(--shadow-elegant)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0" />
            <div>
              <div className="text-base font-bold">Complete your KYC to unlock withdrawals</div>
              <p className="text-sm opacity-90">
                Verify your identity and bank details so payouts can be processed instantly.
              </p>
            </div>
          </div>
          <Link to="/dashboard/kyc">
            <AzButton variant="brand" size="lg" className="bg-white text-primary hover:bg-white/90">
              Continue KYC →
            </AzButton>
          </Link>
        </div>
      )}
      {creating && (
        <form onSubmit={create} className="space-y-3 rounded-md border bg-card p-4 shadow-sm">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" required className="w-full rounded border border-input bg-white px-3 py-2" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded border border-input bg-white px-3 py-2">
            <option value="general">General</option><option value="kyc">KYC</option><option value="payment">Payment</option><option value="task">Task</option>
          </select>
          <textarea value={firstMsg} onChange={(e) => setFirstMsg(e.target.value)} placeholder="Describe your issue…" required rows={4} className="w-full rounded border border-input bg-white px-3 py-2" />
          <AzButton variant="brand">Create ticket</AzButton>
        </form>
      )}
      <div className="rounded-md border bg-card shadow-sm">
        {tickets.length === 0 && <div className="p-6 text-sm text-muted-foreground">No tickets yet.</div>}
        {tickets.map((t) => (
          <div key={t.id} className="border-b last:border-0">
            <button onClick={() => setOpen(open === t.id ? null : t.id)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-secondary/50">
              <div>
                <div className="font-bold">{t.subject}</div>
                <div className="text-xs text-muted-foreground">{t.category} · {new Date(t.created_at).toLocaleDateString()}</div>
              </div>
              <span className="rounded bg-secondary px-2 py-1 text-xs font-bold capitalize">{t.status}</span>
            </button>
            {open === t.id && (
              <div className="border-t bg-secondary/30 p-4">
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div key={m.id} className={`rounded px-3 py-2 text-sm ${m.is_admin_reply ? "bg-primary/15" : "bg-card"}`}>
                      <div className="text-xs font-bold text-muted-foreground">{m.is_admin_reply ? "Support" : "You"} · {new Date(m.created_at).toLocaleString()}</div>
                      <div>{m.message}</div>
                    </div>
                  ))}
                </div>
                {t.status !== "closed" && (
                  <div className="mt-3 flex gap-2">
                    <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Type a reply…" className="flex-1 rounded border border-input bg-white px-3 py-2 text-sm" />
                    <AzButton size="sm" variant="brand" onClick={sendMsg}>Send</AzButton>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
