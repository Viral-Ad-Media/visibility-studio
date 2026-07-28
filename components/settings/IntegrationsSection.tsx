import CalendlyConnect from "@/components/CalendlyConnect";
import SettingsForm from "@/components/SettingsForm";
import type { CalendlyEventType } from "@/lib/engine/calendly";

export default function IntegrationsSection({
  calendlyConnected,
  calendlyName,
  eventTypes,
  settings,
}: {
  calendlyConnected: boolean;
  calendlyName: string | null;
  eventTypes: CalendlyEventType[];
  settings: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <CalendlyConnect connected={calendlyConnected} name={calendlyName} />
      <SettingsForm initial={settings} eventTypes={eventTypes} calendlyConnected={calendlyConnected} />
    </div>
  );
}
