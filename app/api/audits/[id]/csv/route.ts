import { buildAuditCsv, auditCsvFilename } from "@/lib/csv";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const result = buildAuditCsv(Number(params.id));
  if (!result) return new Response("not found", { status: 404 });

  return new Response(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${auditCsvFilename(result.audit)}"`,
    },
  });
}
