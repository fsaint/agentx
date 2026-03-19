"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const DEFAULT_SOUL = `# Soul

You are a helpful, friendly AI assistant. You communicate through Telegram and have access to web browsing and connected tools.

## Personality

- Be concise and direct
- Be helpful and proactive
- Ask clarifying questions when the request is ambiguous
- Respect the user's time
`;

export default function NewAgentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");
  const [mcpConfig, setMcpConfig] = useState("");
  const [soulMd, setSoulMd] = useState(DEFAULT_SOUL);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || "My Agent",
          telegramToken,
          ...(telegramUserId ? { telegramUserId } : {}),
          mcpConfig: mcpConfig || "[]",
          soulMd,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create agent");
        setLoading(false);
        return;
      }

      router.push(`/agents/${data.id}`);
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Create Agent</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                placeholder="My Agent"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegram-token">Telegram Bot Token</Label>
              <CardDescription className="text-xs">
                Open{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium text-foreground"
                >
                  @BotFather
                </a>{" "}
                on Telegram, send /newbot, then paste the token here.
              </CardDescription>
              <Input
                id="telegram-token"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegram-user-id">Your Telegram User ID (optional)</Label>
              <CardDescription className="text-xs">
                Pre-authorize your Telegram account so only you can message the
                bot. Send /start to{" "}
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium text-foreground"
                >
                  @userinfobot
                </a>{" "}
                to find your numeric ID.
              </CardDescription>
              <Input
                id="telegram-user-id"
                placeholder="123456789"
                value={telegramUserId}
                onChange={(e) => setTelegramUserId(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personality (SOUL.md)</CardTitle>
            <CardDescription>
              Define your agent's personality and behavior rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              value={soulMd}
              onChange={(e) => setSoulMd(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MCP Servers (optional)</CardTitle>
            <CardDescription>
              Paste MCP server configuration JSON. You can add these later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              placeholder={'[\n  {\n    "name": "my-server",\n    "url": "https://mcp.example.com/mcp",\n    "headers": { "Authorization": "Bearer ..." }\n  }\n]'}
              value={mcpConfig}
              onChange={(e) => setMcpConfig(e.target.value)}
            />
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !telegramToken}>
            {loading ? "Creating..." : "Create Agent"}
          </Button>
        </div>
      </form>
    </div>
  );
}
