import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, TrendingUp, Users, UserCog, ScanLine, LogOut, SlidersHorizontal, Sparkles, Menu, X, Shield, Store, ArrowRightLeft, BellRing, Brain } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/use-auth";
import { useRepFilter } from "@/lib/rep-filter";
import { findRepByLooseName } from "@/lib/mock-data";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sales", label: "Sales", icon: TrendingUp },
  { to: "/pharmacy-performance", label: "HCO Analysis", icon: Store },
  { to: "/explore", label: "Explore", icon: SlidersHorizontal },
  { to: "/managers", label: "Managers", icon: UserCog },
  { to: "/reps", label: "Reps", icon: Users },
  { to: "/performance-analysis", label: "Performance Analysis", icon: Sparkles },
  { to: "/rx-analysis", label: "RX Analysis", icon: ScanLine },
  { to: "/insights", label: "Insights & Alerts", icon: BellRing },
] as const;

const adminItems = [
  { to: "/management", label: "Management", icon: Shield },
  { to: "/admin-team", label: "Team & Transfers", icon: ArrowRightLeft },
  { to: "/ai-training", label: "AI Training", icon: Brain },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, roles, signOut } = useAuth();
  const { myRep, scope } = useRepFilter();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  const metaName = (user?.user_metadata as { full_name?: string } | undefined)?.full_name;
  // Prefer the English DB rep name for rep-only users so the sidebar isn't
  // stuck on the Arabic auth-metadata full_name.
  const preferEnglish = scope === "rep" && myRep?.name ? myRep.name : null;
  const displayName = preferEnglish || metaName || user?.email?.split("@")[0] || "—";
  // Build initials from the Latin tokens of the chosen name (skips Arabic).
  const latinTokens = displayName.split(/\s+/).filter((t) => /[A-Za-z]/.test(t));
  const initialsSrc = latinTokens.length ? latinTokens : displayName.split(/\s+/);
  const initials = initialsSrc.map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const roleLabel = roles.includes("admin") ? "Admin" : (roles.includes("line_manager") || roles.includes("dm")) ? "District Manager" : roles.includes("rep") ? "Medical Rep" : "—";

  // Rep-only users see a restricted nav: their own page + 2 analysis tabs.
  const isRepOnly = scope === "rep";
  const repMockId = isRepOnly && myRep ? findRepByLooseName(myRep.name)?.id : null;
  const navItems = isRepOnly
    ? ([
        ...(repMockId ? [{ to: `/reps/${repMockId}`, label: "My Page", icon: LayoutDashboard }] : []),
        { to: "/performance-analysis", label: "Performance Analysis", icon: Sparkles },
        { to: "/rx-analysis", label: "RX Analysis", icon: ScanLine },
      ] as { to: string; label: string; icon: typeof LayoutDashboard }[])
    : (items as unknown as { to: string; label: string; icon: typeof LayoutDashboard }[]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-12 px-3 flex items-center justify-between bg-card/90 backdrop-blur border-b border-border">
        <button onClick={() => setOpen(true)} className="size-9 grid place-items-center rounded-md hover:bg-secondary" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg">💊</span>
          <span className="text-xs font-semibold">SYNAPS</span>
        </div>
        {user ? (
          <button onClick={() => signOut()} title="Sign out"
            className="size-9 grid place-items-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition"
            aria-label="Sign out">
            <LogOut className="size-4" />
          </button>
        ) : (
          <div className="size-9" />
        )}
      </div>
      {/* Mobile backdrop */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
      )}
      <aside
        className={
          (open ? "translate-x-0" : "-translate-x-full") +
          " md:translate-x-0 fixed md:sticky top-0 left-0 z-50 w-64 h-[100dvh] max-h-[100dvh] md:h-screen md:max-h-screen overflow-hidden border-r border-border bg-card flex flex-col shrink-0 transition-transform duration-200 md:bg-card/40 md:backdrop-blur-sm"
        }
      >
        <button
          onClick={() => setOpen(false)}
          className="md:hidden absolute top-3 right-3 size-8 grid place-items-center rounded-md hover:bg-secondary"
          aria-label="Close menu"
        >
          <X className="size-4" />
        </button>
      <div className="p-4 flex flex-col gap-1 bg-white">
        <div className="size-12 rounded-md bg-white ring-1 ring-border grid place-items-center overflow-hidden text-2xl">
          💊
        </div>
        <div className="mt-4">
          <h2 className="text-sm font-semibold tracking-tight">SYNAPS</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium text-[10px]">Pharma Sales Intelligence</p>
        </div>
      </div>
      <nav className="p-4 flex flex-col gap-1 bg-white flex-1 overflow-y-auto min-h-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || (item.to.startsWith("/reps/") && pathname.startsWith("/reps/"));
          return (
            <Link
              key={item.to}
              to={item.to as never}
              className={
                active
                  ? "flex items-center gap-3 px-3 py-2 bg-card ring-1 ring-black/5 rounded-md text-sm font-medium text-brand"
                  : "flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              }
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        {!isRepOnly && roles.includes("admin") && (
          <>
            <div className="my-2 border-t border-border" />
            <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Admin
            </p>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    active
                      ? "flex items-center gap-3 px-3 py-2 bg-card ring-1 ring-black/5 rounded-md text-sm font-medium text-brand"
                      : "flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>
      <div className="mt-auto p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-secondary grid place-items-center text-xs font-semibold">
            {initials || "?"}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{roleLabel}</p>
          </div>
        </div>
        {user && (
          <button
            onClick={() => signOut()}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        )}
      </div>
      </aside>
    </>
  );
}
