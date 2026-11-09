import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/bits";
import { DeadlineItem, urgency } from "@/components/DeadlineItem";
import type { Deadline, Doc } from "@/data/mock";
import { getDeadlines, getDocuments, setDeadlineDone } from "@/lib/paperguard-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/deadlines")({
  head: () => ({
    meta: [
      { title: "Deadlines | PaperGuard" },
      {
        name: "description",
        content:
          "Every date from your paperwork in one list or calendar, with reminders before they slip.",
      },
      { property: "og:title", content: "Deadlines | PaperGuard" },
      {
        property: "og:description",
        content: "Every date from your paperwork, in a list or calendar.",
      },
    ],
  }),
  component: Deadlines,
});

function Deadlines() {
  const [view, setView] = useState("list");
  const [items, setItems] = useState<Deadline[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([getDeadlines(true), getDocuments()])
      .then(([nextItems, nextDocuments]) => {
        if (active) {
          setItems(nextItems);
          setDocuments(nextDocuments);
        }
      })
      .catch(
        (cause) =>
          active && setError(cause instanceof Error ? cause.message : "Could not load deadlines."),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);
  const toggle = async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    const done = !current.done;
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, done } : x)));
    try {
      await setDeadlineDone(id, done);
    } catch (cause) {
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, done: !!current.done } : x)));
      setError(cause instanceof Error ? cause.message : "Could not update the deadline.");
    }
  };
  const sorted = [...items].sort(
    (a, b) => Number(!!a.done) - Number(!!b.done) || a.due.localeCompare(b.due),
  );

  return (
    <>
      <PageHeader title="Deadlines" text="Tick things off as you handle them.">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v)}
          aria-label="View"
        >
          <ToggleGroupItem value="list" className="rounded-chip">
            <List className="h-4 w-4" /> List
          </ToggleGroupItem>
          <ToggleGroupItem value="calendar" className="rounded-chip">
            <CalendarDays className="h-4 w-4" /> Month
          </ToggleGroupItem>
        </ToggleGroup>
      </PageHeader>
      {error && (
        <p role="alert" className="mb-4 text-sm font-medium text-risk">
          {error}
        </p>
      )}
      {loading ? (
        <Skeleton className="h-80 rounded-sheet" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No deadlines yet"
          text="When a document has a due date, it shows up here automatically."
        />
      ) : view === "list" ? (
        <ul className="surface divide-y px-5">
          {sorted.map((d) => (
            <DeadlineItem
              key={d.id}
              deadline={d}
              documentTitle={documents.find((doc) => doc.id === d.docId)?.title}
              onToggle={() => toggle(d.id)}
            />
          ))}
        </ul>
      ) : (
        <MonthView items={items} />
      )}
    </>
  );
}

function MonthView({ items }: { items: Deadline[] }) {
  const now = new Date();
  const [offset, setOffset] = useState(0);
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const startPad = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const iso = (d: number) =>
    `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const todayIso = now.toISOString().slice(0, 10);
  return (
    <div className="surface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setOffset((o) => o - 1)}
          className="rounded-chip px-3 py-1 text-sm hover:bg-muted"
          aria-label="Previous month"
        >
          Previous
        </button>
        <h2 className="text-lg">
          {month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </h2>
        <button
          onClick={() => setOffset((o) => o + 1)}
          className="rounded-chip px-3 py-1 text-sm hover:bg-muted"
          aria-label="Next month"
        >
          Next
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`p${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
          const due = items.filter((x) => x.due === iso(d));
          return (
            <div
              key={d}
              className={cn(
                "min-h-16 rounded-chip border p-1 text-left sm:min-h-24",
                iso(d) === todayIso && "border-primary",
              )}
            >
              <span className="text-xs font-medium">{d}</span>
              <div className="mt-1 space-y-1">
                {due.map((x) => (
                  <div
                    key={x.id}
                    title={x.what}
                    className={cn(
                      "truncate rounded px-1 text-[10px] font-medium sm:text-xs",
                      urgency(x).tone,
                    )}
                  >
                    <span className="hidden sm:inline">{x.what}</span>
                    <span className="sm:hidden">•</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
