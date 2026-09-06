import db, { getCurrentMembership, serviceDb } from "@/lib/db";
import { listMyInvitations } from "@/lib/team";
import { supabaseServerClient } from "@/lib/supabase-server";
import { getConnectionStatus, listEventTypes, type CalendlyEventType } from "@/lib/engine/calendly";
import SettingsTabs from "@/components/settings/SettingsTabs";
import ProfileSection from "@/components/settings/ProfileSection";
import TeamSection from "@/components/settings/TeamSection";
import IntegrationsSection from "@/components/settings/IntegrationsSection";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { accountId, role: currentRole } = await getCurrentMembership();
  const {
    data: { user },
  } = await supabaseServerClient().auth.getUser();

  const [rows, calendly, members, sentInvitations, myInvitations] = await Promise.all([
    db.prepare("SELECT key, value FROM vis_settings WHERE account_id = ?").all(accountId) as Promise<
      { key: string; value: string }[]
    >,
    getConnectionStatus(accountId),
    serviceDb
      .prepare(
        `SELECT au.user_id, au.role, u.email
         FROM vis_account_users au
         JOIN auth.users u ON u.id = au.user_id
         WHERE au.account_id = ?
         ORDER BY au.created_at`
      )
      .all(accountId) as Promise<{ user_id: string; role: string; email: string }[]>,
    db
      .prepare(
        `SELECT id, email FROM vis_account_invitations
         WHERE account_id = ? AND status = 'pending' ORDER BY id`
      )
      .all(accountId) as Promise<{ id: number; email: string }[]>,
    // Invitations addressed to *this user*, from any account — see lib/team.ts
    // for why this can't be a single join against vis_accounts.
    listMyInvitations(),
  ]);
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  // Best-effort — a transient Calendly API hiccup shouldn't break the whole
  // settings page, just fall back to an empty list.
  let eventTypes: CalendlyEventType[] = [];
  if (calendly.connected) {
    try {
      eventTypes = await listEventTypes(accountId);
    } catch {
      eventTypes = [];
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Settings</h1>
        <p className="text-sm text-slate-400">Account, team, and integration configuration.</p>
      </div>
      <SettingsTabs
        profile={<ProfileSection email={user?.email ?? ""} />}
        team={
          <TeamSection
            members={members}
            sentInvitations={sentInvitations}
            myInvitations={myInvitations}
            currentUserId={user?.id ?? ""}
            currentRole={currentRole}
          />
        }
        integrations={
          <IntegrationsSection
            calendlyConnected={calendly.connected}
            calendlyName={calendly.name}
            eventTypes={eventTypes}
            settings={settings}
          />
        }
      />
    </div>
  );
}
