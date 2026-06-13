import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { adminReplyTicket, adminSetTicketStatus, adminDeleteTicket } from "@/server/admin.functions";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/tickets")({ component: AdminTickets });

function AdminTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState("");

  const load = async () => {
    let q = supabase.from("tickets").select("*").order("updated_at", { ascending: false });
    if (filter === "open") q = q.in("status", ["open", "in_progress"]);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setTickets([]); return; }
    const rows = (data as any[]) || [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      for (const p of (profs as any[]) || []) profileMap[p.id] = { full_name: p.full_name, email: p.email };
    }
    setTickets(rows.map((r) => ({ ...r, profiles: profileMap[r.user_id] || null })));
  };
  useEffect(() => { void load(); }, [filter]);

  const open = async (id: string) => {
    setActive(id);
    const { data } = await supabase.from("ticket_messages").select("*").eq("ticket_id", id).order("created_at");
    setMessages((data as any[]) || []);
  };

  const send = async () => {
    if (!active || !user || !reply.trim()) return;
    try {
      await adminReplyTicket({ data: { ticket_id: active, message: reply } });
      setReply("");
      void open(active);
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Could not send reply");
    }
  };

  const setStatus = async (id: string, status: "in_progress" | "resolved" | "closed") => {
    try {
      await adminSetTicketStatus({ data: { ticket_id: id, status } });
      toast.success(`Ticket ${status}`);
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Could not update status");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="rounded border border-input bg-white px-3 py-2 text-sm">
          <option value="open">Open / in progress</option>
          <option value="all">All tickets</option>
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <div className="rounded-md border bg-card shadow-sm">
          {tickets.length === 0 && <div className="p-6 text-sm text-muted-foreground">No tickets.</div>}
          {tickets.map((t) => (
            <button key={t.id} onClick={() => open(t.id)} className={`block w-full border-b px-3 py-2.5 text-left last:border-0 hover:bg-secondary/50 ${active === t.id ? "bg-secondary" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold text-sm">{t.subject}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold capitalize ${t.status === "open" ? "bg-warning/15 text-warning-foreground" : t.status === "resolved" ? "bg-success/15 text-success" : "bg-secondary"}`}>{t.status.replace(/_/g, " ")}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground truncate">{t.profiles?.full_name || t.profiles?.email} · {t.category}</div>
            </button>
          ))}
        </div>

        <div className="rounded-md border bg-card p-4 shadow-sm min-h-[300px]">
          {!active && <div className="text-sm text-muted-foreground">Select a ticket to view conversation.</div>}
          {active && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div className="font-bold">{tickets.find((t) => t.id === active)?.subject}</div>
                <div className="flex flex-wrap gap-1">
                  <AzButton size="sm" variant="outline" onClick={() => setStatus(active, "in_progress")}>In progress</AzButton>
                  <AzButton size="sm" variant="outline" onClick={() => setStatus(active, "resolved")}>Resolved</AzButton>
                  <AzButton size="sm" variant="outline" onClick={() => setStatus(active, "closed")}>Close</AzButton>
                  <AzButton
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm("Delete this ticket and all its messages? This cannot be undone.")) return;
                      try {
                        await adminDeleteTicket({ data: { ticket_id: active } });
                        toast.success("Ticket deleted");
                        setActive(null); setMessages([]);
                        void load();
                      } catch (e: any) { toast.error(e?.message || "Could not delete"); }
                    }}
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </AzButton>
                </div>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {messages.map((m) => (
                  <div key={m.id} className={`rounded px-3 py-2 text-sm ${m.is_admin_reply ? "bg-primary/15" : "bg-secondary/50"}`}>
                    <div className="text-xs font-bold mb-0.5">{m.is_admin_reply ? "Admin" : "User"} · {new Date(m.created_at).toLocaleString("en-IN")}</div>
                    <div className="whitespace-pre-wrap">{m.message}</div>
                  </div>
                ))}
                {messages.length === 0 && <div className="text-xs text-muted-foreground">No messages yet.</div>}
              </div>
              <div className="mt-3 space-y-2 border-t pt-3">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply…" rows={3} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
                <AzButton size="sm" variant="brand" onClick={send}>Send reply</AzButton>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
