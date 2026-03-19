import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const usageSchema = z.object({
  userId: z.string(),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
});

export async function POST(req: NextRequest) {
  // TODO: Add shared secret auth between OpenClaw instances and agentx
  const body = usageSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { userId, inputTokens, outputTokens } = body.data;

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 1);

  await prisma.usageRecord.upsert({
    where: {
      id: `${userId}-${periodStart.toISOString().slice(0, 10)}`,
    },
    create: {
      id: `${userId}-${periodStart.toISOString().slice(0, 10)}`,
      userId,
      periodStart,
      periodEnd,
      inputTokens,
      outputTokens,
    },
    update: {
      inputTokens: { increment: inputTokens },
      outputTokens: { increment: outputTokens },
    },
  });

  return NextResponse.json({ ok: true });
}
