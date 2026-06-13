import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Search, Briefcase, User as UserIcon, LogOut, LayoutDashboard } from "lucide-react";
import { useState } from "react";

export function PublicHeader() {
  const { user, isAdmin, signOut } = useAuth();
  return (
    <header className="bg-nav text-nav-foreground border-b border-border/10">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 rounded px-2 py-1 hover:opacity-90">
          <span className="bg-gradient-to-r from-primary to-brand bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">AMZ.Jobs</span>
        </Link>

        <div className="relative flex flex-1 max-w-md items-center overflow-hidden rounded-lg border border-border/20 bg-secondary/10 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search remote jobs, e.g. customer service…"
            className="h-10 w-full bg-transparent pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            aria-label="Search jobs"
          />
        </div>

        <div className="hidden items-center gap-4 text-sm md:flex">
          <Link to="/jobs" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-white/10 transition">
            <Briefcase className="h-4 w-4" /> Jobs
          </Link>
          {user ? (
            <>
              <Link to="/dashboard" className="rounded-md px-3 py-1.5 hover:bg-white/10 transition">
                <div className="text-xs text-nav-foreground/75">Hello, {user.email?.split("@")[0]}</div>
                <div className="font-bold leading-none mt-0.5">Dashboard</div>
              </Link>
              {isAdmin && (
                <Link to="/admin" className="rounded-md px-3 py-1.5 hover:bg-white/10 transition">
                  <div className="text-xs text-nav-foreground/75">Manage</div>
                  <div className="font-bold leading-none mt-0.5">Admin</div>
                </Link>
              )}
              <button onClick={() => signOut()} className="flex items-center gap-1.5 rounded-md px-3 py-2 hover:bg-white/10 transition text-destructive hover:text-destructive/80 font-medium cursor-pointer">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-md px-3 py-1.5 hover:bg-white/10 transition">
                <div className="text-xs text-nav-foreground/75">Welcome</div>
                <div className="font-bold leading-none mt-0.5">Sign In</div>
              </Link>
              <Link to="/signup" className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90 transition">
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile Navigation Actions */}
        <div className="flex items-center gap-2 md:hidden">
          <Link to="/jobs" className="rounded-md p-2 hover:bg-white/10 transition" aria-label="Jobs">
            <Briefcase className="h-5 w-5" />
          </Link>
          {user ? (
            <Link to="/dashboard" className="rounded-md p-2 hover:bg-white/10 transition" aria-label="Dashboard">
              <UserIcon className="h-5 w-5" />
            </Link>
          ) : (
            <Link to="/login" className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition">
              Sign In
            </Link>
          )}
        </div>
      </div>

      <div className="bg-nav-secondary border-t border-border/5">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2 text-sm text-nav-foreground/90 overflow-x-auto">
          <Link to="/jobs" className="rounded px-2.5 py-1 font-semibold hover:bg-white/10 transition">All Jobs</Link>
          <Link to="/jobs" search={{ category: "customer-service" } as any} className="whitespace-nowrap rounded px-2.5 py-1 hover:bg-white/10 transition">Customer Service</Link>
          <Link to="/jobs" search={{ category: "data-entry" } as any} className="whitespace-nowrap rounded px-2.5 py-1 hover:bg-white/10 transition">Data Entry</Link>
          <Link to="/jobs" search={{ category: "virtual-assistant" } as any} className="whitespace-nowrap rounded px-2.5 py-1 hover:bg-white/10 transition">Virtual Assistant</Link>
          <Link to="/jobs" search={{ category: "technical-support" } as any} className="whitespace-nowrap rounded px-2.5 py-1 hover:bg-white/10 transition">Technical Support</Link>
          <Link to="/jobs" search={{ category: "content-writing" } as any} className="whitespace-nowrap rounded px-2.5 py-1 hover:bg-white/10 transition">Content Writing</Link>
          <Link to="/jobs" search={{ category: "hr-recruitment" } as any} className="whitespace-nowrap rounded px-2.5 py-1 hover:bg-white/10 transition">HR / Recruitment</Link>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto bg-nav text-nav-foreground border-t border-border/10">
      <div className="bg-nav-secondary py-3 text-center text-sm">
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="rounded border border-white/20 px-6 py-2 hover:bg-white/10 transition">
          Back to top
        </button>
      </div>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-4">
        <div>
          <h3 className="mb-3 font-bold">Get to Know Us</h3>
          <ul className="space-y-2 text-sm text-nav-foreground/80">
            <li><Link to="/">About Us</Link></li>
            <li><Link to="/">Careers</Link></li>
            <li><Link to="/">Press</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-bold">Make Money With Us</h3>
          <ul className="space-y-2 text-sm text-nav-foreground/80">
            <li><Link to="/jobs">Browse Jobs</Link></li>
            <li><Link to="/signup">Become an Employee</Link></li>
            <li><Link to="/dashboard">Withdraw Earnings</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-bold">Help</h3>
          <ul className="space-y-2 text-sm text-nav-foreground/80">
            <li><Link to="/dashboard/tickets">Support Tickets</Link></li>
            <li><Link to="/dashboard/kyc">KYC Verification</Link></li>
            <li><Link to="/dashboard/salary-slips">Salary Slips</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-bold">Contact</h3>
          <p className="text-sm text-nav-foreground/80">support@novawork.co<br/>Mon-Fri 9am-6pm IST</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-nav-foreground/70">
        © {new Date().getFullYear()} AMZ.Jobs — Remote Work Opportunities
      </div>
    </footer>
  );
}
