"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export function AgentActions({
  agentId,
  initialStatus,
}: {
  agentId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState(initialStatus);

  // Poll status every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/agents/${agentId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status !== status) {
            setStatus(data.status);
            router.refresh();
          }
        }
      } catch {
        // ignore
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [agentId, status, router]);

  async function handleAction(action: "start" | "stop" | "redeploy") {
    setLoading(action);
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      // Wait a moment then refresh
      setTimeout(() => {
        router.refresh();
        setLoading(null);
      }, 2000);
    } catch {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this agent? This cannot be undone.")) return;
    setLoading("delete");
    await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  const variant =
    status === "running"
      ? "default"
      : status === "error"
        ? "destructive"
        : "secondary";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Status:</span>
        <Badge variant={variant}>{status}</Badge>
      </div>
      <div className="flex gap-2 flex-wrap">
        {status !== "running" && (
          <Button
            onClick={() => handleAction("start")}
            disabled={loading !== null || status === "pending"}
          >
            {loading === "start" ? "Starting..." : "Start"}
          </Button>
        )}
        {status === "running" && (
          <Button
            variant="outline"
            onClick={() => handleAction("stop")}
            disabled={loading !== null}
          >
            {loading === "stop" ? "Stopping..." : "Stop"}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => handleAction("redeploy")}
          disabled={loading !== null}
        >
          {loading === "redeploy" ? "Redeploying..." : "Redeploy"}
        </Button>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={loading !== null}
        >
          {loading === "delete" ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </div>
  );
}
