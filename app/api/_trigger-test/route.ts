import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";

// Throwaway plumbing-check route — confirms tasks.trigger() actually reaches
// Trigger.dev. Delete this route once trigger/helloWorld.ts is verified
// working (it and this route are not part of the real app).
export async function GET() {
  const handle = await tasks.trigger("hello-world", { message: "plumbing check" });
  return NextResponse.json({ ok: true, handle });
}
