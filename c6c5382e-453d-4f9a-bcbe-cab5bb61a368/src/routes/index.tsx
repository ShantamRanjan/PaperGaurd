import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, Check, Lock, ScanLine, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { DocumentSheet } from "@/components/DocumentSheet";
import { documents } from "@/data/mock";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PaperGuard | Your paperwork, checked, remembered, and chased" },
      {
        name: "description",
        content:
          "Scan a rent agreement or landlord notice. PaperGuard explains it, flags risky clauses with the exact quote, tracks deadlines and drafts your reply.",
      },
      {
        property: "og:title",
        content: "PaperGuard | Your paperwork, checked, remembered, and chased",
      },
      {
        property: "og:description",
        content:
          "Plain-English explanations, flagged clauses, deadline reminders and reply drafts for your paperwork.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const base = documents[0]!;
const demo = { ...base, lines: base.lines.slice(2, 8) };

const steps = [
  {
    icon: ScanLine,
    title: "Scan",
    text: "Snap a photo or paste the text of any letter, bill or agreement.",
  },
  {
    icon: ShieldCheck,
    title: "Check",
    text: "We compare every clause with a verified rulebook and quote what's risky.",
  },
  {
    icon: BellRing,
    title: "Remind",
    text: "Deadlines go on your list, and we nudge you before they slip.",
  },
];

const rows = [
  ["Checked against a verified rulebook", false],
  ["Remembers all your documents", false],
  ["Reminders that actually fire", false],
  ["Quotes the exact clause", "sometimes"],
  ["One photo and one button", false],
] as const;

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-5 sm:px-6">
        <Link to="/" className="min-w-0">
          <Logo textClassName="text-base min-[360px]:text-xl" />
        </Link>
        <nav className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link to="/dashboard">Open dashboard</Link>
          </Button>
          <Button asChild className="px-3 text-sm sm:px-4">
            <Link to="/scan">Scan a document</Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:pt-16">
          <div>
            <h1 className="text-4xl leading-[1.05] sm:text-6xl">
              Paperwork that watches your back.
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Scan a rent agreement or landlord notice. We explain it plainly, point at the risky
              lines, and remember every date for you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/scan">
                  <ScanLine /> Scan a document
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#how">See how it works</a>
              </Button>
            </div>
          </div>
          <div aria-label="Example: a rent agreement with two flagged clauses">
            <DocumentSheet doc={demo} />
          </div>
        </section>

        <section id="how" className="border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl">How it works</h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {steps.map(({ icon: Icon, title, text }) => (
                <div key={title}>
                  <Icon className="h-7 w-7 text-primary" aria-hidden />
                  <h3 className="mt-4 text-xl">{title}</h3>
                  <p className="mt-1 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl">Why not just ask a chatbot?</h2>
          <div className="surface mt-8 overflow-hidden">
            <table className="w-full table-fixed text-left text-xs min-[360px]:text-sm sm:text-base">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="w-1/2 p-2 font-medium text-muted-foreground sm:p-4">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th className="w-1/4 p-2 text-center font-medium sm:p-4">Chatbot</th>
                  <th className="w-1/4 break-words p-2 text-center font-display font-bold text-primary sm:p-4">
                    PaperGuard
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, bot]) => (
                  <tr key={label} className="border-b last:border-0">
                    <td className="break-words p-2 sm:p-4">{label}</td>
                    <td className="p-2 text-center text-muted-foreground sm:p-4">
                      {bot ? (
                        <span className="text-sm">Sometimes</span>
                      ) : (
                        <X className="mx-auto h-5 w-5" aria-label="No" />
                      )}
                    </td>
                    <td className="p-2 text-center sm:p-4">
                      <Check className="mx-auto h-5 w-5 text-safe" aria-label="Yes" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="surface flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
            <Lock className="h-6 w-6 text-safe" aria-hidden />
            <p className="flex-1 font-display text-lg font-semibold">
              Your documents stay yours. No-save mode available.
            </p>
            <Button variant="outline" asChild>
              <Link to="/scan">Try it without saving</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p className="text-sm text-muted-foreground">
            General information, not legal or financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
