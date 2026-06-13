import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getForceCapsSetting, setForceCapsSetting } from "@/lib/capitalize-settings";

interface Settings {
  officeName: string;
  branch: string;
  contact: string;
}

const KEY = "registry-settings";
const DEFAULTS: Settings = { officeName: "Registry Pro", branch: "Branch 042", contact: "" };

export const Route = createFileRoute("/dashboard/settings")({ component: SettingsPage });

function SettingsPage() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [forceCaps, setForceCapsState] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setS({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
    setForceCapsState(getForceCapsSetting());
  }, []);

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(s));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleForceCaps = (enabled: boolean) => {
    setForceCapsSetting(enabled);
    setForceCapsState(enabled);
    // Dispatch event so other components can listen for setting changes
    window.dispatchEvent(new Event("force-caps-changed"));
  };

  const reset = () => {
    if (!confirm("Clear ALL local data (records, tasks, documents)?")) return;
    ["registry-clients", "registry-leads", "registry-applications", "registry-customers", "registry-tasks", "registry-documents"].forEach((k) => localStorage.removeItem(k));
    alert("Data cleared. Reload to reseed.");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Office details and local data management.</p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Office name</Label>
          <Input value={s.officeName} onChange={(e) => setS({ ...s, officeName: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Branch</Label>
          <Input value={s.branch} onChange={(e) => setS({ ...s, branch: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Contact phone</Label>
          <Input value={s.contact} onChange={(e) => setS({ ...s, contact: e.target.value })} placeholder="9876543210" />
        </div>
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="space-y-0.5">
            <Label>Force capital letters</Label>
            <p className="text-xs text-muted-foreground">Automatically convert text inputs to uppercase</p>
          </div>
          <Switch checked={forceCaps} onCheckedChange={toggleForceCaps} />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={save}>Save changes</Button>
          {saved && <span className="text-sm text-success">Saved.</span>}
        </div>
      </div>

      <div className="rounded-xl border border-destructive/30 bg-card p-6 space-y-3">
        <h3 className="font-semibold text-destructive">Danger zone</h3>
        <p className="text-sm text-muted-foreground">Permanently delete all locally stored records and tasks.</p>
        <Button variant="destructive" onClick={reset}>Clear all data</Button>
      </div>
    </div>
  );
}
