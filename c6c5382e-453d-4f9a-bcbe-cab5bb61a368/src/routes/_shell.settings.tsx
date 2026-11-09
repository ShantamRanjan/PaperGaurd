import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/bits";

export const Route = createFileRoute("/_shell/settings")({
  head: () => ({
    meta: [
      { title: "Settings | PaperGuard" },
      { name: "description", content: "Choose when PaperGuard reminds you, your language and theme, and manage your data." },
      { property: "og:title", content: "Settings | PaperGuard" },
      { property: "og:description", content: "Reminders, language, theme and data controls." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [days, setDays] = useState<Record<number, boolean>>({ 7: true, 2: true, 1: true });
  const [email, setEmail] = useState("priya@example.com");
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const setTheme = (v: boolean) => {
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
    localStorage.setItem("pg-theme", v ? "dark" : "light");
  };
  const emailOk = /^\S+@\S+\.\S+$/.test(email);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" />
      <section className="surface p-5">
        <h2 className="text-lg">Reminders</h2>
        <p className="text-sm text-muted-foreground">Remind me before a deadline:</p>
        <div className="mt-3 flex flex-wrap gap-5">
          {[7, 2, 1].map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!days[d]} onCheckedChange={(v) => setDays((s) => ({ ...s, [d]: !!v }))} />
              {d} day{d > 1 ? "s" : ""} before
            </label>
          ))}
        </div>
        <div className="mt-5">
          <Label htmlFor="email">Send reminders to</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 rounded-chip" aria-invalid={!emailOk} />
          {!emailOk && <p className="mt-1 text-sm text-risk">That email looks incomplete. Check it has an @ and a domain, like name@example.com.</p>}
        </div>
      </section>

      <section className="surface mt-4 space-y-5 p-5">
        <h2 className="text-lg">Preferences</h2>
        <div>
          <Label>Language</Label>
          <Select defaultValue="en">
            <SelectTrigger className="mt-1.5 rounded-chip" aria-label="Language"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="hi">हिन्दी</SelectItem>
              <SelectItem value="ta">தமிழ்</SelectItem>
              <SelectItem value="mr">मराठी</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span><span className="font-medium">Dark theme</span><span className="block text-sm text-muted-foreground">Easier on the eyes at night.</span></span>
          <Switch checked={dark} onCheckedChange={setTheme} />
        </label>
        <Button onClick={() => toast.success("Settings saved")}>Save settings</Button>
      </section>

      <section className="surface mt-4 p-5">
        <h2 className="text-lg">Your data</h2>
        <p className="mt-1 text-sm text-muted-foreground">Remove every document, deadline and reply draft from PaperGuard.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" className="mt-4">Delete all my data</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete everything?</AlertDialogTitle>
              <AlertDialogDescription>This removes all 5 documents, their deadlines and drafts. You can't undo this.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep my data</AlertDialogCancel>
              <AlertDialogAction onClick={() => toast("All your data has been deleted.")}>Yes, delete everything</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
