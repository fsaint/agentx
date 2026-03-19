"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SoulEditor({
  agentId,
  initialSoulMd,
}: {
  agentId: string;
  initialSoulMd: string;
}) {
  const router = useRouter();
  const [soulMd, setSoulMd] = useState(initialSoulMd);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = soulMd !== initialSoulMd;

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/agents/${agentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soulMd }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSaveAndRedeploy() {
    setSaving(true);
    await fetch(`/api/agents/${agentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soulMd }),
    });
    await fetch(`/api/agents/${agentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "redeploy" }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personality (SOUL.md)</CardTitle>
        <CardDescription>
          Define your agent's personality. Save and redeploy to apply changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          className="flex min-h-[250px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          value={soulMd}
          onChange={(e) => setSoulMd(e.target.value)}
        />
        <div className="flex gap-2 items-center">
          <Button
            onClick={handleSave}
            variant="outline"
            disabled={saving || !dirty}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button onClick={handleSaveAndRedeploy} disabled={saving || !dirty}>
            {saving ? "Deploying..." : "Save & Redeploy"}
          </Button>
          {saved && (
            <span className="text-sm text-muted-foreground">Saved</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
