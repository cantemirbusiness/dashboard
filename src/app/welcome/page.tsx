import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/data/workspace";
import { Logo } from "@/components/app/shell";
import { Onboarding } from "./onboarding";

export const metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const ws = await getWorkspace();
  if (ws.profile.onboardedAt || ws.skills.length > 0) redirect("/");
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-4 py-12">
      <div className="mb-8 flex items-center gap-2">
        <Logo />
        <span className="font-semibold">Progress</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome. How do you want to start?</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        This dashboard turns what you learn, practise, build and ship into an explainable picture of your progress. Knowledge → Practice → Projects → Results.
      </p>
      <div className="mt-8">
        <Onboarding />
      </div>
    </main>
  );
}
