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

interface McpServer {
  id: string;
  name: string;
  config: object;
}

export function McpList({
  agentId,
  configs,
}: {
  agentId: string;
  configs: McpServer[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [newConfig, setNewConfig] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleRemove(configId: string) {
    const remaining = configs.filter((c) => c.id !== configId);
    setSaving(true);
    await fetch(`/api/agents/${agentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mcpConfig: JSON.stringify(remaining.map((c) => c.config)),
      }),
    });
    setSaving(false);
    router.refresh();
  }

  async function handleAdd() {
    try {
      const parsed = JSON.parse(newConfig);
      const all = [...configs.map((c) => c.config), ...(Array.isArray(parsed) ? parsed : [parsed])];
      setSaving(true);
      await fetch(`/api/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mcpConfig: JSON.stringify(all) }),
      });
      setSaving(false);
      setAdding(false);
      setNewConfig("");
      router.refresh();
    } catch {
      alert("Invalid JSON");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>MCP Servers</CardTitle>
            <CardDescription>
              Connected tool servers. Redeploy after changes.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAdding(!adding)}>
            {adding ? "Cancel" : "Add"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {configs.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">No MCP servers configured.</p>
        )}

        {configs.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {JSON.stringify(c.config).slice(0, 80)}
                {JSON.stringify(c.config).length > 80 ? "..." : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemove(c.id)}
              disabled={saving}
            >
              Remove
            </Button>
          </div>
        ))}

        {adding && (
          <div className="space-y-2">
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              placeholder={'{"name": "my-server", "url": "https://mcp.example.com/mcp"}'}
              value={newConfig}
              onChange={(e) => setNewConfig(e.target.value)}
            />
            <Button onClick={handleAdd} disabled={saving || !newConfig}>
              {saving ? "Adding..." : "Add Server"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
