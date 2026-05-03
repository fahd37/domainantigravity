"use client";

import { useEffect, useState } from "react";
import { SettingsForm } from "@/components/settings-form";

export default function SettingsPage() {
  const [initialSettings, setInitialSettings] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        }
        setInitialSettings(json.data || {});
      })
      .catch((e) => {
        console.error(e);
        setError("Failed to load settings. Running in UI-only mode.");
        setInitialSettings({});
      });
  }, []);

  if (!initialSettings) {
    return <div className="p-8">Loading settings...</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure API keys, notification preferences, and system defaults.
        </p>
        {error && (
          <p className="text-destructive mt-2 text-sm bg-destructive/10 p-2 rounded border border-destructive/20">
            {error}
          </p>
        )}
      </div>

      <SettingsForm initialSettings={initialSettings} />
    </div>
  );
}
