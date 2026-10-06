import { redirect } from "next/navigation";
import { Logo } from "@/components/app/shell";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata = { title: "Setup" };

/** Shown when the Supabase environment variables are missing. */
export default function SetupPage() {
  if (getSupabaseEnv()) redirect("/");
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="mb-8 flex items-center gap-2">
        <Logo />
        <span className="font-semibold">Progress</span>
      </div>
      <h1 className="text-xl font-semibold">Connect a Supabase project</h1>
      <p className="mt-2 text-sm text-muted">Your data lives in your own Supabase Postgres database. Two values are needed:</p>
      <pre className="mt-4 overflow-x-auto rounded-md border border-line bg-panel-2 p-3 text-[12.5px]">
{`NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
      </pre>
      <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-muted">
        <li>Create a project at supabase.com and copy the URL and publishable (anon) key from Project Settings → API.</li>
        <li>Run the SQL in <code>supabase/migrations/</code> (SQL editor, or <code>supabase db push</code>).</li>
        <li>Put the values in <code>.env.local</code> (locally) or your Vercel project settings, then restart.</li>
      </ol>
      <p className="mt-4 text-sm text-muted">
        To look around without a database, run <code>npm run preview</code> for a read-only demo.
      </p>
    </main>
  );
}
