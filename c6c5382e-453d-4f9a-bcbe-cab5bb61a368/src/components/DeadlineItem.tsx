import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { daysUntil, formatDate, type Deadline } from "@/data/mock";

export function urgency(d: Deadline) {
  const n = daysUntil(d.due);
  if (d.done)
    return {
      status: "done" as const,
      label: "Done",
      tone: "text-safe bg-safe-soft",
      bar: "bg-safe",
    };
  if (n < 0)
    return {
      status: "overdue" as const,
      label: `${-n} day${n === -1 ? "" : "s"} overdue`,
      tone: "text-risk bg-risk-soft",
      bar: "bg-risk",
    };
  if (n <= 7)
    return {
      status: "open" as const,
      label: n === 0 ? "Due today" : `${n} day${n === 1 ? "" : "s"} left`,
      tone: "text-foreground bg-caution-soft",
      bar: "bg-caution",
    };
  return {
    status: "open" as const,
    label: `${n} days left`,
    tone: "text-secondary-foreground bg-secondary",
    bar: "bg-primary",
  };
}

export function DoneCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors",
        checked
          ? "animate-pop border-safe bg-safe text-primary-foreground"
          : "border-border bg-card hover:border-primary",
      )}
    >
      {checked && (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" className="animate-draw-check" />
        </svg>
      )}
    </button>
  );
}

export function DeadlineItem({
  deadline,
  onToggle,
  documentTitle,
}: {
  deadline: Deadline;
  onToggle?: () => void;
  documentTitle?: string | undefined;
}) {
  const u = urgency(deadline);
  return (
    <li className="flex items-center gap-3 py-3">
      {onToggle ? (
        <DoneCheck
          checked={!!deadline.done}
          onChange={onToggle}
          label={`Mark "${deadline.what}" as done`}
        />
      ) : (
        <span className={cn("h-10 w-1.5 shrink-0 rounded-full", u.bar)} aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", deadline.done && "text-muted-foreground line-through")}>
          {deadline.what}
        </p>
        {documentTitle && (
          <Link
            to="/document/$id"
            params={{ id: deadline.docId }}
            className="truncate text-sm text-muted-foreground hover:text-primary"
          >
            {documentTitle}
          </Link>
        )}
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{formatDate(deadline.due)}</p>
        <span className={cn("inline-block rounded-chip px-2 py-0.5 text-xs font-medium", u.tone)}>
          {u.label}
        </span>
      </div>
    </li>
  );
}
