import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="font-mono text-sm text-ink-faint">404</span>
      <h1 className="text-balance font-display text-2xl font-semibold">
        This agent isn&apos;t <span className="text-accent">running</span> here.
      </h1>
      <p className="text-sm text-ink-soft">
        The page you're looking for doesn't exist, or the listing was taken
        down. It happens — nothing stays live if it fails review.
      </p>
      <Link
        href="/browse"
        className="mt-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#04140f] hover:opacity-90"
      >
        Back to the catalog
      </Link>
    </main>
  );
}
