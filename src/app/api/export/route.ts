import { NextResponse } from "next/server";
import { fetchWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { isPreviewMode } from "@/lib/supabase/env";

/** Download the signed-in user's data as JSON. RLS limits it to their own rows. */
export async function GET() {
  if (isPreviewMode()) return NextResponse.json({ error: "Export is unavailable in preview mode." }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const ws = await fetchWorkspace(supabase, userId);
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), ...ws }, null, 2);
  return new NextResponse(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="progress-export-${ws.today}.json"`,
      "cache-control": "no-store",
    },
  });
}
