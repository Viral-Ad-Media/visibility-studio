import db from "@/lib/db";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const rows = (await db.prepare("SELECT key, value FROM vis_settings").all()) as {
    key: string;
    value: string;
  }[];
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Settings</h1>
      <p className="text-sm text-slate-400 mb-6">
        Configuration the engine reads before falling back to auto-detection.
      </p>
      <SettingsForm initial={settings} />
    </div>
  );
}
