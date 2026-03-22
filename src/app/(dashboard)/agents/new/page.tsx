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
  const [modelProvider, setModelProvider] = useState<"anthropic" | "openai-codex">("anthropic");
  const [codexTokens, setCodexTokens] = useState("");
  const [deviceFlow, setDeviceFlow] = useState<{
    deviceAuthId: string;
    userCode: string;
    interval: number;
    verificationUrl: string;
  } | null>(null);
  const [deviceFlowStatus, setDeviceFlowStatus] = useState<"idle" | "waiting" | "complete" | "error">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function startDeviceFlow() {
    setDeviceFlowStatus("waiting");
    setError("");
    try {
      const res = await fetch("/api/auth/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start device flow");
        setDeviceFlowStatus("error");
        return;
      }
      setDeviceFlow(data);

      // Start polling
      const poll = async () => {
        const pollRes = await fetch("/api/auth/openai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "poll",
            deviceAuthId: data.deviceAuthId,
            userCode: data.userCode,
          }),
        });
        const pollData = await pollRes.json();
        if (pollData.status === "complete") {
          setCodexTokens(JSON.stringify(pollData.tokens));
          setDeviceFlowStatus("complete");
          return;
        }
        if (pollData.status === "pending") {
          setTimeout(poll, (data.interval || 5) * 1000);
          return;
        }
        setError(pollData.error || "Authorization failed");
        setDeviceFlowStatus("error");
      };
      setTimeout(poll, (data.interval || 5) * 1000);
    } catch {
      setError("Failed to connect to OpenAI");
      setDeviceFlowStatus("error");
    }
  }

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
          modelProvider,
          ...(modelProvider === "openai-codex" && codexTokens ? { modelCredentials: codexTokens } : {}),
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
            <CardTitle>Model Provider</CardTitle>
            <CardDescription>
              Choose which AI model powers your agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModelProvider("anthropic")}
                className={`flex-1 rounded-md border-2 p-3 text-left text-sm transition-colors ${
                  modelProvider === "anthropic"
                    ? "border-primary bg-primary/5"
                    : "border-input hover:border-primary/50"
                }`}
              >
                <div className="font-medium">Anthropic Claude</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Uses the platform&apos;s shared API key. No setup needed.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setModelProvider("openai-codex")}
                className={`flex-1 rounded-md border-2 p-3 text-left text-sm transition-colors ${
                  modelProvider === "openai-codex"
                    ? "border-primary bg-primary/5"
                    : "border-input hover:border-primary/50"
                }`}
              >
                <div className="font-medium">OpenAI (ChatGPT subscription)</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Uses your ChatGPT Plus/Pro subscription via Codex OAuth.
                </div>
              </button>
            </div>
            {modelProvider === "openai-codex" && (
              <div className="space-y-3">
                {deviceFlowStatus === "complete" ? (
                  <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-700 dark:text-green-400">
                    OpenAI account connected successfully.
                  </div>
                ) : deviceFlowStatus === "waiting" && deviceFlow ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Open this link and enter the code:
                      </p>
                      <a
                        href={deviceFlow.verificationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm underline font-medium text-primary"
                      >
                        {deviceFlow.verificationUrl}
                      </a>
                      <div className="font-mono text-2xl font-bold tracking-widest pt-1">
                        {deviceFlow.userCode}
                      </div>
                      <p className="text-xs text-muted-foreground animate-pulse">
                        Waiting for authorization...
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <CardDescription className="text-xs">
                      Connect your ChatGPT Plus or Pro subscription. You&apos;ll be
                      asked to authorize on OpenAI&apos;s website.
                    </CardDescription>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startDeviceFlow}
                      disabled={deviceFlowStatus === "waiting"}
                    >
                      Connect OpenAI Account
                    </Button>
                  </div>
                )}
              </div>
            )}
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
          <Button type="submit" disabled={loading || !telegramToken || (modelProvider === "openai-codex" && !codexTokens)}>
            {loading ? "Creating..." : "Create Agent"}
          </Button>
        </div>
      </form>
    </div>
  );
}
