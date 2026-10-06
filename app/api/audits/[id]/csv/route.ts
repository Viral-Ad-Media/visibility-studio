import { z } from "zod";
import {
  apiRoute,
  parseBody,
  parseId,
  auditInput,
  positiveId,
  idList,
} from "@/lib/api";
import { buildAuditCsv, auditCsvFilename } from "@/lib/csv";

export const dynamic = "force-dynamic";

async function GETHandler(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await buildAuditCsv(parseId((await params).id));
  if (!result) return new Response("not found", { status: 404 });

  return new Response(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${auditCsvFilename(result.audit)}"`,
    },
  });
}

export const GET = apiRoute(GETHandler, true);
