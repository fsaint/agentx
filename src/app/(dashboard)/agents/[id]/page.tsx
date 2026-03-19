import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getManagementUrl } from "@/lib/provider";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AgentActions } from "./agent-actions";
import { SoulEditor } from "./soul-editor";
import { McpList } from "./mcp-list";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const agent = await prisma.instance.findUnique({
    where: { id },
    include: { mcpConfigs: true },
  });

  if (!agent || agent.userId !== session.user.id) {
    redirect("/dashboard");
  }

  let managementUrl: string | null = null;
  if (agent.flyAppName && agent.gatewayToken) {
    try {
      managementUrl = await getManagementUrl(agent.flyAppName, agent.gatewayToken);
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{agent.name}</h1>
        <p className="text-sm text-muted-foreground">
          Region: {agent.region} · Telegram: ****
          {agent.telegramToken.slice(-4)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AgentActions agentId={agent.id} initialStatus={agent.status} />

          {managementUrl && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Management Console</p>
              <a
                href={managementUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline break-all"
              >
                {managementUrl}
              </a>
            </div>
          )}

          {agent.gatewayToken && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Gateway Token</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                {agent.gatewayToken}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      <SoulEditor agentId={agent.id} initialSoulMd={agent.soulMd || ""} />

      <McpList
        agentId={agent.id}
        configs={agent.mcpConfigs.map((c) => ({
          id: c.id,
          name: c.name,
          config: c.config as object,
        }))}
      />
    </div>
  );
}

