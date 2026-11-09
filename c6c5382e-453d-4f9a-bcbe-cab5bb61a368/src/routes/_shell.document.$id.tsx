import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarPlus, Copy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DocumentSheet } from "@/components/DocumentSheet";
import { SeverityChip } from "@/components/bits";
import { DeadlineItem } from "@/components/DeadlineItem";
import { docSeverity } from "@/data/mock";
import { calendarUrl, getDocument } from "@/lib/paperguard-api";

export const Route = createFileRoute("/_shell/document/$id")({
  loader: async ({ params }) => {
    try {
      return await getDocument(params.id);
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.doc.title} | PaperGuard` : "Document | PaperGuard" },
      {
        name: "description",
        content: loaderData?.doc.summary ?? "A checked document in PaperGuard.",
      },
      {
        property: "og:title",
        content: loaderData ? `${loaderData.doc.title} | PaperGuard` : "Document | PaperGuard",
      },
      {
        property: "og:description",
        content: loaderData?.doc.summary ?? "A checked document in PaperGuard.",
      },
      { property: "og:type", content: "article" },
    ],
  }),
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <h1 className="text-2xl">We couldn't find that document</h1>
      <p className="mt-2 text-muted-foreground">
        It may have been deleted or scanned in no-save mode.
      </p>
      <Button asChild className="mt-6">
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  ),
  component: DocumentPage,
});

function DocumentPage() {
  const { doc, deadlines: dls } = Route.useLoaderData();
  const [tone, setTone] = useState<"polite" | "firm">("polite");
  const [reply, setReply] = useState(doc.reply.polite);
  const [remind, setRemind] = useState<Record<string, boolean>>({});
  const sev = docSeverity(doc);
  const n = doc.flags.length;

  return (
    <article>
      <Link
        to="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="w-full break-words text-3xl sm:w-auto">{doc.title}</h1>
        <span className="rounded-chip border bg-card px-2 py-0.5 text-xs font-medium">
          {doc.type}
        </span>
        <SeverityChip
          severity={sev}
          label={n ? `${n} thing${n > 1 ? "s" : ""} to check` : "Looks fine"}
          className="text-sm"
        />
      </header>

      {n > 0 && (
        <p className="mb-3 text-sm text-muted-foreground md:hidden">
          Tap a highlighted line to see what it means.
        </p>
      )}
      <DocumentSheet doc={doc} />

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="text-xl">Plain-English summary</h2>
          <p className="mt-3 leading-relaxed">{doc.summary}</p>
        </section>
        <section className="surface p-5">
          <h2 className="text-xl">Key facts</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            {doc.facts.map((f, index) => (
              <div key={`${f.label}-${index}`}>
                <dt className="text-sm text-muted-foreground">{f.label}</dt>
                <dd className="break-words font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="surface p-5">
          <h2 className="text-xl">Deadlines</h2>
          {dls.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No dates to track in this document.
            </p>
          ) : (
            <ul className="mt-2 divide-y">
              {dls.map((d) => (
                <div key={d.id}>
                  <DeadlineItem deadline={d} />
                  <div className="flex flex-wrap items-center gap-4 pb-3">
                    <Button variant="outline" size="sm" asChild>
                      <a href={calendarUrl()} download>
                        <CalendarPlus /> Add to calendar
                      </a>
                    </Button>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={!!remind[d.id]}
                        onCheckedChange={(v) => {
                          setRemind((r) => ({ ...r, [d.id]: v }));
                          if (v) toast("We'll remind you 7, 2 and 1 days before.");
                        }}
                        aria-label={`Remind me about ${d.what}`}
                      />
                      Remind me
                    </label>
                  </div>
                </div>
              ))}
            </ul>
          )}
        </section>

        <section className="surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl">Draft reply</h2>
            <ToggleGroup
              type="single"
              value={tone}
              onValueChange={(v) => {
                if (v) {
                  setTone(v as "polite" | "firm");
                  setReply(doc.reply[v as "polite" | "firm"]);
                }
              }}
              aria-label="Reply tone"
            >
              <ToggleGroupItem value="polite" className="rounded-chip">
                Polite
              </ToggleGroupItem>
              <ToggleGroupItem value="firm" className="rounded-chip">
                Firm
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="mt-3 min-h-64 rounded-chip bg-background"
            aria-label="Reply text"
          />
          <Button
            className="mt-3"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(reply);
                toast.success("Reply copied. Paste it into your email.");
              } catch {
                toast.error("Couldn't copy. Select the text and copy it manually.");
              }
            }}
          >
            <Copy /> Copy reply
          </Button>
        </section>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        General information, not legal or financial advice.
      </p>
    </article>
  );
}
