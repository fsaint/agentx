# AgentX

A web platform for deploying and managing [OpenClaw](https://github.com/openclaw/openclaw) AI agent instances. Users sign in, configure an agent with a Telegram bot token and personality, and AgentX provisions a dedicated OpenClaw instance on Fly.io (or locally via Docker).

## How It Works

1. User signs in via Google OAuth or email/password
2. Creates an agent: provides a Telegram bot token, optional personality (SOUL.md), optional MCP server configs, and optional Telegram user ID for access control
3. AgentX provisions a Fly.io machine (or Docker container) running OpenClaw with the agent's configuration
4. The agent is live on Telegram and accessible via a management console

Each agent runs in its own isolated container with its own Telegram bot, personality, and tool configuration.

## Architecture

```
Browser -> AgentX Web (Next.js on Fly.io)
               |
               +-> PostgreSQL (Fly.io)
               |
               +-> Fly Machines API
                       |
                       +-> OpenClaw Instance (per agent)
                              |
                              +-> Telegram Bot API
                              +-> MCP Servers
                              +-> Anthropic API
```

- **AgentX Web** (`/`) - Next.js 16 app with NextAuth, Prisma, Tailwind
- **OpenClaw Instances** (`docker/`) - Containerized OpenClaw with Telegram, browser, and MCP plugin support
- **Database** - PostgreSQL via Prisma ORM

## Stack

- Next.js 16 / React 19 / TypeScript
- NextAuth v5 (Google OAuth + credentials)
- Prisma 7 + PostgreSQL
- Tailwind CSS 4 + shadcn/ui
- Fly.io (deployment) or Docker (local dev)
- OpenClaw (AI agent runtime)

## Setup

```bash
cp .env.example .env
# Fill in the values (see .env.example for descriptions)

npm install
npx prisma migrate dev
npm run dev
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | NextAuth secret (`npx auth secret`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `ANTHROPIC_API_KEY` | Passed to OpenClaw instances |
| `OPENCLAW_IMAGE` | Docker image for OpenClaw containers |

For Fly.io deployment, also set `FLY_API_TOKEN` and `FLY_ORG`.

For local Docker development, set `AGENTX_PROVIDER=local`.

## Deployment

### Web App (Fly.io)

```bash
fly deploy
fly ssh console -C "npx prisma migrate deploy"
```

### OpenClaw Image

The OpenClaw container image is built from `docker/Dockerfile`:

```bash
cd docker
fly deploy -a agentx-openclaw --remote-only
```

Then set the image tag as a secret on the web app:

```bash
fly secrets set OPENCLAW_IMAGE="registry.fly.io/agentx-openclaw:deployment-<TAG>" -a agentx-web
```

## Project Structure

```
src/
  app/
    (auth)/login/         # Login page
    (dashboard)/          # Dashboard, agent creation, agent detail
    api/
      agents/             # Agent CRUD + actions (start/stop/redeploy)
      auth/               # NextAuth route handler
      webhooks/usage/     # Usage tracking callback from OpenClaw instances
  components/ui/          # shadcn/ui components
  lib/
    auth.ts               # NextAuth config
    db.ts                 # Prisma client
    fly.ts                # Fly.io Machines API client
    docker.ts             # Local Docker provider
    provider.ts           # Provider abstraction (Fly vs Docker)
docker/
    Dockerfile            # OpenClaw container image
    entrypoint.sh         # Config generation + OpenClaw startup
    workspace/            # Default SOUL.md and agent templates
prisma/
    schema.prisma         # Database schema
scripts/
    create-agent.sh       # CLI script to create an agent via the API
    reset-agents.ts       # Destroy all agents and orphan Fly apps
```

## Scripts

```bash
# Create an agent via API (for testing)
SESSION_TOKEN="..." ./scripts/create-agent.sh

# Destroy all agents and clean up orphan Fly apps
npm run reset-agents
```
