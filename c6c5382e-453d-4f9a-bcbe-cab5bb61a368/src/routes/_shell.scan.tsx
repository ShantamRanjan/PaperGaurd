import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, FileUp, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/bits";
import { Logo } from "@/components/Logo";
import { documents } from "@/data/mock";
import { analyzeDocument } from "@/lib/paperguard-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/scan")({
  head: () => ({
    meta: [
      { title: "Scan a document | PaperGuard" },
      {
        name: "description",
        content:
          "Upload a photo or paste the text of a letter, bill or rent agreement and PaperGuard will check it.",
      },
      { property: "og:title", content: "Scan a document | PaperGuard" },
      {
        property: "og:description",
        content: "Upload or paste a document to get it checked in seconds.",
      },
    ],
  }),
  component: Scan,
});

const types = ["Rent agreement", "Landlord notice", "Bill", "Other"];

function Scan() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [tab, setTab] = useState("upload");
  const [type, setType] = useState(types[0]);
  const [noSave, setNoSave] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  const analyze = async () => {
    if (tab === "upload" && !file)
      return setError('Add a photo first, or switch to "Paste text instead".');
    if (tab === "paste" && text.trim().length < 20)
      return setError("That text is a bit short to check. Paste at least a full sentence.");
    setError("");
    setProcessing(true);
    try {
      const result = await analyzeDocument(
        tab === "upload" ? { file: file!, noSave } : { text, noSave },
      );
      await navigate({ to: "/document/$id", params: { id: result.doc.id } });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "PaperGuard could not analyze this document.",
      );
      setProcessing(false);
    }
  };

  if (processing) return <Processing />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Scan a document"
        text="We'll explain it, flag anything risky and pull out the dates."
      />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setError("");
        }}
      >
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-chip sm:inline-flex sm:w-auto">
          <TabsTrigger
            value="upload"
            className="h-auto min-h-10 whitespace-normal px-2 py-2 leading-tight"
          >
            Upload or take a photo
          </TabsTrigger>
          <TabsTrigger
            value="paste"
            className="h-auto min-h-10 whitespace-normal px-2 py-2 leading-tight"
          >
            Paste text instead
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="mt-4">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-sheet border-2 border-dashed bg-card px-6 py-14 text-center transition-colors focus-within:border-primary",
              drag ? "border-primary bg-secondary" : "hover:border-primary/60",
            )}
          >
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="grid h-14 w-14 place-items-center rounded-full bg-secondary text-secondary-foreground">
              <Camera className="h-6 w-6 md:hidden" aria-hidden />
              <FileUp className="hidden h-6 w-6 md:block" aria-hidden />
            </span>
            {file ? (
              <p className="mt-4 max-w-full break-all font-medium">{file.name}</p>
            ) : (
              <>
                <p className="mt-4 font-display text-lg font-semibold">
                  <span className="md:hidden">Take a photo of your document</span>
                  <span className="hidden md:inline">Drop a photo here</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  or tap to choose a file. JPG, PNG or WebP up to 10 MB.
                </p>
              </>
            )}
          </label>
        </TabsContent>
        <TabsContent value="paste" className="mt-4">
          <Label htmlFor="paste" className="sr-only">
            Document text
          </Label>
          <Textarea
            id="paste"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the text of your letter or agreement here"
            className="min-h-56 rounded-sheet bg-card p-4"
          />
        </TabsContent>
      </Tabs>

      <fieldset className="mt-6">
        <legend className="mb-2 text-sm font-medium">What kind of document is it?</legend>
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={cn(
                "rounded-chip border px-3 py-1.5 text-sm font-medium transition-colors",
                type === t
                  ? "border-primary bg-secondary text-secondary-foreground"
                  : "bg-card hover:border-primary/50",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="surface mt-6 flex items-center gap-3 p-4">
        <ShieldOff className="h-5 w-5 text-muted-foreground" aria-hidden />
        <div className="flex-1">
          <Label htmlFor="nosave" className="font-medium">
            No-save mode
          </Label>
          <p className="text-sm text-muted-foreground">
            We check it, show you the result, then forget it. Nothing is stored.
          </p>
        </div>
        <Switch id="nosave" checked={noSave} onCheckedChange={setNoSave} />
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-risk">
          {error}
        </p>
      )}
      <Button size="lg" className="mt-6 w-full" onClick={analyze}>
        Analyze
      </Button>
    </div>
  );
}

function Processing() {
  const doc = documents[0]!;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const a = setTimeout(() => setShown(1), 1100);
    const b = setTimeout(() => setShown(2), 1700);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center py-6 text-center"
      role="status"
      aria-live="polite"
    >
      <Logo variant="icon" className="h-14 w-14" />
      <h1 className="mt-4 text-2xl">Checking your document</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {shown
          ? `Found ${shown} thing${shown > 1 ? "s" : ""} to check so far.`
          : "Reading clauses and comparing them with the rulebook."}
      </p>
      <div className="paper-sheet relative mt-8 w-full overflow-hidden p-6 text-left">
        <ol className="space-y-2 font-serif text-[13px] leading-relaxed text-muted-foreground">
          {doc.lines.slice(2, 9).map((l, i) => {
            const hi =
              i === 4 && shown >= 1
                ? "mark-risk text-foreground"
                : i === 5 && shown >= 2
                  ? "mark-caution text-foreground"
                  : "";
            return (
              <li key={i}>
                <span className={cn("transition-colors duration-500", hi)}>{l}</span>
              </li>
            );
          })}
        </ol>
        <div
          className="animate-scan pointer-events-none absolute inset-x-0 h-0.5 bg-primary shadow-[0_0_16px_4px_var(--color-primary)]"
          aria-hidden
        />
      </div>
    </div>
  );
}
