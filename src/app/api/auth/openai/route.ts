import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const OPENAI_AUTH_BASE = "https://auth.openai.com";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";

// POST /api/auth/openai — initiate device code flow
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === "start") {
    // Step 1: Request user code
    const res = await fetch(
      `${OPENAI_AUTH_BASE}/api/accounts/deviceauth/usercode`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: CLIENT_ID }),
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Device code flow not available" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      deviceAuthId: data.device_auth_id,
      userCode: data.user_code || data.usercode,
      interval: parseInt(data.interval) || 5,
      verificationUrl: `${OPENAI_AUTH_BASE}/codex/device`,
    });
  }

  if (action === "poll") {
    const { deviceAuthId, userCode } = body;
    if (!deviceAuthId || !userCode) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Step 3: Poll for authorization code
    const pollRes = await fetch(
      `${OPENAI_AUTH_BASE}/api/accounts/deviceauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_auth_id: deviceAuthId,
          user_code: userCode,
        }),
      }
    );

    if (pollRes.status === 403 || pollRes.status === 404) {
      return NextResponse.json({ status: "pending" });
    }

    if (!pollRes.ok) {
      return NextResponse.json(
        { error: "Authorization failed" },
        { status: pollRes.status }
      );
    }

    const pollData = await pollRes.json();

    // Step 4: Exchange authorization code for tokens
    const tokenRes = await fetch(`${OPENAI_AUTH_BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: pollData.authorization_code,
        redirect_uri: `${OPENAI_AUTH_BASE}/deviceauth/callback`,
        client_id: CLIENT_ID,
        code_verifier: pollData.code_verifier,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.json(
        { error: "Token exchange failed" },
        { status: tokenRes.status }
      );
    }

    const tokens = await tokenRes.json();
    return NextResponse.json({
      status: "complete",
      tokens: {
        access_token: tokens.access_token,
        id_token: tokens.id_token,
        refresh_token: tokens.refresh_token,
      },
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
