import db, { getCurrentAccountId } from "@/lib/db";
import { getConnectionStatus } from "@/lib/engine/calendly";
import SettingsForm from "@/components/SettingsForm";
import CalendlyConnect from "@/components/CalendlyConnect";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const accountId = await getCurrentAccountId();
  const [rows, calendly] = await Promise.all([
    db.prepare("SELECT key, value FROM vis_settings WHERE account_id = ?").all(accountId) as Promise<
      { key: string; value: string }[]
    >,
    getConnectionStatus(accountId),
  ]);
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Settings</h1>
        <p className="text-sm text-slate-400">
          Configuration the engine reads before falling back to auto-detection.
        </p>
      </div>
      <CalendlyConnect connected={calendly.connected} name={calendly.name} />
      <SettingsForm initial={settings} />
    </div>
  );
}
