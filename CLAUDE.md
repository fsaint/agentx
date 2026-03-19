# AgentX — Claude Code Guide

## What This Project Is

AgentX is a provisioning platform that deploys OpenClaw AI agent instances for non-technical users. Users create agents through a web UI, providing a Telegram bot token, personality config, and optional MCP servers. AgentX handles containerization and deployment to Fly.io.

## Key Architecture Decisions

- **Two Docker images**: The root `Dockerfile` builds the Next.js web app (`agentx-web`). `docker/Dockerfile` builds the OpenClaw agent container (`agentx-openclaw`). These are separate apps on Fly.io.
- **Provider abstraction**: `src/lib/provider.ts` switches between Fly.io (`fly.ts`) and local Docker (`docker.ts`) based on `AGENTX_PROVIDER=local`. All provisioning goes through this layer.
- **Config generation at boot**: `docker/entrypoint.sh` generates `openclaw.json` from environment variables at container start. This is how Telegram tokens, MCP configs, trusted users, etc. reach OpenClaw.
- **One Fly app per agent**: Each agent gets its own Fly app (`agentx-{instanceId}`). The app name is stored as `flyAppName` in the database.

## Development

```bash
npm run dev              # Next.js on port 6401
npx prisma migrate dev   # Run migrations
npx prisma generate      # Regenerate client after schema changes
npx tsc --noEmit         # Type check
```

Database is PostgreSQL. Schema is in `prisma/schema.prisma`. Always run `prisma generate` after schema changes — the generated client lives in `src/generated/prisma` (gitignored).

## Deploying Changes

### Web app changes
```bash
fly deploy -a agentx-web
fly ssh console -a agentx-web -C "npx prisma migrate deploy"  # if migrations changed
```

### OpenClaw container changes (entrypoint.sh, Dockerfile, workspace/)
```bash
cd docker
fly deploy -a agentx-openclaw --remote-only
# Get the deployment tag from output, then:
fly secrets set OPENCLAW_IMAGE="registry.fly.io/agentx-openclaw:deployment-<TAG>" -a agentx-web
```

The `agentx-openclaw` Fly app exists only to host the image in the registry. Destroy any machines it creates after deploy — they're not needed.

## OpenClaw Config

OpenClaw config is generated in `docker/entrypoint.sh`. Key settings:

- `dmPolicy`: `'allowlist'` when `TELEGRAM_TRUSTED_USER` is set, `'open'` otherwise
- `allowFrom`: restricted to the trusted user ID, or `['*']` if none
- MCP servers: passed via `MCP_CONFIG` env var (JSON array), bridged through `openclaw-mcp-bridge` plugin
- The plugin ID is `openclaw-mcp-bridge` (not `plugin-mcp-client`)

## Gotchas

- **Image architecture**: OpenClaw images must be built for `linux/amd64` (use `--remote-only` with `fly deploy`, or `docker buildx --platform linux/amd64`). Building on Apple Silicon without this produces ARM images that crash on Fly.
- **Fly registry**: You can't `docker push` to `registry.fly.io` for an app that has never been deployed. Use `fly deploy` to bootstrap the registry, then you can push tags.
- **`OPENCLAW_IMAGE` secret**: This must match the exact tag in the Fly registry (e.g., `registry.fly.io/agentx-openclaw:deployment-01KM1QP47Y...`). The `:latest` tag doesn't work with Fly's registry.
- **`git add .` is forbidden**: Add files individually. Check for secrets before committing.
- `client_secrets.json` contains Google OAuth secrets — it's in `.gitignore`, don't commit it.

## Testing Agent Creation

```bash
SESSION_TOKEN="..." ./scripts/create-agent.sh
```

Or use the API directly. The session cookie name in production is `__Secure-authjs.session-token`.

## Debugging Agents

```bash
fly logs -a agentx-<id> --no-tail          # View agent logs
fly ssh console -a agentx-<id>             # SSH into agent container
fly machines list -a agentx-<id>           # Check machine status
npm run reset-agents                        # Nuclear option: destroy all agents
```
