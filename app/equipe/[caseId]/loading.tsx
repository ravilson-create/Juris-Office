export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8" role="status" aria-live="polite">
      <div className="mb-6 flex justify-between">
        <div className="h-5 w-16 animate-pulse rounded bg-line" />
        <div className="h-9 w-40 animate-pulse rounded bg-line" />
      </div>
      <div className="h-40 animate-pulse rounded-md bg-line" />
      <div className="mt-10 h-32 animate-pulse rounded-md bg-line" />
      <span className="sr-only">Carregando caso…</span>
    </main>
  );
}
