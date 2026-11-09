import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CalendarClock, LayoutDashboard, ScanLine, Scale, Settings } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell")({ component: Shell });

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scan", label: "Scan", icon: ScanLine },
  { to: "/deadlines", label: "Deadlines", icon: CalendarClock },
  { to: "/rules", label: "Rules", icon: Scale },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function Sidebar({ path }: { path: string }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-sidebar px-3 py-5 md:flex">
      <Link to="/" className="mb-8 px-2">
        <Logo />
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {nav.map(({ to, label, icon: Icon }) => {
          const active = path.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-chip px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto px-2 text-xs text-muted-foreground">
        General information, not legal or financial advice.
      </p>
    </aside>
  );
}

function TabBar({ path }: { path: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5 items-end">
        {nav.map(({ to, label, icon: Icon }) => {
          const active = path.startsWith(to);
          if (to === "/scan")
            return (
              <li key={to} className="flex justify-center">
                <Link
                  to={to}
                  aria-label="Scan a document"
                  className="-mt-6 mb-1 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-sheet ring-4 ring-background"
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </Link>
              </li>
            );
          return (
            <li key={to}>
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium min-[360px]:text-[11px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Shell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar path={path} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <Link to="/">
            <Logo className="gap-1.5" textClassName="text-lg" />
          </Link>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-10">
          <Outlet />
        </main>
      </div>
      {!path.startsWith("/scan") && (
        <Link
          to="/scan"
          className="fixed bottom-6 right-6 z-40 hidden items-center gap-2 rounded-full bg-primary px-5 py-3 font-medium text-primary-foreground shadow-sheet hover:bg-primary/90 md:inline-flex"
        >
          <ScanLine className="h-4 w-4" aria-hidden /> Scan
        </Link>
      )}
      <TabBar path={path} />
    </div>
  );
}
