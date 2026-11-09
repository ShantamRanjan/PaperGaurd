import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SeverityChip } from "@/components/bits";
import { rules } from "@/data/mock";

export const Route = createFileRoute("/_shell/rules")({
  head: () => ({
    meta: [
      { title: "Rules | PaperGuard" },
      { name: "description", content: "The verified rulebook PaperGuard uses to check rent agreements and landlord notices." },
      { property: "og:title", content: "Rules | PaperGuard" },
      { property: "og:description", content: "The verified rulebook behind every PaperGuard check." },
    ],
  }),
  component: Rules,
});

function Rules() {
  return (
    <>
      <PageHeader title="Rulebook" text="Every check we run on rent agreements comes from this list. Each rule is reviewed by a person." />
      {rules.length === 0 ? <p className="text-muted-foreground">No rules published yet.</p> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rules.map((r) => (
            <li key={r.id} className="surface p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg leading-tight">{r.name}</h2>
                <SeverityChip severity={r.severity} label={r.severity === "risk" ? "High risk" : r.severity === "caution" ? "Caution" : "Informational"} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{r.text}</p>
              <p className="mt-3 text-xs text-muted-foreground">Source: {r.source}. {r.reviewed}.</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
