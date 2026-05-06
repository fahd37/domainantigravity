"use client";
import React, { useEffect, useState } from "react";

const API_FIELDS = [
  { key: "whoisfreaksApiKey", label: "WhoisFreaks API Key", placeholder: "your-whoisfreaks-api-key", desc: "Required — Domainer subscription ($29/mo) for daily drop feed", required: true },
  { key: "dataForSeoEmail", label: "DataForSEO Email", placeholder: "you@email.com", desc: "For domain scoring + Google index check ($0.10/domain)" },
  { key: "dataForSeoPassword", label: "DataForSEO Password", placeholder: "api-password", desc: "DataForSEO API password (not your account password)", secret: true },
  { key: "namecheapApiUser", label: "Namecheap API User", placeholder: "your-username", desc: "For availability verification (FREE)" },
  { key: "namecheapApiKey", label: "Namecheap API Key", placeholder: "your-api-key", desc: "Namecheap API key", secret: true },
];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(j => {
        if (j.data) {
          setValues(j.data);
        }
        if (j.error) setError(j.error);
        setLoaded(true);
      })
      .catch(e => {
        setError(String(e));
        setLoaded(true);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError(null);
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: values }),
      });
      const j = await r.json();
      if (j.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(j.error || "Failed to save");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const configuredCount = API_FIELDS.filter(f => values[f.key]?.trim()).length;
  const totalFields = API_FIELDS.length;

  if (!loaded) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl pb-10">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">⚙️ Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">Configure API keys for the 5-engine hunting pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{configuredCount}/{totalFields} configured</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
            ) : saved ? (
              "✅ Saved!"
            ) : (
              "💾 Save Settings"
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">{error}</div>
      )}

      {saved && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-sm text-green-400">✅ Settings saved successfully! Pipeline engines will use updated keys.</div>
      )}

      {/* Engine Status */}
      <div className="rounded-xl border bg-card p-4">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Pipeline Engine Status</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { name: "Drop-Feed", ok: !!values.whoisfreaksApiKey?.trim(), desc: "WhoisFreaks", keys: ["whoisfreaksApiKey"] },
            { name: "Authority + Index", ok: !!(values.dataForSeoEmail?.trim() && values.dataForSeoPassword?.trim()), desc: "DataForSEO", keys: ["dataForSeoEmail", "dataForSeoPassword"] },
            { name: "Verification", ok: !!(values.namecheapApiUser?.trim() && values.namecheapApiKey?.trim()), desc: "Namecheap", keys: ["namecheapApiUser", "namecheapApiKey"] },
          ].map(e => (
            <div key={e.name} className={`rounded-lg border p-3 ${e.ok ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${e.ok ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm font-bold">{e.name}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">{e.desc} — {e.ok ? "Ready ✓" : "Not configured"}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-lg bg-green-500/5 border border-green-500/20 p-2 text-[10px] text-green-400">
          <span className="h-2 w-2 rounded-full bg-green-500 inline-block mr-1" />
          <strong>TimeMachine</strong> — Wayback (FREE, always active)
        </div>
      </div>

      {/* API Keys */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-semibold text-sm">🔑 API Keys</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">Keys are encrypted at rest. Only WhoisFreaks is required to start hunting.</p>
        </div>

        <div className="divide-y">
          {API_FIELDS.map(field => {
            const hasValue = !!values[field.key]?.trim();
            const isSecret = field.secret;
            const isVisible = showSecrets[field.key];

            return (
              <div key={field.key} className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold">{field.label}</label>
                    {field.required && <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">REQUIRED</span>}
                    {hasValue && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold">CONFIGURED</span>}
                  </div>
                  {isSecret && hasValue && (
                    <button onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))} className="text-[10px] text-muted-foreground hover:text-foreground">
                      {isVisible ? "Hide" : "Show"}
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{field.desc}</p>
                <input
                  type={isSecret && !isVisible ? "password" : "text"}
                  className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder={field.placeholder}
                  value={values[field.key] || ""}
                  onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Help */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold text-sm mb-3">📋 Quick Setup Guide</h3>
        <div className="space-y-3 text-xs text-muted-foreground">
          <div className="flex gap-3">
            <span className="text-green-400 font-bold">1.</span>
            <div><strong className="text-foreground">WhoisFreaks</strong> — Sign up at <a href="https://whoisfreaks.com" target="_blank" className="text-primary hover:underline">whoisfreaks.com</a> → Get Domainer subscription ($29/mo) → Copy API key</div>
          </div>
          <div className="flex gap-3">
            <span className="text-green-400 font-bold">2.</span>
            <div><strong className="text-foreground">DataForSEO</strong> — Sign up at <a href="https://dataforseo.com" target="_blank" className="text-primary hover:underline">dataforseo.com</a> → Dashboard → API credentials → Copy email + password</div>
          </div>
          <div className="flex gap-3">
            <span className="text-green-400 font-bold">3.</span>
            <div><strong className="text-foreground">Namecheap</strong> — Login → Profile → API Access → Enable → Copy API key (FREE, you only pay when buying)</div>
          </div>
        </div>
      </div>

      {/* Bottom Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : "💾 Save All Settings"}
      </button>
    </div>
  );
}
