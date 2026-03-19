import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { provision } from "@/lib/provider";
import { z } from "zod";
import crypto from "crypto";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  telegramToken: z.string().includes(":"),
  telegramUserId: z.string().regex(/^\d+$/).optional().or(z.literal("")),
  mcpConfig: z.string().default("[]"),
  soulMd: z.string().optional(),
});

// GET /api/agents — list user's agents
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await prisma.instance.findMany({
    where: { userId: session.user.id },
    include: { mcpConfigs: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(agents);
}

// POST /api/agents — create new agent
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid input", details: body.error.flatten() },
      { status: 400 }
    );
  }

  const { name, telegramToken, telegramUserId, mcpConfig, soulMd } = body.data;

  // Validate telegram token
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${telegramToken}/getMe`
    );
    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json(
        { error: "Invalid Telegram bot token" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Could not validate Telegram token" },
      { status: 400 }
    );
  }

  // Parse MCP config
  let mcpConfigs: Array<{ name: string; [key: string]: unknown }> = [];
  try {
    const parsed = JSON.parse(mcpConfig);
    if (Array.isArray(parsed)) mcpConfigs = parsed;
  } catch {
    return NextResponse.json(
      { error: "Invalid MCP configuration JSON" },
      { status: 400 }
    );
  }

  const gatewayToken = `agentx-${crypto.randomBytes(12).toString("hex")}`;

  // Create instance record
  const instance = await prisma.instance.create({
    data: {
      userId: session.user.id,
      name,
      telegramToken,
      telegramUserId: telegramUserId && telegramUserId.length > 0 ? telegramUserId : null,
      gatewayToken,
      soulMd: soulMd || null,
      status: "pending",
      mcpConfigs: {
        create: mcpConfigs.map((c) => ({
          name: c.name || "unnamed",
          config: c as object,
        })),
      },
    },
  });

  // Provision
  try {
    const result = await provision({
      instanceId: instance.id,
      telegramToken,
      telegramUserId: telegramUserId || undefined,
      mcpConfigs,
      gatewayToken,
      soulMd,
    });

    const updated = await prisma.instance.update({
      where: { id: instance.id },
      data: {
        flyAppName: result.appName,
        flyMachineId: result.machineId,
        status: "starting",
      },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    await prisma.instance.update({
      where: { id: instance.id },
      data: { status: "error" },
    });
    console.error("Provisioning failed:", err);
    return NextResponse.json(
      { error: "Failed to provision agent" },
      { status: 500 }
    );
  }
}
