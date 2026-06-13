import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Briefcase, ListChecks, Wallet,
  Banknote, Ticket, FileText, User as UserIcon, Clock, Lock, FolderKanban, Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useJobApproval } from "@/hooks/use-job-approval";

type NavItem = { to: string; label: string; Icon: typeof LayoutDashboard; end?: boolean; gated?: boolean };

// `gated: true` means item is hidden / locked until the employee has at least
// one APPROVED job application. Profile, KYC, Jobs and Applications stay
// available so they can complete onboarding first.
const items: NavItem[] = [
  { to: "/dashboard", label: "Overview", Icon: LayoutDashboard, end: true },
  { to: "/dashboard/applications", label: "My Applications", Icon: Briefcase },
  { to: "/dashboard/profile", label: "Profile", Icon: UserIcon },
  // Data Entry is the main earning feature - always visible
  { to: "/dashboard/data-entry", label: "Data Entry", Icon: FileText },
  { to: "/dashboard/data-entry/referral", label: "Referral Program", Icon: Users },
  // KYC link is intentionally hidden from the sidebar — it surfaces only
  // from the Withdrawals flow once the employee has unlocked salary cash-out.
  { to: "/dashboard/projects", label: "Projects", Icon: FolderKanban, gated: true },
  { to: "/dashboard/tasks", label: "My Tasks", Icon: ListChecks, gated: true },
  { to: "/dashboard/attendance", label: "Attendance", Icon: Clock, gated: true },
  { to: "/dashboard/earnings", label: "Salary & Incentives", Icon: Wallet, gated: true },
  { to: "/dashboard/withdrawals", label: "Withdrawals", Icon: Banknote, gated: true },
  { to: "/dashboard/salary-slips", label: "Salary Slips", Icon: FileText, gated: true },
  { to: "/dashboard/tickets", label: "Support Tickets", Icon: Ticket },
];

export function DashboardSidebarNav() {
  const loc = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { approved } = useJobApproval();

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b bg-card/60 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--gradient-brand)] text-primary-foreground shadow-sm">
            <Wallet className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-bold">Employee Hub</div>
              <div className="text-[11px] text-muted-foreground">Remote Work Portal</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Workspace</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(({ to, label, Icon, end, gated }) => {
                const locked = gated && !approved;
                const active = end
                  ? loc.pathname === to
                  : loc.pathname === to || loc.pathname.startsWith(to + "/");
                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={collapsed ? (locked ? `${label} (locked)` : label) : undefined}
                      className={
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                          : locked
                          ? "opacity-50 hover:bg-sidebar-accent"
                          : "hover:bg-sidebar-accent"
                      }
                    >
                      <Link to={locked ? "/dashboard" : to} aria-disabled={locked}>
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{label}</span>
                        {locked && <Lock className="h-3 w-3 opacity-60" />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
