import Link from "next/link";

import { AppMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <AppMark className="mx-auto" />
        <h1 className="mt-4 font-display text-2xl font-bold">Page not found</h1>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-brand-700">Back to Canvas</Link>
      </div>
    </main>
  );
}
