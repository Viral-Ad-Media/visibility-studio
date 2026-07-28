import { serviceDb as db } from "../db";

const CALENDLY_AUTH_BASE = "https://auth.calendly.com";
const CALENDLY_API_BASE = "https://api.calendly.com";

export function calendlyRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL}/api/calendly/callback`;
}

// Scopes must also be enabled for the OAuth app itself in the Calendly
// developer portal (My Apps → app settings) — this request-time parameter
// can't grant access to anything not already allowed there.
const CALENDLY_SCOPES = "users:read event_types:read scheduling_links:write";

export function calendlyAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.CALENDLY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: calendlyRedirectUri(),
    scope: CALENDLY_SCOPES,
    state,
  });
  return `${CALENDLY_AUTH_BASE}/oauth/authorize?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(`${CALENDLY_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.CALENDLY_CLIENT_ID!,
      client_secret: process.env.CALENDLY_CLIENT_SECRET!,
      code,
      redirect_uri: calendlyRedirectUri(),
    }),
  });
  if (!res.ok) throw new Error(`Calendly token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${CALENDLY_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.CALENDLY_CLIENT_ID!,
      client_secret: process.env.CALENDLY_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Calendly token refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function getCurrentUser(accessToken: string): Promise<{ uri: string; name: string; current_organization: string | null }> {
  const res = await fetch(`${CALENDLY_API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Calendly users/me failed: ${res.status} ${await res.text()}`);
  const { resource } = await res.json();
  return resource;
}

// Called by app/api/calendly/callback/route.ts right after a user connects
// their own Calendly account through the OAuth flow.
export async function saveConnection(accountId: number, code: string): Promise<void> {
  const tokens = await exchangeCode(code);
  const user = await getCurrentUser(tokens.access_token);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Explicit RETURNING account_id — lib/db.ts auto-appends "RETURNING id" to
  // any bare INSERT, but this table's primary key is account_id, not id.
  await db
    .prepare(
      `INSERT INTO vis_calendly_connections
         (account_id, access_token, refresh_token, token_expires_at, calendly_user_uri, calendly_organization_uri, calendly_name, updated_at)
       VALUES (@account_id, @access_token, @refresh_token, @token_expires_at, @calendly_user_uri, @calendly_organization_uri, @calendly_name, now()::text)
       ON CONFLICT (account_id) DO UPDATE SET
         access_token=@access_token, refresh_token=@refresh_token, token_expires_at=@token_expires_at,
         calendly_user_uri=@calendly_user_uri, calendly_organization_uri=@calendly_organization_uri,
         calendly_name=@calendly_name, updated_at=now()::text
       RETURNING account_id`
    )
    .run({
      account_id: accountId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      calendly_user_uri: user.uri,
      calendly_organization_uri: user.current_organization ?? null,
      calendly_name: user.name,
    });
}

export async function getConnectionStatus(
  accountId: number
): Promise<{ connected: boolean; name: string | null }> {
  const row = (await db
    .prepare("SELECT calendly_name FROM vis_calendly_connections WHERE account_id = ?")
    .get(accountId)) as { calendly_name: string | null } | undefined;
  return { connected: !!row, name: row?.calendly_name ?? null };
}

// Refreshes the stored token if it's near expiry (and persists the refresh),
// then returns a usable access token + the connected user's URI. Returns
// null if this account has never connected Calendly.
export async function getValidToken(
  accountId: number
): Promise<{ accessToken: string; userUri: string } | null> {
  const row = (await db
    .prepare(
      "SELECT access_token, refresh_token, token_expires_at, calendly_user_uri FROM vis_calendly_connections WHERE account_id = ?"
    )
    .get(accountId)) as
    | { access_token: string; refresh_token: string; token_expires_at: string; calendly_user_uri: string }
    | undefined;
  if (!row) return null;

  const expiresAt = new Date(row.token_expires_at).getTime();
  if (expiresAt - Date.now() > 5 * 60 * 1000) {
    return { accessToken: row.access_token, userUri: row.calendly_user_uri };
  }

  const tokens = await refreshAccessToken(row.refresh_token);
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await db
    .prepare(
      "UPDATE vis_calendly_connections SET access_token=@access_token, refresh_token=@refresh_token, token_expires_at=@token_expires_at, updated_at=now()::text WHERE account_id=@account_id"
    )
    .run({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: newExpiresAt,
      account_id: accountId,
    });

  return { accessToken: tokens.access_token, userUri: row.calendly_user_uri };
}

export type CalendlyEventType = {
  uri: string;
  name: string;
  active: boolean;
  duration: number;
  description_plain: string | null;
};

export async function listEventTypes(accountId: number): Promise<CalendlyEventType[]> {
  const conn = await getValidToken(accountId);
  if (!conn) throw new Error("Calendly is not connected for this account — connect it in Settings.");
  const params = new URLSearchParams({ user: conn.userUri, active: "true" });
  const res = await fetch(`${CALENDLY_API_BASE}/event_types?${params}`, {
    headers: { Authorization: `Bearer ${conn.accessToken}` },
  });
  if (!res.ok) throw new Error(`Calendly event_types failed: ${res.status} ${await res.text()}`);
  const { collection } = await res.json();
  return collection;
}

export async function createSingleUseSchedulingLink(accountId: number, eventTypeUri: string): Promise<string> {
  const conn = await getValidToken(accountId);
  if (!conn) throw new Error("Calendly is not connected for this account — connect it in Settings.");
  const res = await fetch(`${CALENDLY_API_BASE}/scheduling_links`, {
    method: "POST",
    headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ max_event_count: 1, owner: eventTypeUri, owner_type: "EventType" }),
  });
  if (!res.ok) throw new Error(`Calendly scheduling_links failed: ${res.status} ${await res.text()}`);
  const { resource } = await res.json();
  return resource.booking_url;
}
