import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Severity } from "@/data/mock";
import { Logo } from "./Logo";

const sevStyles: Record<Severity, string> = {
  risk: "bg-risk-soft text-risk",
  caution: "bg-caution-soft text-foreground",
  safe: "bg-safe-soft text-safe",
};
const sevLabel: Record<Severity, string> = { risk: "High risk", caution: "Worth checking", safe: "Looks fine" };
const sevIcon = { risk: OctagonAlert, caution: AlertTriangle, safe: CheckCircle2 };

export function SeverityChip({ severity, label, className }: { severity: Severity; label?: string; className?: string }) {
  const Icon = sevIcon[severity];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-chip px-2 py-0.5 text-xs font-medium", sevStyles[severity], className)}>
      <Icon className={cn("h-3.5 w-3.5", severity === "caution" && "text-caution")} aria-hidden />
      {label ?? sevLabel[severity]}
    </span>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode }) {
  return (
    <div className="surface flex items-start gap-3 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-chip bg-secondary text-secondary-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-bold tracking-tight">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="surface flex flex-col items-center px-6 py-10 text-center">
      <Logo variant="icon" className="h-14 w-14 opacity-90" />
      <h3 className="mt-4 text-lg">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl">{title}</h1>
        {text && <p className="mt-1 text-muted-foreground">{text}</p>}
      </div>
      {children}
    </div>
  );
}
