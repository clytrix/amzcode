import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/**
 * Tracks whether the signed-in employee has at least one approved
 * job application. Used to gate task / earnings / withdrawal features
 * until the user is officially onboarded for a role.
 */
export function useJobApproval() {
  const { user } = useAuth();
  const [approved, setApproved] = useState<boolean | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) {
      setApproved(false); setPendingCount(0); setTotalCount(0); setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("job_applications")
      .select("status")
      .eq("user_id", user.id);
    const list = data || [];
    setApproved(list.some((a: any) => a.status === "approved"));
    setPendingCount(list.filter((a: any) => a.status === "pending" || a.status === "under_review").length);
    setTotalCount(list.length);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, [user?.id]);

  return { approved: approved === true, loading, pendingCount, totalCount, refresh };
}
