#!/usr/bin/env npx tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const target = process.argv[2] || process.env.AGENTX_PROVIDER || "local";
if (target !== "local" && target !== "fly") {
  console.error("Usage: npm run reset-agents -- <local|fly>");
  process.exit(1);
}

const isLocal = target === "local";
const FLY_TOKEN = process.env.AGENTX_FLY_TOKEN || process.env.FLY_API_TOKEN;

console.log(`Target: ${target}\n`);

async function flyFetch(path: string, method = "GET") {
  const res = await fetch(`https://api.machines.dev/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${FLY_TOKEN}` },
  });
  return res;
}

async function cleanupFly() {
  if (!FLY_TOKEN) {
    console.error("No FLY_API_TOKEN or AGENTX_FLY_TOKEN set");
    return;
  }

  // List ALL apps in the org that start with "agentx-"
  const res = await flyFetch("/apps?org_slug=personal");
  const data = await res.json();
  const apps = (data.apps || []).filter(
    (a: { name: string }) =>
      a.name.startsWith("agentx-") &&
      a.name !== "agentx-web" &&
      a.name !== "agentx-openclaw" &&
      a.name !== "agentx-pg"
  );

  console.log(`Found ${apps.length} agentx app(s) on Fly.io\n`);

  for (const app of apps) {
    console.log(`- ${app.name}`);

    // List and destroy all machines in this app
    try {
      const machinesRes = await flyFetch(`/apps/${app.name}/machines`);
      const machines = await machinesRes.json();
      for (const m of machines) {
        try {
          // Stop first if running
          if (m.state === "started" || m.state === "starting") {
            await flyFetch(`/apps/${app.name}/machines/${m.id}/stop`, "POST");
            console.log(`  Stopped machine ${m.id}`);
            // Wait a moment for stop
            await new Promise((r) => setTimeout(r, 2000));
          }
          await flyFetch(`/apps/${app.name}/machines/${m.id}?force=true`, "DELETE");
          console.log(`  Deleted machine ${m.id}`);
        } catch {
          console.log(`  Failed to delete machine ${m.id}`);
        }
      }
    } catch {
      console.log(`  Could not list machines`);
    }

    // Delete the app
    try {
      const delRes = await flyFetch(`/apps/${app.name}`, "DELETE");
      console.log(`  App deleted: ${delRes.status}`);
    } catch {
      console.log(`  Failed to delete app`);
    }
  }
}

async function cleanupDocker() {
  const { execFileSync } = await import("child_process");

  // List all agentx- containers
  try {
    const output = execFileSync(
      "docker",
      ["ps", "-a", "--filter", "name=agentx-", "--format", "{{.Names}}"],
      { encoding: "utf8", timeout: 10000 }
    ).trim();

    const containers = output ? output.split("\n") : [];
    console.log(`Found ${containers.length} agentx container(s)\n`);

    for (const name of containers) {
      try {
        execFileSync("docker", ["rm", "-f", name], {
          encoding: "utf8",
          timeout: 10000,
        });
        console.log(`- Removed ${name}`);
      } catch {
        console.log(`- Failed to remove ${name}`);
      }
    }
  } catch {
    console.log("Docker not available or no containers found");
  }
}

async function main() {
  // Clean up infrastructure
  if (isLocal) {
    await cleanupDocker();
  } else {
    await cleanupFly();
  }

  // Clean up database
  const count = await prisma.instance.count();
  await prisma.mcpConfig.deleteMany();
  await prisma.instance.deleteMany();
  console.log(`\nDatabase: deleted ${count} agent(s)`);

  await prisma.$disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
