const FLY_API_BASE = "https://api.machines.dev/v1";
const FLY_API_TOKEN = process.env.AGENTX_FLY_TOKEN || process.env.FLY_API_TOKEN!;
const FLY_ORG = process.env.FLY_ORG!;
const OPENCLAW_IMAGE = process.env.OPENCLAW_IMAGE!;

async function flyFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${FLY_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${FLY_API_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fly API error ${res.status}: ${body}`);
  }

  return res;
}

async function flyGraphQL(query: string, variables: Record<string, unknown>) {
  const res = await fetch("https://api.fly.io/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FLY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function allocateIps(appName: string) {
  // Allocate IPv6
  await flyGraphQL(
    `mutation($input: AllocateIPAddressInput!) { allocateIpAddress(input: $input) { ipAddress { id address type } } }`,
    { input: { appId: appName, type: "v6" } }
  );
  // Allocate shared IPv4
  await flyGraphQL(
    `mutation($input: AllocateIPAddressInput!) { allocateIpAddress(input: $input) { ipAddress { id address type } } }`,
    { input: { appId: appName, type: "shared_v4" } }
  );
}

export async function createApp(instanceId: string) {
  const appName = `agentx-${instanceId.slice(0, 8)}`;
  await flyFetch("/apps", {
    method: "POST",
    body: JSON.stringify({ app_name: appName, org_slug: FLY_ORG }),
  });

  // Allocate public IPs via Fly GraphQL API
  try {
    await allocateIps(appName);
  } catch (err) {
    console.error("IP allocation failed (non-fatal):", err);
  }

  return appName;
}

interface CreateMachineOpts {
  appName: string;
  instanceId: string;
  telegramToken: string;
  telegramUserId?: string;
  mcpConfigs: object[];
  gatewayToken: string;
  soulMd?: string;
}

export async function createMachine(opts: CreateMachineOpts) {
  const res = await flyFetch(`/apps/${opts.appName}/machines`, {
    method: "POST",
    body: JSON.stringify({
      name: `openclaw-${opts.instanceId.slice(0, 8)}`,
      region: "iad",
      config: buildMachineConfig(opts),
    }),
  });

  const machine = await res.json();
  return { flyMachineId: machine.id as string, flyAppName: opts.appName };
}

export async function updateMachine(
  appName: string,
  machineId: string,
  opts: Omit<CreateMachineOpts, "appName">
) {
  const res = await flyFetch(`/apps/${appName}/machines/${machineId}`, {
    method: "POST",
    body: JSON.stringify({
      config: buildMachineConfig({ ...opts, appName }),
    }),
  });
  return res.json();
}

function buildMachineConfig(opts: CreateMachineOpts) {
  return {
    image: OPENCLAW_IMAGE,
    guest: {
      cpu_kind: "shared",
      cpus: 2,
      memory_mb: 4096,
    },
    env: {
      TELEGRAM_BOT_TOKEN: opts.telegramToken,
      MCP_CONFIG: JSON.stringify(opts.mcpConfigs),
      USAGE_CALLBACK_URL: `${process.env.NEXTAUTH_URL}/api/webhooks/usage`,
      INSTANCE_USER_ID: opts.instanceId,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
      OPENCLAW_GATEWAY_TOKEN: opts.gatewayToken,
      OPENCLAW_NO_RESPAWN: "1",
      NODE_OPTIONS: "--max-old-space-size=3072 --dns-result-order=ipv4first",
      ...(opts.soulMd ? { SOUL_MD: opts.soulMd } : {}),
      ...(opts.telegramUserId ? { TELEGRAM_TRUSTED_USER: opts.telegramUserId } : {}),
    },
    services: [
      {
        ports: [{ port: 443, handlers: ["tls", "http"] }],
        protocol: "tcp",
        internal_port: 18789,
        autostart: true,
        autostop: "off",
      },
    ],
  };
}

export async function startMachine(appName: string, machineId: string) {
  await flyFetch(`/apps/${appName}/machines/${machineId}/start`, {
    method: "POST",
  });
}

export async function stopMachine(appName: string, machineId: string) {
  await flyFetch(`/apps/${appName}/machines/${machineId}/stop`, {
    method: "POST",
  });
}

export async function getMachineStatus(appName: string, machineId: string) {
  const res = await flyFetch(`/apps/${appName}/machines/${machineId}`);
  return res.json();
}

export async function destroyMachine(appName: string, machineId: string) {
  await flyFetch(`/apps/${appName}/machines/${machineId}?force=true`, {
    method: "DELETE",
  });
}

export async function destroyApp(appName: string) {
  await flyFetch(`/apps/${appName}`, { method: "DELETE" });
}
