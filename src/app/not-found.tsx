import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm text-faint">404</p>
      <h1 className="mt-1 text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-muted">This page doesn&apos;t exist, or the item was deleted.</p>
      <Link href="/" className="mt-4 text-sm text-accent hover:underline">
        Back to overview
      </Link>
    </main>
  );
}
