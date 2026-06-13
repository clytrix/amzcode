import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Briefcase, FileText, Users, ListChecks,
  ShieldCheck, Banknote, Ticket, ScrollText, UserCog, Crown, Clock, BarChart3, Mail, FolderKanban, ClipboardCheck, Shield, FileSearch, Settings,
  Package, CreditCard, TrendingUp,
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

type NavItem = { to: string; label: string; Icon: typeof LayoutDashboard; end?: boolean };

const items: NavItem[] = [
  { to: "/admin", label: "Overview", Icon: LayoutDashboard, end: true },
  { to: "/admin/analytics", label: "Performance", Icon: BarChart3 },
  { to: "/admin/jobs", label: "Jobs", Icon: Briefcase },
  { to: "/admin/applications", label: "Applications", Icon: FileText },
  { to: "/admin/employees", label: "Employees", Icon: Users },
  { to: "/admin/projects", label: "Projects", Icon: FolderKanban },
  { to: "/admin/tasks", label: "Tasks", Icon: ListChecks },
  { to: "/admin/data-entry", label: "Data Entry Pool", Icon: ClipboardCheck },
  { to: "/admin/data-entry-packages", label: "DE Packages", Icon: Package },
  { to: "/admin/data-entry-subscriptions", label: "DE Subscriptions", Icon: CreditCard },
  { to: "/admin/data-entry-analytics", label: "DE Analytics", Icon: TrendingUp },
  { to: "/admin/review", label: "Review Queue", Icon: ClipboardCheck },
  { to: "/admin/attendance", label: "Attendance", Icon: Clock },
  { to: "/admin/kyc", label: "KYC Reviews", Icon: ShieldCheck },
  { to: "/admin/withdrawals", label: "Withdrawals", Icon: Banknote },
  { to: "/admin/tickets", label: "Tickets", Icon: Ticket },
  { to: "/admin/salary-slips", label: "Salary Slips", Icon: ScrollText },
  { to: "/admin/salary-disbursements", label: "Salary Disbursements", Icon: Banknote },
  { to: "/admin/email-templates", label: "Email Templates", Icon: Mail },
  { to: "/admin/roles", label: "Admin Roles", Icon: UserCog },
  { to: "/admin/security", label: "Security", Icon: Shield },
  { to: "/admin/audit-logs", label: "Audit Logs", Icon: FileSearch },
  { to: "/admin/settings", label: "Settings", Icon: Settings },
];

export function AdminSidebarNav() {
  const loc = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b bg-card/60 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--gradient-hero)] text-nav-foreground shadow-sm">
            <Crown className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-bold">Admin Panel</div>
              <div className="text-[11px] text-muted-foreground">Full platform control</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Manage</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(({ to, label, Icon, end }) => {
                const active = end
                  ? loc.pathname === to
                  : loc.pathname === to || loc.pathname.startsWith(to + "/");
                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={collapsed ? label : undefined}
                      className={
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                          : "hover:bg-sidebar-accent"
                      }
                    >
                      <Link to={to}>
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
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
