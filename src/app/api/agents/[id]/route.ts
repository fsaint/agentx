import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  start,
  stop,
  redeploy,
  destroy,
  getStatus,
  getManagementUrl,
} from "@/lib/provider";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

async function getAgent(id: string, userId: string) {
  const agent = await prisma.instance.findUnique({
    where: { id },
    include: { mcpConfigs: true },
  });
  if (!agent || agent.userId !== userId) return null;
  return agent;
}

// GET /api/agents/[id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const agent = await getAgent(id, session.user.id);
  if (!agent)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Refresh status from provider
  if (agent.flyAppName && agent.flyMachineId) {
    try {
      const status = await getStatus(agent.flyAppName, agent.flyMachineId);
      if (status !== agent.status) {
        await prisma.instance.update({ where: { id }, data: { status } });
        agent.status = status;
      }
    } catch {
      // Provider unreachable, keep current status
    }
  }

  // Get current management URL
  let managementUrl = null;
  if (agent.flyAppName && agent.gatewayToken) {
    try {
      managementUrl = await getManagementUrl(
        agent.flyAppName,
        agent.gatewayToken
      );
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ...agent, managementUrl });
}

const actionSchema = z.object({
  action: z.enum(["start", "stop", "redeploy"]),
});

// POST /api/agents/[id] — actions: start, stop, redeploy
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const agent = await getAgent(id, session.user.id);
  if (!agent)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!agent.flyAppName || !agent.flyMachineId)
    return NextResponse.json(
      { error: "Agent not provisioned" },
      { status: 400 }
    );

  const body = actionSchema.safeParse(await req.json());
  if (!body.success)
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  try {
    const { action } = body.data;

    if (action === "start") {
      await start(agent.flyAppName, agent.flyMachineId);
      await prisma.instance.update({
        where: { id },
        data: { status: "running" },
      });
    } else if (action === "stop") {
      await stop(agent.flyAppName, agent.flyMachineId);
      await prisma.instance.update({
        where: { id },
        data: { status: "stopped" },
      });
    } else if (action === "redeploy") {
      await redeploy(agent.flyAppName, agent.flyMachineId, {
        instanceId: agent.id,
        telegramToken: agent.telegramToken,
        telegramUserId: agent.telegramUserId || undefined,
        mcpConfigs: agent.mcpConfigs.map((c) => c.config as object),
        gatewayToken: agent.gatewayToken || "",
        soulMd: agent.soulMd || undefined,
      });
      await prisma.instance.update({
        where: { id },
        data: { status: "starting" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Agent action failed:", err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  soulMd: z.string().optional(),
  mcpConfig: z.string().optional(),
});

// PUT /api/agents/[id] — update config
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const agent = await getAgent(id, session.user.id);
  if (!agent)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = updateSchema.safeParse(await req.json());
  if (!body.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.data.name) data.name = body.data.name;
  if (body.data.soulMd !== undefined) data.soulMd = body.data.soulMd;

  if (body.data.mcpConfig) {
    try {
      const configs = JSON.parse(body.data.mcpConfig);
      if (Array.isArray(configs)) {
        await prisma.mcpConfig.deleteMany({ where: { instanceId: id } });
        await prisma.mcpConfig.createMany({
          data: configs.map(
            (c: { name?: string; [key: string]: unknown }) => ({
              instanceId: id,
              name: c.name || "unnamed",
              config: c as object,
            })
          ),
        });
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid MCP config JSON" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.instance.update({
    where: { id },
    data,
    include: { mcpConfigs: true },
  });

  return NextResponse.json(updated);
}

// DELETE /api/agents/[id]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const agent = await getAgent(id, session.user.id);
  if (!agent)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (agent.flyAppName && agent.flyMachineId) {
    await destroy(agent.flyAppName, agent.flyMachineId);
  }

  await prisma.instance.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
