import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doc, Flag } from "@/data/mock";
import { SeverityChip } from "./bits";

export function MarginNote({ flag, compact }: { flag: Flag; compact?: boolean }) {
  return (
    <article className={cn("surface p-4", compact && "border-0 shadow-none p-0 bg-transparent")}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-base leading-tight">{flag.title}</h4>
        <SeverityChip severity={flag.severity} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{flag.explanation}</p>
      <blockquote
        className={cn(
          "mt-3 border-l-2 pl-3 text-sm italic",
          flag.severity === "risk" ? "border-risk" : "border-caution",
        )}
      >
        “{flag.quote}”
      </blockquote>
      <a
        href="/rules"
        className="mt-3 inline-block break-words text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Source: {flag.source}
      </a>
    </article>
  );
}

function Highlighted({
  line,
  flag,
  onOpen,
  markRef,
}: {
  line: string;
  flag: Flag | undefined;
  onOpen: () => void;
  markRef: (el: HTMLElement | null) => void;
}) {
  if (!flag) return <>{line}</>;
  const i = line.indexOf(flag.quote);
  const before = i >= 0 ? line.slice(0, i) : "";
  const quote = i >= 0 ? flag.quote : line;
  const after = i >= 0 ? line.slice(i + flag.quote.length) : "";
  const cls = flag.severity === "risk" ? "mark-risk" : "mark-caution";
  return (
    <>
      {before}
      <button
        type="button"
        ref={markRef}
        onClick={onOpen}
        className={cn(
          cls,
          "inline px-0.5 text-left [box-decoration-break:clone] lg:cursor-default",
        )}
        aria-label={`Open note: ${flag.title}`}
      >
        {quote}
      </button>
      {after}
    </>
  );
}

/** Annotated paper sheet with margin notes. Notes sit beside flagged lines on desktop, open in a sheet on mobile. */
export function DocumentSheet({
  doc,
  showNotes = true,
  className,
}: {
  doc: Doc;
  showNotes?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState<Flag | null>(null);
  const flagFor = (line: string) => doc.flags.find((f) => line.includes(f.quote));
  const wide = showNotes && doc.flags.length > 0;
  const root = useRef<HTMLDivElement>(null);
  const marks = useRef<Record<string, HTMLElement | null>>({});
  const notes = useRef<Record<string, HTMLDivElement | null>>({});
  const [layout, setLayout] = useState<
    { id: string; markY: number; noteY: number; markX: number }[]
  >([]);
  const [minH, setMinH] = useState(0);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!wide) return;
    const compute = () => {
      const r = root.current?.getBoundingClientRect();
      if (!r) return;
      let cursor = 0;
      const out: typeof layout = [];
      for (const f of doc.flags) {
        const m = marks.current[f.id]?.getBoundingClientRect();
        const n = notes.current[f.id];
        if (!m || !n) continue;
        const markY = m.top - r.top + 12;
        const noteY = Math.max(markY - 24, cursor);
        cursor = noteY + n.offsetHeight + 16;
        out.push({ id: f.id, markY, noteY, markX: m.right - r.left });
      }
      setLayout(out);
      setMinH(cursor);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (root.current) ro.observe(root.current);
    return () => ro.disconnect();
  }, [doc, wide]);

  return (
    <div
      className={cn("relative", className)}
      ref={root}
      style={wide ? { minHeight: minH } : undefined}
    >
      <div
        className={cn("paper-sheet relative px-5 py-6 sm:px-8 sm:py-8", wide && "lg:mr-[20rem]")}
      >
        <p className="mb-4 break-words font-display text-sm font-semibold text-muted-foreground">
          {doc.from}
        </p>
        <ol className="space-y-2.5 font-serif text-[15px] leading-relaxed">
          {doc.lines.map((line, idx) => {
            const flag = flagFor(line);
            return (
              <li key={idx}>
                <Highlighted
                  line={line}
                  flag={flag}
                  onOpen={() => flag && (!wide || window.innerWidth < 1024) && setOpen(flag)}
                  markRef={(el) => {
                    if (flag) marks.current[flag.id] = el;
                  }}
                />
              </li>
            );
          })}
        </ol>
      </div>
      {wide && (
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            {layout.map((l) => {
              const f = doc.flags.find((x) => x.id === l.id)!;
              const x2 = (root.current?.offsetWidth ?? 0) - 18 * 16;
              const y2 = l.noteY + 24;
              const color = f.severity === "risk" ? "var(--color-risk)" : "var(--color-caution)";
              return (
                <g key={l.id}>
                  <circle cx={l.markX + 6} cy={l.markY} r={3.5} fill={color} />
                  <path
                    d={`M${l.markX + 6} ${l.markY} C ${x2 - 30} ${l.markY}, ${x2 - 40} ${y2}, ${x2} ${y2}`}
                    stroke={color}
                    strokeWidth={1}
                    fill="none"
                  />
                </g>
              );
            })}
          </svg>
          {doc.flags.map((f) => {
            const l = layout.find((x) => x.id === f.id);
            return (
              <div
                key={f.id}
                ref={(el) => {
                  notes.current[f.id] = el;
                }}
                className="pointer-events-auto absolute right-0 w-[18rem] transition-[top] duration-300"
                style={{ top: l?.noteY ?? 0, visibility: l ? "visible" : "hidden" }}
              >
                <MarginNote flag={f} />
              </div>
            );
          })}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-black/70"
            aria-label="Close clause note"
            onClick={() => setOpen(null)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="clause-note-title"
            aria-describedby="clause-note-description"
            className="fixed inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-sheet border bg-background p-5 pb-8 shadow-sheet"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 id="clause-note-title" className="text-lg font-semibold">
                  {open.title}
                </h2>
                <p id="clause-note-description" className="text-sm text-muted-foreground">
                  Note about this clause
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border bg-card"
                aria-label="Close clause note"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <MarginNote flag={open} compact />
          </section>
        </div>
      )}
    </div>
  );
}
