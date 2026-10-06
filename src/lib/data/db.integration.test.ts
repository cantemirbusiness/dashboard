// Integration test against a real Postgres + PostgREST (see scripts/test-db.sh).
// Skipped unless DB_TEST_URL and DB_TEST_JWT_SECRET are set.
//
// It seeds the demo workspace through the API as an authenticated user (so
// RLS and every constraint apply), loads it back with the app's real loader,
// and checks the Progress Engine produces exactly the same result as the
// in-memory demo. It also verifies one user cannot read another user's rows.

import { createHmac, randomUUID } from "node:crypto";
import { PostgrestClient } from "@supabase/postgrest-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { generateDemoData } from "@/lib/demo/generate";
import { clearDemoRows, seedDemoData } from "@/lib/demo/seed-db";
import { demoWorkspace } from "@/lib/demo/workspace";
import { runEngine } from "@/lib/engine";
import { fetchWorkspace } from "./fetch";

const url = process.env.DB_TEST_URL;
const secret = process.env.DB_TEST_JWT_SECRET;
const adminSql = process.env.DB_TEST_ADMIN; // optional: "psql …" handled by the script

const b64 = (o: object | Buffer) => Buffer.from(o instanceof Buffer ? o : JSON.stringify(o)).toString("base64url");
function jwt(sub: string) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = createHmac("sha256", secret!).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
const clientFor = (sub: string) =>
  new PostgrestClient(url!, { headers: { Authorization: `Bearer ${jwt(sub)}` } }) as unknown as SupabaseClient;

describe.skipIf(!url || !secret)("database integration", () => {
  const userA = process.env.DB_TEST_USER_A!;
  const userB = process.env.DB_TEST_USER_B!;
  void adminSql;

  it("round-trips the demo workspace and reproduces the engine output", async () => {
    const db = clientFor(userA);
    const ws0 = await fetchWorkspace(db, userA);
    const today = ws0.today;

    let n = 0;
    const ids = Array.from({ length: 2000 }, () => randomUUID());
    await seedDemoData(db, userA, today, () => ids[n++]);

    const ws = await fetchWorkspace(db, userA);
    expect(ws.skills.length).toBe(generateDemoData(today).skills.length);
    expect(ws.activities.length).toBeGreaterThan(150);

    const fromDb = runEngine(ws).analysis;
    const inMemory = runEngine(demoWorkspace(today)).analysis;
    expect(fromDb.overall.score).toBeCloseTo(inMemory.overall.score!, 6);
    expect(fromDb.goals.map((g) => g.status).sort()).toEqual(inMemory.goals.map((g) => g.status).sort());
    for (const s of inMemory.skills) {
      const match = fromDb.skills.find((x) => x.skill.name === s.skill.name)!;
      expect(match.score).toBeCloseTo(s.score, 6);
    }
  });

  it("isolates users through RLS", async () => {
    const other = await fetchWorkspace(clientFor(userB), userB);
    expect(other.skills).toHaveLength(0);
    expect(other.activities).toHaveLength(0);
    // Even filtering by the other user's id returns nothing.
    const { data } = await clientFor(userB).from("activities").select("id").eq("user_id", userA);
    expect(data).toEqual([]);
    // And writing rows owned by someone else is rejected.
    const { error } = await clientFor(userB).from("skills").insert({ user_id: userA, name: "Injected" });
    expect(error).not.toBeNull();
  });

  it("clears demo rows without touching real rows", async () => {
    const db = clientFor(userA);
    const real = await db.from("skills").insert({ user_id: userA, name: "My real skill" }).select("id").single();
    expect(real.error).toBeNull();
    await clearDemoRows(db, userA);
    const ws = await fetchWorkspace(db, userA);
    expect(ws.skills.map((s) => s.name)).toEqual(["My real skill"]);
    expect(ws.activities).toHaveLength(0);
  });
});
