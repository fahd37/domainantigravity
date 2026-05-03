"use client";

import { useState } from "react";
import { saveSettings } from "@/app/actions/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

export function SettingsForm({ initialSettings }: { initialSettings: Record<string, string> }) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [testingNc, setTestingNc] = useState(false);
  const [testingDfs, setTestingDfs] = useState(false);
  const [testResult, setTestResult] = useState<{ type: string; success: boolean; msg: string } | null>(null);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(settings);
    setSaving(false);
    // Ideally add a toast here
  };

  const handleTestConnection = async (type: string) => {
    if (type === "namecheap") setTestingNc(true);
    if (type === "dataforseo") setTestingDfs(true);

    const payload =
      type === "namecheap"
        ? { apiKey: settings["nc_api_key"], apiUser: settings["nc_api_user"] }
        : { email: settings["dfs_email"], password: settings["dfs_password"] };

    try {
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload }),
      });
      const data = await res.json();
      setTestResult({ type, success: data.success, msg: data.message });
    } catch (e) {
      console.error(e);
      setTestResult({ type, success: false, msg: "Connection failed" });
    }

    if (type === "namecheap") setTestingNc(false);
    if (type === "dataforseo") setTestingDfs(false);
  };

  const maskValue = (val?: string) => (val ? "••••••••••••••••" : "");

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold leading-none tracking-tight">Namecheap API</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>API User</Label>
              <Input
                value={settings["nc_api_user"] || ""}
                onChange={(e) => handleChange("nc_api_user", e.target.value)}
                placeholder="Namecheap Username"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder={maskValue(settings["nc_api_key"])}
                onChange={(e) => handleChange("nc_api_key", e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Sandbox Mode</Label>
            </div>
            <Switch
              checked={settings["nc_sandbox"] === "true"}
              onCheckedChange={(c) => handleChange("nc_sandbox", c.toString())}
            />
          </div>
          <div className="pt-4 flex items-center gap-4">
            <button
              onClick={() => handleTestConnection("namecheap")}
              disabled={testingNc}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              {testingNc ? "Testing..." : "Test Connection"}
            </button>
            {testResult?.type === "namecheap" && (
              <span className={`text-sm ${testResult.success ? "text-green-500" : "text-red-500"}`}>
                {testResult.msg}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold leading-none tracking-tight">DataForSEO API</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={settings["dfs_email"] || ""}
                onChange={(e) => handleChange("dfs_email", e.target.value)}
                placeholder="Email Address"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder={maskValue(settings["dfs_password"])}
                onChange={(e) => handleChange("dfs_password", e.target.value)}
              />
            </div>
          </div>
          <div className="pt-4 flex items-center gap-4">
            <button
              onClick={() => handleTestConnection("dataforseo")}
              disabled={testingDfs}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              {testingDfs ? "Testing..." : "Test Connection"}
            </button>
            {testResult?.type === "dataforseo" && (
              <span className={`text-sm ${testResult.success ? "text-green-500" : "text-red-500"}`}>
                {testResult.msg}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold leading-none tracking-tight">Other Integrations</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Cloudflare API Token</Label>
            <Input
              type="password"
              placeholder={maskValue(settings["cf_api_token"])}
              onChange={(e) => handleChange("cf_api_token", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Resend API Key</Label>
            <Input
              type="password"
              placeholder={maskValue(settings["resend_api_key"])}
              onChange={(e) => handleChange("resend_api_key", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Majestic API Key</Label>
            <Input
              type="password"
              placeholder={maskValue(settings["majestic_key"]) || "Leave blank to use free tier"}
              onChange={(e) => handleChange("majestic_key", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use free tier — gives limited but sufficient TF/CF data for pass/fail toxicity checks.
            </p>
          </div>
          <div className="space-y-2">
            <Label>GoDaddy API Key</Label>
            <Input
              type="password"
              placeholder={maskValue(settings["gd_api_key"]) || "GoDaddy API Key"}
              onChange={(e) => handleChange("gd_api_key", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>GoDaddy API Secret</Label>
            <Input
              type="password"
              placeholder={maskValue(settings["gd_api_secret"]) || "GoDaddy API Secret"}
              onChange={(e) => handleChange("gd_api_secret", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Required for auto-bidding on GoDaddy auctions. Get from developer.godaddy.com.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Anthropic API Key</Label>
            <Input
              type="password"
              placeholder={maskValue(settings["anthropic_api_key"]) || "sk-ant-..."}
              onChange={(e) => handleChange("anthropic_api_key", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Powers AI content generation for bought domains. Get from console.anthropic.com.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Google Service Account Key (JSON)</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder={maskValue(settings["google_sa_key"]) || "Paste service account JSON here..."}
              onChange={(e) => handleChange("google_sa_key", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Required for Google Search Console sitemap submission + URL indexing API.
            </p>
          </div>
          <div className="space-y-2">
            <Label>ICANN Username</Label>
            <Input
              type="text"
              placeholder={settings["icann_username"] || "your@email.com"}
              onChange={(e) => handleChange("icann_username", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>ICANN Password</Label>
            <Input
              type="password"
              placeholder={maskValue(settings["icann_password"]) || "ICANN CZDS password"}
              onChange={(e) => handleChange("icann_password", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Register free at czds.icann.org to download .com/.net zone files (50k+ domains/day source).
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold leading-none tracking-tight">Crawler Defaults</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between">
              <Label>Buy Threshold (Score)</Label>
              <span className="text-sm font-medium">{settings["buy_threshold"] || "55"}</span>
            </div>
            <Slider
              value={[parseInt(settings["buy_threshold"] || "55")]}
              onValueChange={(val) => {
                const num = Array.isArray(val) ? val[0] : val;
                handleChange("buy_threshold", num.toString());
              }}
              max={100}
              step={1}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Max Price per Domain ($)</Label>
              <Input
                type="number"
                value={settings["max_price"] || "12"}
                onChange={(e) => handleChange("max_price", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Domains per Day</Label>
              <Input
                type="number"
                value={settings["max_domains_day"] || "20"}
                onChange={(e) => handleChange("max_domains_day", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Daily Budget Cap ($)</Label>
              <Input
                type="number"
                value={settings["daily_budget"] || "50"}
                onChange={(e) => handleChange("daily_budget", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
