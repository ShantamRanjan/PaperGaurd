import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  FileText,
  Flag,
  Mail,
  Receipt,
  ScrollText,
  Wifi,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, SeverityChip, StatCard } from "@/components/bits";
import { DeadlineItem } from "@/components/DeadlineItem";
import {
  daysUntil,
  docSeverity,
  formatDate,
  type Deadline,
  type Doc,
  type DocType,
} from "@/data/mock";
import { getDeadlines, getDocuments } from "@/lib/paperguard-api";

export const Route = createFileRoute("/_shell/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | PaperGuard" },
      {
        name: "description",
        content:
          "Everything PaperGuard is watching for you: flagged documents, upcoming deadlines and all your paperwork.",
      },
      { property: "og:title", content: "Dashboard | PaperGuard" },
      {
        property: "og:description",
        content: "Flagged documents, upcoming deadlines and all your paperwork in one place.",
      },
    ],
  }),
  component: Dashboard,
});

export const typeIcon: Record<DocType, typeof FileText> = {
  "Rent agreement": ScrollText,
  "Landlord notice": Mail,
  Bill: Receipt,
  Contract: Wifi,
  Other: Landmark,
};

const order = { risk: 0, caution: 1, safe: 2 };

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([getDocuments(), getDeadlines(false)])
      .then(([nextDocs, nextDeadlines]) => {
        if (active) {
          setDocs(nextDocs);
          setDeadlines(nextDeadlines);
        }
      })
      .catch(
        (cause) =>
          active && setError(cause instanceof Error ? cause.message : "Could not load PaperGuard."),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const flagged = docs
    .filter((d) => d.flags.length)
    .sort((a, b) => order[docSeverity(a)] - order[docSeverity(b)]);
  const upcoming = deadlines
    .filter((d) => !d.done && daysUntil(d.due) <= 30)
    .sort((a, b) => a.due.localeCompare(b.due));
  const next = upcoming.find((d) => daysUntil(d.due) >= 0);
  const issues = docs.reduce((n, d) => n + d.flags.length, 0);

  if (!loading && docs.length === 0)
    return (
      <>
        <PageHeader title="Good afternoon, Priya" />
        <EmptyState
          title="Nothing here yet"
          text="Scan your first letter, bill or agreement and we'll start watching it for you."
          action={
            <Button asChild>
              <Link to="/scan">Scan your first document</Link>
            </Button>
          }
        />
      </>
    );

  return (
    <>
      <PageHeader
        title="Good afternoon, Priya"
        text="Here's what PaperGuard is keeping an eye on."
      />

      {error && (
        <p role="alert" className="mb-4 text-sm font-medium text-risk">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[88px] rounded-sheet" />)
        ) : (
          <>
            <StatCard
              label="Documents tracked"
              value={docs.length}
              icon={<FileText className="h-5 w-5" />}
            />
            <StatCard label="Issues flagged" value={issues} icon={<Flag className="h-5 w-5" />} />
            <StatCard
              label="Next deadline"
              value={next ? `${daysUntil(next.due)} days` : "None"}
              hint={next?.what}
              icon={<CalendarClock className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="text-xl">Needs attention</h2>
          {loading ? (
            <ListSkeleton />
          ) : flagged.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Nothing needs your attention right now.
            </p>
          ) : (
            <ul className="mt-2 divide-y">
              {flagged.map((d) => (
                <li key={d.id}>
                  <Link
                    to="/document/$id"
                    params={{ id: d.id }}
                    className="flex items-start gap-3 rounded-chip py-3 hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{d.title}</p>
                      <p className="truncate text-sm text-muted-foreground">{d.flags[0]?.title}</p>
                    </div>
                    <SeverityChip severity={docSeverity(d)} label={`${d.flags.length} to check`} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">Upcoming deadlines</h2>
            <Link to="/deadlines" className="text-sm font-medium text-primary hover:underline">
              See all
            </Link>
          </div>
          {loading ? (
            <ListSkeleton />
          ) : upcoming.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No deadlines in the next 30 days.</p>
          ) : (
            <ul className="mt-2 divide-y">
              {upcoming.map((d) => (
                <DeadlineItem
                  key={d.id}
                  deadline={d}
                  documentTitle={docs.find((doc) => doc.id === d.docId)?.title}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-xl">All documents</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-sheet" />)
            : docs.map((d) => {
                const Icon = typeIcon[d.type];
                return (
                  <Link
                    key={d.id}
                    to="/document/$id"
                    params={{ id: d.id }}
                    className="surface flex flex-col gap-3 p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid h-9 w-9 place-items-center rounded-chip bg-secondary text-secondary-foreground">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <SeverityChip
                        severity={docSeverity(d)}
                        label={
                          d.flags.length
                            ? `${d.flags.length} issue${d.flags.length > 1 ? "s" : ""}`
                            : "No issues"
                        }
                      />
                    </div>
                    <div>
                      <p className="font-medium">{d.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Scanned {formatDate(d.scannedOn)}
                      </p>
                    </div>
                  </Link>
                );
              })}
        </div>
      </section>
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-4 space-y-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-12 rounded-chip" />
      ))}
    </div>
  );
}
